from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Any, Callable

import frontmatter
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from shared import _state_lock, _read_state, _write_state
from embed import embed_texts_sync, embed_texts_bulk
from ingest import make_note_id, build_note_chunks
from store import NoteStore

logger = logging.getLogger(__name__)

DEBOUNCE_SECONDS = 5
STATUS_RECENT_MAX = 20


class _DebounceEntry:
    __slots__ = ("event_type", "scheduled_at", "handled_at")

    def __init__(self, event_type: str, scheduled_at: float):
        self.event_type = event_type
        self.scheduled_at = scheduled_at
        self.handled_at: float | None = None


class NoteWatcher:
    def __init__(
        self,
        notes_dir: str,
        store: NoteStore,
        invalidate_cache_callback: Callable[[], None] | None = None,
    ):
        self._notes_dir = Path(notes_dir)
        self._store = store
        self._invalidate_cache = invalidate_cache_callback
        self._observer: Observer | None = None
        self._lock = threading.Lock()
        self._pending: dict[str, _DebounceEntry] = {}
        self._running = False
        self._events_processed = 0
        self._recent_events: list[dict[str, Any]] = []
        self._last_event_at: float | None = None
        self._filename_to_note_id: dict[str, str] = {}
        self._debounce_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        if self._running:
            return
        self._build_filename_map()
        resolved = self._notes_dir.resolve()
        self._observer = Observer()
        self._observer.schedule(
            _Handler(self._on_event),
            str(resolved),
            recursive=False,
        )
        self._observer.daemon = True
        self._observer.start()
        self._running = True
        self._stop_event.clear()
        self._debounce_thread = threading.Thread(target=self._debounce_loop, daemon=True)
        self._debounce_thread.start()
        # Scan for files already on disk that need indexing
        scan_thread = threading.Thread(target=self._startup_scan, daemon=True)
        scan_thread.start()
        logger.info("NoteWatcher started on %s", self._notes_dir)

    def _startup_scan(self) -> None:
        """After startup, index any files on disk that aren't tracked or have changed,
        and clean up orphaned entries in state / ChromaDB."""
        state_file = self._notes_dir / ".ingest_state.json"
        tracked: dict = _read_state(state_file).get("files", {})
        queued = 0
        for md_file in self._notes_dir.iterdir():
            if md_file.suffix != ".md":
                continue
            try:
                post = frontmatter.load(str(md_file))
                source_id = post.metadata.get("source_id", "")
                note_id = make_note_id(source_id) if source_id else make_note_id(md_file.stem)
            except Exception:
                continue
            mtime = md_file.stat().st_mtime
            known = tracked.get(note_id, {})
            if known.get("mtime", 0) < mtime:
                self._filename_to_note_id[md_file.name] = note_id
                with self._lock:
                    self._pending[md_file.name] = _DebounceEntry(
                        event_type="modified",
                        scheduled_at=time.monotonic(),
                    )
                queued += 1
        if queued:
            logger.info("Watcher: queued %d files for startup ingest", queued)

        self._cleanup_orphans(tracked)

    def _cleanup_orphans(self, tracked: dict) -> None:
        """Delete notes from ChromaDB and state that no longer exist on disk."""
        note_ids_on_disk = set(self._filename_to_note_id.values())
        cleaned = 0

        # Pass 1: state-file orphans
        for note_id in list(tracked.keys()):
            if note_id not in note_ids_on_disk:
                self._handle_delete(note_id, f"{note_id}.md")
                cleaned += 1

        # Pass 2: ChromaDB orphans
        try:
            all_notes = self._store.get_unique_notes(include=["metadatas"])
            for meta in all_notes.get("metadatas", []):
                if not meta:
                    continue
                db_note_id = meta.get("note_id", "")
                if db_note_id and db_note_id not in note_ids_on_disk:
                    self._handle_delete(db_note_id, f"{db_note_id}.md")
                    cleaned += 1
        except Exception as e:
            logger.warning("Watcher: ChromaDB cleanup error: %s", e)

        if cleaned:
            logger.info("Watcher: cleaned up %d orphaned notes", cleaned)

    def stop(self) -> None:
        if not self._running:
            return
        self._stop_event.set()
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=10)
        if self._debounce_thread:
            self._debounce_thread.join(timeout=DEBOUNCE_SECONDS + 2)
        self._running = False
        logger.info("NoteWatcher stopped")

    @property
    def running(self) -> bool:
        return self._running

    def status(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "notes_dir": str(self._notes_dir),
            "events_processed": self._events_processed,
            "last_event_at": self._last_event_at,
            "pending_count": len(self._pending),
            "recent_events": list(self._recent_events),
        }

    def _build_filename_map(self) -> None:
        self._filename_to_note_id.clear()
        for f in self._notes_dir.iterdir():
            if f.suffix != ".md":
                continue
            try:
                post = frontmatter.load(str(f))
                source_id = post.metadata.get("source_id", "")
                if source_id:
                    note_id = make_note_id(source_id)
                    self._filename_to_note_id[f.name] = note_id
            except Exception:
                pass

    def _on_event(self, event_type: str, src_path: str) -> None:
        path = Path(src_path)
        if path.suffix != ".md":
            return
        if path.name == ".ingest_state.json":
            return
        filename = path.name
        if event_type == "deleted":
            note_id = self._filename_to_note_id.pop(filename, None)
            if note_id:
                self._handle_delete(note_id, filename)
            return
        with self._lock:
            self._pending[filename] = _DebounceEntry(
                event_type=event_type,
                scheduled_at=time.monotonic(),
            )

    def _debounce_loop(self) -> None:
        while not self._stop_event.is_set():
            self._process_pending()
            self._stop_event.wait(timeout=1.0)

    def _process_pending(self) -> None:
        now = time.monotonic()
        with self._lock:
            ready = {fname: entry for fname, entry in self._pending.items() if now - entry.scheduled_at >= DEBOUNCE_SECONDS}
            for fname in ready:
                del self._pending[fname]
        if len(ready) <= 1:
            for fname in ready:
                self._handle_upsert(fname)
        else:
            self._batch_upsert(list(ready.keys()))

    def _batch_upsert(self, filenames: list[str]) -> None:
        prep = []
        for filename in filenames:
            result = self._prepare_upsert(filename)
            if result is not None:
                prep.append(result)

        if not prep:
            return

        all_chunks = []
        for _, _, _, chunks, _, _ in prep:
            all_chunks.extend(chunks)

        embeddings = embed_texts_bulk(all_chunks)
        if not embeddings:
            logger.error("Watcher: bulk embedding returned empty for %d files", len(prep))
            return

        emb_offset = 0
        for filename, note_id, ids, chunks, metadatas, md_path in prep:
            n = len(chunks)
            batch_embs = embeddings[emb_offset : emb_offset + n]
            emb_offset += n
            if len(batch_embs) != n:
                logger.error("Watcher: embedding count mismatch for %s", filename)
                continue
            with self._write_lock():
                self._store.delete_note_chunks(note_id)
                self._store.add_notes(ids, chunks, batch_embs, metadatas)
            self._filename_to_note_id[filename] = note_id
            self._update_ingest_state(note_id, md_path, n)
            if self._invalidate_cache:
                self._invalidate_cache()
            self._record_event("upsert", filename, note_id)
            logger.info("Watcher: upserted %s (%s, %d chunks)", filename, note_id, n)

    def _prepare_upsert(self, filename: str) -> tuple[str, str, list[str], list[str], list[dict], Path] | None:
        md_path = self._notes_dir / filename
        if not md_path.exists():
            return None
        try:
            post = frontmatter.load(str(md_path))
        except Exception as e:
            logger.error("Watcher: failed to parse %s: %s", filename, e)
            return None

        source_id = post.metadata.get("source_id", "")
        note_id = make_note_id(source_id) if source_id else make_note_id(md_path.stem)
        old_note_id = self._filename_to_note_id.get(filename)
        if old_note_id and old_note_id != note_id:
            self._handle_delete(old_note_id, filename)

        try:
            chunks, metadatas, ids = build_note_chunks(note_id, post.metadata, post.content, filename)
            if not chunks:
                logger.warning("Watcher: no chunks for %s, skipping", filename)
                return None
            return filename, note_id, ids, chunks, metadatas, md_path
        except Exception as e:
            logger.error("Watcher: error preparing %s: %s", filename, e)
            return None

    def _handle_upsert(self, filename: str) -> None:
        prep = self._prepare_upsert(filename)
        if prep is None:
            return
        _, note_id, ids, chunks, metadatas, md_path = prep

        try:
            embeddings = embed_texts_sync(chunks)
            if not embeddings:
                logger.error("Watcher: embedding failed for %s", filename)
                return
            with self._write_lock():
                self._store.delete_note_chunks(note_id)
                self._store.add_notes(ids, chunks, embeddings, metadatas)
            self._filename_to_note_id[filename] = note_id
            self._update_ingest_state(note_id, md_path, len(chunks))
            if self._invalidate_cache:
                self._invalidate_cache()
            self._record_event("upsert", filename, note_id)
            logger.info("Watcher: upserted %s (%s, %d chunks)", filename, note_id, len(chunks))
        except Exception as e:
            logger.error("Watcher: error upserting %s: %s", filename, e)

    def _handle_delete(self, note_id: str, filename: str) -> None:
        try:
            with self._write_lock():
                self._store.delete_note_chunks(note_id)
            self._remove_from_ingest_state(note_id)
            if self._invalidate_cache:
                self._invalidate_cache()
            self._record_event("delete", filename, note_id)
            logger.info("Watcher: deleted %s (%s)", filename, note_id)
        except Exception as e:
            logger.error("Watcher: error deleting %s: %s", filename, e)

    def _write_lock(self):
        return self._lock

    def _record_event(self, event_type: str, filename: str, note_id: str) -> None:
        self._events_processed += 1
        self._last_event_at = time.time()
        entry = {
            "type": event_type,
            "filename": filename,
            "note_id": note_id,
            "timestamp": self._last_event_at,
        }
        self._recent_events.append(entry)
        if len(self._recent_events) > STATUS_RECENT_MAX:
            self._recent_events = self._recent_events[-STATUS_RECENT_MAX:]

    def _update_ingest_state(self, note_id: str, md_path: Path, chunk_count: int) -> None:
        state_file = self._notes_dir / ".ingest_state.json"
        try:
            state = _read_state(state_file)
            mtime = md_path.stat().st_mtime
            state.setdefault("files", {})[note_id] = {
                "mtime": mtime,
                "chunks": chunk_count,
            }
            _write_state(state_file, state)
        except Exception as e:
            logger.warning("Watcher: failed to update ingest state for %s: %s", note_id, e)

    def _remove_from_ingest_state(self, note_id: str) -> None:
        state_file = self._notes_dir / ".ingest_state.json"
        try:
            state = _read_state(state_file)
            state.get("files", {}).pop(note_id, None)
            _write_state(state_file, state)
        except Exception as e:
            logger.warning("Watcher: failed to remove %s from ingest state: %s", note_id, e)


class _Handler(FileSystemEventHandler):
    def __init__(self, callback: Callable[[str, str], None]):
        self._callback = callback

    def on_created(self, event):
        if not event.is_directory:
            self._callback("created", event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._callback("modified", event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self._callback("deleted", event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._callback("moved", event.dest_path)

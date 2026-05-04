import os
import json
import re
import logging
import hashlib
import frontmatter
from datetime import datetime
from pathlib import Path
from typing import Any

from langchain_text_splitters import MarkdownTextSplitter
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn, TimeRemainingColumn, MofNCompleteColumn

from shared import _state_lock, _read_state, _write_state
from embed import embed_texts_sync, embed_texts_bulk, BATCH_SIZE
from models import CalendarEvent
from store import NoteStore
from calendar_data import CalendarProcessor, CALENDAR_EXPORT_PATH, PEOPLE_REGISTRY_PATH
from config import settings

logger = logging.getLogger("ingest")


def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> list[str]:
    if not text or text == "":
        return []
    if len(text) <= chunk_size:
        return [text]
    splitter = MarkdownTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len,
    )
    return splitter.split_text(text)


def make_note_id(source_id: str) -> str:
    sanitized = re.sub(r"[:/]+", "-", source_id)
    sanitized = sanitized.strip("-")
    return sanitized


def make_doc_id(note_id: str, chunk_index: int, filename: str) -> str:
    # Deduplicate notes: filename hash disambiguates duplicate source_ids in different files
    filename_hash = hashlib.sha256(filename.encode()).hexdigest()[:8]
    return f"{note_id}_file_{filename_hash}_chunk_{chunk_index}"


_SEXAGESIMAL_REVERSE = {61: "1:1"}


def _reverse_sexagesimal(value: Any) -> str:
    if isinstance(value, int) and value in _SEXAGESIMAL_REVERSE:
        return _SEXAGESIMAL_REVERSE[value]
    return str(value).strip()


def _reverse_sexagesimal_list(items: Any) -> list[str]:
    if isinstance(items, str):
        return [t.strip() for t in items.split(",") if t.strip()]
    elif isinstance(items, list):
        return [_reverse_sexagesimal(t) for t in items if str(t).strip()]
    return []


def _normalize_tags_participants(fm: dict) -> tuple[list[str], list[str]]:
    tags = _reverse_sexagesimal_list(fm.get("tags", []))
    participants = _reverse_sexagesimal_list(fm.get("participants", []))
    return tags, participants


def _load_series_assignments() -> dict[str, str | None]:
    from config import DATA_DIR

    state_file = Path(DATA_DIR) / "series_assignments.json"
    meta = _read_state(state_file)
    return meta if isinstance(meta, dict) else {}


def build_note_chunks(
    note_id: str,
    fm: dict,
    body: str,
    filename: str,
    calendar_context: str = "",
    series: str = "",
) -> tuple[list[str], list[dict], list[str]]:
    """Return (chunks, metadatas, ids) for a note ready to embed.

    Tier 1: title + folder + tags + participants + series + first ~2k chars + optional calendar context.
    Tier 2: body chunks at ~2k chars with 200 char overlap, respecting markdown boundaries.
    """
    title = fm.get("title", note_id)
    folder = fm.get("folder", "")
    source_id = fm.get("source_id", note_id)
    source = fm.get("source", "Apple Notes")
    created_val = fm.get("created", "")
    modified_val = fm.get("modified", "")
    created_str = created_val.isoformat() if hasattr(created_val, "isoformat") else (str(created_val) if created_val else "")
    modified_str = modified_val.isoformat() if hasattr(modified_val, "isoformat") else (str(modified_val) if modified_val else "")

    tags, participants = _normalize_tags_participants(fm)
    tags_str = ",".join(tags) if tags else ""
    participants_str = ",".join(participants) if participants else ""

    tier1_body = body[:2000]
    tier1_text = f"Title: {title}\nFolder: {folder}\nTags: {tags_str}\nParticipants: {participants_str}\n\n{tier1_body}{calendar_context}"

    chunk_id_0 = make_doc_id(note_id, 0, filename)
    tier1_metadata = {
        "note_id": note_id,
        "filename": filename,
        "chunk_index": 0,
        "title": title,
        "folder": folder,
        "tags": tags_str,
        "participants": participants_str,
        "created": created_str,
        "modified": modified_str,
        "source": source,
        "source_id": source_id,
        "date": created_str[:10] if created_str else "",
        "series": series or "",
    }

    chunks = [tier1_text]
    metadatas = [tier1_metadata]
    ids = [chunk_id_0]

    if len(body) > 2000:
        remainder = body[1600:]
        body_chunks = chunk_text(remainder, 2000, 200)
        for i, chunk in enumerate(body_chunks):
            if chunk.strip():
                chunk_index = i + 1
                chunk_id = make_doc_id(note_id, chunk_index, filename)
                chunk_metadata = {
                    "note_id": note_id,
                    "chunk_index": chunk_index,
                    "title": title,
                    "folder": folder,
                    "tags": tags_str,
                    "participants": participants_str,
                    "created": created_str,
                    "modified": modified_str,
                    "source": source,
                    "source_id": source_id,
                    "date": created_str[:10] if created_str else "",
                    "series": series or "",
                }
                chunks.append(chunk)
                metadatas.append(chunk_metadata)
                ids.append(chunk_id)

    return chunks, metadatas, ids


def get_calendar_context(
    note_participants: list[str],
    created_str: str,
    calendar_events: list[CalendarEvent],
) -> str:
    if not note_participants or not created_str:
        return ""
    note_date = created_str[:10]
    if not note_date:
        return ""
    relevant = []
    for event in calendar_events:
        if event.date != note_date:
            continue
        attendee_list = event.attendee_names
        has_overlap = any(p in attendee_list or any(p.lower() in a.lower() for a in attendee_list) for p in note_participants)
        if has_overlap:
            summary = event.summary or "Event"
            relevant.append(f"{summary} ({note_date})")
    if relevant:
        return "\n\nCalendar context: " + ", ".join(relevant)
    return ""


def ingest_notes(notes_dir: str, store: NoteStore, force: bool = False) -> dict:
    notes_path = Path(notes_dir)
    state_file = notes_path / ".ingest_state.json"

    ingest_state = {"last_ingest": "", "files": {}}
    if not force:
        try:
            ingest_state = _read_state(state_file)
        except Exception:
            pass

    current_provider = settings.embed_provider_ingest
    if current_provider == "ollama":
        current_model = settings.ollama_embed_model
    else:
        current_model = settings.openrouter_embed_model
    if not force:
        prev_provider = ingest_state.get("embed_provider", "")
        if prev_provider and prev_provider != current_provider:
            raise ValueError(
                f"Embedding provider changed from '{prev_provider}' to '{current_provider}'. "
                "Run with --force to re-ingest with the new provider."
            )
        prev_model = ingest_state.get("embed_model", "")
        if prev_model and prev_model != current_model:
            raise ValueError(
                f"Embedding model changed from '{prev_model}' to '{current_model}'. "
                "Run with --force to re-ingest with the new model."
            )

    cal = CalendarProcessor()
    cal.load()
    calendar_events = cal.process_events()

    series_assignments = _load_series_assignments() if not force else {}

    all_files = [f for f in notes_path.iterdir() if f.suffix == ".md" and f.name != ".ingest_state.json"]
    notes_ingested = 0
    notes_skipped = 0
    chunks_created = 0
    errors = []

    logger.info("Found %d .md files in %s", len(all_files), notes_dir)
    if force:
        logger.info("Force mode: re-ingesting all notes")
    else:
        logger.info("Incremental mode: skipping unchanged files")

    all_chunks = []
    all_metadata = []
    all_ids = []

    ids_to_delete = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
    ) as progress:
        parse_task = progress.add_task("Parsing notes", total=len(all_files))
        for md_file in all_files:
            try:
                post = frontmatter.load(str(md_file))
                fm = post.metadata
                body = post.content

                source_id = fm.get("source_id", md_file.stem)
                note_id = make_note_id(source_id)

                current_mtime = md_file.stat().st_mtime

                if not force and note_id in ingest_state.get("files", {}):
                    stored_mtime = ingest_state["files"][note_id].get("mtime", 0)
                    if current_mtime <= stored_mtime:
                        notes_skipped += 1
                        progress.advance(parse_task)
                        continue

                tags, participants = _normalize_tags_participants(fm)
                created_val = fm.get("created", "")
                created_str = created_val.isoformat() if hasattr(created_val, "isoformat") else (str(created_val) if created_val else "")
                calendar_context = get_calendar_context(participants, created_str, calendar_events)
                series = fm.get("series", "") or series_assignments.get(note_id) or ""

                chunks, metadatas, ids = build_note_chunks(
                    note_id, fm, body, md_file.name, calendar_context=calendar_context, series=series
                )
                all_chunks.extend(chunks)
                all_metadata.extend(metadatas)
                all_ids.extend(ids)
                ids_to_delete.append(note_id)
                chunks_created += len(chunks)
                notes_ingested += 1
                logger.debug("Ingested %s (%d chunks, tags=%s)", md_file.name, len(chunks), tags)

                ingest_state.setdefault("files", {})[note_id] = {
                    "mtime": current_mtime,
                    "chunks": len(chunks),
                }

            except Exception as e:
                errors.append(f"{md_file.name}: {str(e)}")
            progress.advance(parse_task)

    if force:
        store.reset()
        logger.info("Reset collections for force re-ingest")
    else:
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TimeElapsedColumn(),
        ) as progress:
            del_task = progress.add_task("Deleting old chunks", total=len(ids_to_delete))
            for note_id_prefix in ids_to_delete:
                try:
                    store.delete_note_chunks(note_id_prefix)
                except Exception:
                    pass
                progress.advance(del_task)
    logger.info("Embedding %d chunks in batches of %d...", len(all_chunks), BATCH_SIZE)

    import time

    start_time = time.time()

    total_batches = (len(all_chunks) + BATCH_SIZE - 1) // BATCH_SIZE
    logger.info("Starting bulk embed of %d chunks (%d batches, provider=%s)...", len(all_chunks), total_batches, current_provider)

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
    ) as progress:
        embed_task = progress.add_task("Embedding chunks", total=total_batches)

        def on_batch_done(batch_idx: int, count: int):
            progress.advance(embed_task)
            logger.debug("Batch %d/%d done (%d chunks)", batch_idx + 1, total_batches, count)

        try:
            embeddings = embed_texts_bulk(
                all_chunks,
                provider=current_provider,
                on_batch_done=on_batch_done,
            )
            if embeddings and len(embeddings) == len(all_chunks):
                # Store in batches to avoid memory issues with huge lists
                store_batch_size = BATCH_SIZE
                for i in range(0, len(all_chunks), store_batch_size):
                    store.add_notes(
                        all_ids[i : i + store_batch_size],
                        all_chunks[i : i + store_batch_size],
                        embeddings[i : i + store_batch_size],
                        all_metadata[i : i + store_batch_size],
                    )
                logger.info("Stored %d chunks in ChromaDB", len(all_chunks))
            elif embeddings:
                logger.warning("Partial embed: got %d embeddings for %d chunks", len(embeddings), len(all_chunks))
        except Exception as e:
            errors.append(f"Bulk embedding failed: {str(e)}")
            logger.error("Bulk embedding failed: %s", e)

    elapsed = time.time() - start_time
    logger.info("Embedding phase complete in %.1fs (%.1f chunks/sec)", elapsed, len(all_chunks) / elapsed if elapsed > 0 else 0)

    ingest_state["embed_provider"] = current_provider
    ingest_state["embed_model"] = current_model
    ingest_state["last_ingest"] = datetime.utcnow().isoformat() + "Z"
    try:
        _write_state(state_file, ingest_state)
    except IOError as e:
        errors.append(f"State file error: {str(e)}")

    total_time = time.time() - start_time
    logger.info(
        "Ingest complete in %.1fs: %d ingested, %d skipped, %d chunks, %d errors",
        total_time,
        notes_ingested,
        notes_skipped,
        chunks_created,
        len(errors),
    )

    return {
        "notes_ingested": notes_ingested,
        "notes_skipped": notes_skipped,
        "chunks_created": chunks_created,
        "calendar_events": 0,
        "errors": errors,
    }


def ingest_calendar(
    store: NoteStore,
    calendar_path: str = CALENDAR_EXPORT_PATH,
    registry_path: str = PEOPLE_REGISTRY_PATH,
) -> dict:
    current_provider = settings.embed_provider_ingest
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()
    errors = []
    events_ingested = 0

    logger.info("Processing %d calendar events", len(events))

    all_texts = []
    all_ids = []
    all_metadata = []

    for event in events:
        event_id = event.id
        if not event_id:
            continue

        embedding_text = cal.get_embedding_text(event)
        if not embedding_text:
            continue

        cal_id = f"cal_{event_id}"
        metadata = {
            "date": event.date,
            "summary": event.summary,
            "location": event.location,
            "attendees": event.attendees,
            "event_type": event.event_type,
        }

        all_texts.append(embedding_text)
        all_ids.append(cal_id)
        all_metadata.append(metadata)

    import time

    start_time = time.time()

    total_cal_batches = (len(all_texts) + BATCH_SIZE - 1) // BATCH_SIZE
    logger.info(
        "Starting bulk embed of %d calendar events (%d batches, provider=%s)...", len(all_texts), total_cal_batches, current_provider
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
    ) as progress:
        cal_task = progress.add_task("Embedding calendar", total=total_cal_batches)

        def on_cal_batch_done(batch_idx: int, count: int):
            progress.advance(cal_task)
            logger.debug("Calendar batch %d/%d done (%d events)", batch_idx + 1, total_cal_batches, count)

        try:
            embeddings = embed_texts_bulk(
                all_texts,
                provider=current_provider,
                on_batch_done=on_cal_batch_done,
            )
            if embeddings and len(embeddings) == len(all_texts):
                store_batch_size = BATCH_SIZE
                for i in range(0, len(all_texts), store_batch_size):
                    store.add_calendar_events(
                        all_ids[i : i + store_batch_size],
                        all_texts[i : i + store_batch_size],
                        embeddings[i : i + store_batch_size],
                        all_metadata[i : i + store_batch_size],
                    )
                events_ingested = len(all_texts)
                logger.info("Stored %d calendar events in ChromaDB", len(all_texts))
            elif embeddings:
                logger.warning("Partial embed: got %d embeddings for %d events", len(embeddings), len(all_texts))
        except Exception as e:
            errors.append(f"Bulk calendar embedding failed: {str(e)}")
            logger.error("Bulk calendar embedding failed: %s", e)

    elapsed = time.time() - start_time
    logger.info("Calendar ingest complete in %.1fs: %d events, %d errors", elapsed, events_ingested, len(errors))

    return {
        "events_ingested": events_ingested,
        "errors": errors,
    }


import typer

app = typer.Typer()


@app.command()
def ingest(
    notes_dir: str = typer.Option(
        os.path.join(os.path.dirname(__file__), "..", "notes"),
        "--notes-dir",
        help="Directory containing markdown notes",
    ),
    force: bool = typer.Option(False, "--force", help="Force re-ingest all notes"),
    calendar_only: bool = typer.Option(False, "--calendar-only", help="Only ingest calendar events"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
):
    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    if verbose:
        logging.getLogger("ingest").setLevel(logging.DEBUG)

    store = NoteStore()

    if calendar_only:
        result = ingest_calendar(store)
    else:
        result = ingest_notes(notes_dir, store, force=force)
    typer.echo(json.dumps(result, indent=2))


if __name__ == "__main__":
    app()

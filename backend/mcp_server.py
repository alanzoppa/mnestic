from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

import frontmatter
from fastmcp import FastMCP

if TYPE_CHECKING:
    from store import NoteStore

from utils import normalize_and_dedup_results
from shared import _is_safe_filename, find_note_file, _sanitize_filename
from config import NOTES_DIR

logger = logging.getLogger(__name__)


def _flatten_tags(val: Any) -> list[str]:
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val:
        return [t.strip() for t in val.split(",") if t.strip()]
    return []


def _note_from_unique(meta: dict, note_id: str) -> dict[str, Any]:
    return {
        "id": note_id,
        "title": meta.get("title", "Untitled"),
        "folder": meta.get("folder", ""),
        "tags": _flatten_tags(meta.get("tags", "")),
        "participants": _flatten_tags(meta.get("participants", "")),
        "created": meta.get("created", ""),
        "modified": meta.get("modified", ""),
        "source": meta.get("source", ""),
        "source_id": meta.get("source_id", ""),
    }


def setup_mcp(store: NoteStore, calendar_processor: Any | None = None) -> FastMCP:
    from embed import embed_query_sync

    mcp = FastMCP("mnestic")

    @mcp.tool()
    def search_notes(
        query: str,
        limit: int = 10,
        tag: str | None = None,
        participant: str | None = None,
        date_gte: str | None = None,
        date_lte: str | None = None,
    ) -> dict[str, Any]:
        """Search notes using semantic search with optional metadata filters.

        Args:
            query: The search query string.
            limit: Maximum number of unique notes to return (default 10).
            tag: Optional tag filter (exact match, case-insensitive).
            participant: Optional participant filter (case-insensitive substring match).
            date_gte: Optional lower bound on note creation date (ISO format).
            date_lte: Optional upper bound on note creation date (ISO format).
        """
        if not query.strip():
            return {"notes": []}
        embedding = embed_query_sync(query)
        raw = store.search_notes(embedding, n=limit * 5)

        if tag:
            tag_set = {t.strip().lower() for t in tag.split(",") if t.strip()}
            raw = [r for r in raw if tag_set & {t.strip().lower() for t in r.metadata.tags if t.strip()}]

        if participant:
            p_lower = participant.strip().lower()
            raw = [r for r in raw if any(p_lower in part.lower() for part in r.metadata.participants)]

        if date_gte:
            raw = [r for r in raw if r.metadata.created and r.metadata.created >= date_gte]
        if date_lte:
            raw = [r for r in raw if not r.metadata.created or r.metadata.created <= date_lte]

        deduped = normalize_and_dedup_results(raw)
        notes = []
        for entry in deduped[:limit]:
            meta = entry["metadata"]
            notes.append(_note_from_unique(meta, entry["note_id"]))
        return {"notes": notes}

    @mcp.tool()
    def create_note(
        title: str,
        content: str = "",
        folder: str = "Notes",
        tags: str = "",
        participants: str = "",
        series: str | None = None,
    ) -> dict[str, Any]:
        """Create a new note with frontmatter metadata and markdown content.
        The note is immediately written to disk and indexed for semantic search.

        Args:
            title: The note title (required).
            content: Markdown body content (optional).
            folder: Folder/category name (default 'Notes').
            tags: Comma-separated tag names (optional).
            participants: Comma-separated participant names (optional).
            series: Series name if this note belongs to a recurring series (optional).
        """
        from shared import _invalidate_source_id_cache

        now = datetime.now(timezone.utc).isoformat()
        raw = f"{title}{now}"
        source_id = hashlib.sha256(raw.encode()).hexdigest()[:12]
        note_id = f"manual_{source_id}"
        sanitized = _sanitize_filename(title.strip(), NOTES_DIR)
        filepath = os.path.join(NOTES_DIR, f"{sanitized}.md")

        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        part_list = [p.strip() for p in participants.split(",") if p.strip()] if participants else []

        meta = {
            "title": title.strip(),
            "folder": folder or "Notes",
            "tags": tag_list,
            "participants": part_list,
            "created": now,
            "modified": now,
            "source": "Manual",
            "source_id": note_id,
        }
        if series:
            meta["series"] = series

        post = frontmatter.Post(content or "")
        post.metadata = meta
        with open(filepath, "wb") as f:
            frontmatter.dump(post, f, allow_unicode=True)

        _invalidate_source_id_cache()

        from ingest import build_note_chunks
        from embed import embed_texts_sync

        chunks, metadatas, ids = build_note_chunks(note_id, meta, content or "", os.path.basename(filepath))
        embeddings = embed_texts_sync(chunks)
        if embeddings:
            store.delete_note_chunks(note_id)
            store.add_notes(ids, chunks, embeddings, metadatas)

        return {
            "id": note_id,
            "title": title.strip(),
            "folder": folder or "Notes",
            "tags": tag_list,
            "participants": part_list,
            "series": series or "",
            "created": now,
            "source": "Manual",
            "content": content or "",
        }

    @mcp.tool()
    def get_note(note_id: str) -> dict[str, Any] | None:
        """Get full note content plus calendar and similar notes.

        Args:
            note_id: The note ID (from search results).
        """
        note = store.get_note(note_id)
        if not note:
            note = store.get_note_by_note_id(note_id)
        if not note:
            return None

        meta = note.metadata.model_dump()
        source_id = meta.get("source_id", "")

        content = ""
        note_file = find_note_file(source_id, NOTES_DIR)
        if not note_file:
            note_file = find_note_file(note_id, NOTES_DIR)
        if note_file and os.path.exists(note_file):
            try:
                post = frontmatter.load(note_file)
                content = post.content
            except Exception as e:
                logger.warning("Failed to read note file %s: %s", note_file, e)

        created = meta.get("created", "")
        date_str = created[:10] if created else ""
        calendar_events = []
        if date_str and calendar_processor is not None:
            try:
                calendar_events = calendar_processor.get_events_for_date(date_str)
            except Exception as e:
                logger.warning("Failed to get calendar events for %s: %s", date_str, e)

        similar = store.get_similar(note.id, n=10)
        logical_note_id = meta.get("note_id") or note.id
        deduped_similar = normalize_and_dedup_results(similar)
        similar_notes = []
        for entry in deduped_similar:
            s_nid = entry["note_id"]
            if s_nid == logical_note_id:
                continue
            s_meta = entry["metadata"]
            similar_notes.append(
                {
                    "id": s_nid,
                    "title": s_meta.get("title", ""),
                    "score": entry["score"],
                }
            )

        return {
            "id": logical_note_id,
            "title": meta.get("title", "Untitled"),
            "folder": meta.get("folder", ""),
            "tags": _flatten_tags(meta.get("tags", "")),
            "participants": _flatten_tags(meta.get("participants", "")),
            "created": created,
            "modified": meta.get("modified", ""),
            "source": meta.get("source", ""),
            "source_id": source_id,
            "content": content,
            "calendar_events": calendar_events,
            "similar_notes": similar_notes,
        }

    @mcp.tool()
    def get_recent_notes(days: int) -> dict[str, Any]:
        """Return all notes created within the last N days.

        Args:
            days: Number of days to look back (e.g., 7 for last week).
        """
        if days < 1:
            return {"notes": []}
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        unique = store.get_unique_notes(include=["metadatas"])
        notes: list[dict[str, Any]] = []
        for i, meta in enumerate(unique.get("metadatas", [])):
            if not meta:
                continue
            created = meta.get("created", "")
            if not created or created < cutoff:
                continue
            nid = meta.get("note_id", unique["ids"][i]) if i < len(unique["ids"]) else ""
            notes.append(_note_from_unique(meta, nid))
        notes.sort(key=lambda n: n.get("created", ""), reverse=True)
        return {"notes": notes}

    @mcp.tool()
    def list_tags() -> dict[str, Any]:
        """Return all tags with occurrence counts and co-occurrence data."""
        tags, co = store.get_tags()
        return {
            "tags": [t.model_dump() for t in tags],
            "co_occurrence": [c.model_dump() for c in co],
        }

    @mcp.tool()
    def get_notes_by_tag(tag: str, limit: int = 20) -> dict[str, Any]:
        """Return notes that have a specific tag.

        Args:
            tag: The tag to filter by (exact match, case-insensitive).
            limit: Maximum number of notes to return (default 20).
        """
        raw = store.get_notes_by_tag(tag, n=limit * 5)
        deduped = normalize_and_dedup_results(raw)
        notes: list[dict[str, Any]] = []
        for entry in deduped[:limit]:
            meta = entry["metadata"]
            notes.append(_note_from_unique(meta, entry["note_id"]))
        return {"notes": notes}

    @mcp.tool()
    def get_stats() -> dict[str, Any]:
        """Return collection-level statistics: total notes, tags, date range, etc."""
        return store.get_stats().model_dump()

    @mcp.tool()
    def get_calendar_events(date: str | None = None) -> dict[str, Any]:
        """Return calendar events. If date is provided, return events for that day.

        Args:
            date: Optional date string in YYYY-MM-DD format.
        """
        if calendar_processor is None:
            return {"events": []}
        try:
            if date:
                events = calendar_processor.get_events_for_date(date)
            else:
                events = calendar_processor.process_events()
            return {"events": [e.model_dump() for e in events]}
        except Exception as e:
            logger.warning("Failed to get calendar events: %s", e)
            return {"events": []}

    @mcp.tool()
    def find_similar_notes(note_id: str, limit: int = 5) -> dict[str, Any]:
        """Find semantically similar notes to the given note.

        Args:
            note_id: The note ID to find similar notes for.
            limit: Maximum number of similar notes (default 5).
        """
        similar = store.get_similar(note_id, n=limit + 5)
        if not similar:
            note = store.get_note_by_note_id(note_id)
            if note:
                similar = store.get_similar(note.id, n=limit + 5)
        deduped = normalize_and_dedup_results(similar)
        notes: list[dict[str, Any]] = []
        for entry in deduped:
            nid = entry["note_id"]
            if nid == note_id:
                continue
            meta = entry["metadata"]
            notes.append(
                {
                    "id": nid,
                    "title": meta.get("title", "Untitled"),
                    "score": entry["score"],
                }
            )
            if len(notes) >= limit:
                break
        return {"notes": notes}

    @mcp.tool()
    def get_series_history(series_name: str, limit: int = 10) -> dict[str, Any]:
        """Return recent notes in a specific series, frontmatter only (no body).

        Args:
            series_name: The canonical series name.
            limit: Maximum number of notes to return (default 10).
        """
        notes = store.get_notes_by_series(series_name, limit=limit)
        return {
            "series": series_name,
            "notes": [_note_from_unique(n.metadata.model_dump(), n.id) for n in notes],
        }

    @mcp.tool()
    def lookup_person(name: str) -> dict[str, Any]:
        """Fuzzy lookup over participants across all notes. Returns matching people with frequency.

        Args:
            name: Partial name to search for (e.g., 'tiffany' or 'Alan').
        """
        people = store.get_people_by_query(q=name)
        return {
            "people": [
                {
                    "name": p.name,
                    "frequency": p.frequency,
                }
                for p in people
            ],
        }

    @mcp.tool()
    def lookup_glossary(term: str) -> dict[str, Any]:
        """Look up tag definitions and context from the corpus.

        Args:
            term: Glossary term to look up (e.g., 'MHQOL').
        """
        entries = store.get_glossary_entries(q=term)
        return {
            "entries": [
                {
                    "term": e.term,
                    "definition": e.definition,
                    "frequency": e.frequency,
                    "source_note_ids": e.source_note_ids,
                }
                for e in entries
            ],
        }

    @mcp.tool()
    def list_series() -> dict[str, Any]:
        """List all distinct series across the corpus with counts."""
        series_list = store.get_series_list()
        return {"series": [s.model_dump() for s in series_list]}

    @mcp.tool()
    def search_similar_text(text: str, limit: int = 10) -> dict[str, Any]:
        """Given raw text (e.g., a Zoom transcript paste), return the K most similar prior notes.

        Args:
            text: Raw text to find similar notes for.
            limit: Maximum number of notes to return (default 10).
        """
        if not text.strip():
            return {"notes": []}
        embedding = embed_query_sync(text)
        raw = store.search_notes(embedding, n=limit * 3)
        deduped = normalize_and_dedup_results(raw)
        notes = []
        for entry in deduped[:limit]:
            meta = entry["metadata"]
            notes.append(_note_from_unique(meta, entry["note_id"]))
        return {"notes": notes}

    @mcp.tool()
    def get_notes_since(timestamp: str) -> dict[str, Any]:
        """Return notes created or modified since an ISO timestamp.

        Args:
            timestamp: ISO format timestamp (e.g., '2024-01-01T00:00:00Z').
        """
        notes = store.get_notes_since(timestamp, limit=100)
        return {
            "since": timestamp,
            "notes": [_note_from_unique(n.metadata.model_dump(), n.id) for n in notes],
        }

    @mcp.resource("notes://stats")
    def resource_stats() -> str:
        """Collection statistics overview."""
        stats = store.get_stats()
        return (
            f"Total notes: {stats.total_notes}\n"
            f"Total tags: {stats.total_tags}\n"
            f"Total calendar events: {stats.total_calendar_events}\n"
            f"Date range: {stats.date_range}\n"
            f"Avg note length: {stats.avg_note_length} chars"
        )

    @mcp.resource("notes://recent")
    def resource_recent() -> str:
        """Notes created in the last 7 days."""
        result = get_recent_notes(7)
        notes = result.get("notes", [])
        if not notes:
            return "No notes found in the last 7 days."
        lines = [f"Notes from the last 7 days ({len(notes)} total):", ""]
        for n in notes:
            lines.append(f"- {n['title']} ({n.get('created', '')[:10]})")
        return "\n".join(lines)

    @mcp.resource("notes://recent/{days}")
    def resource_recent_days(days: str) -> str:
        """Notes created in the last N days."""
        d = int(days) if days.isdigit() else 7
        result = get_recent_notes(d)
        notes = result.get("notes", [])
        if not notes:
            return f"No notes found in the last {d} days."
        lines = [f"Notes from the last {d} days ({len(notes)} total):", ""]
        for n in notes:
            lines.append(f"- {n['title']} ({n.get('created', '')[:10]})")
        return "\n".join(lines)

    @mcp.resource("notes://note/{note_id}")
    def resource_note(note_id: str) -> str:
        """Full content of a single note."""
        note = get_note(note_id)
        if not note:
            return f"Note '{note_id}' not found."
        lines = [
            f"Title: {note['title']}",
            f"Folder: {note['folder']}",
            f"Tags: {', '.join(note.get('tags', []))}",
            f"Participants: {', '.join(note.get('participants', []))}",
            f"Created: {note.get('created', '')}",
            f"Modified: {note.get('modified', '')}",
            f"Source: {note.get('source', '')}",
            "",
            note.get("content", ""),
        ]
        return "\n".join(lines)

    @mcp.resource("notes://search/{query}")
    def resource_search(query: str, limit: int = 5) -> str:
        """Semantic search results for a query."""
        result = search_notes(query, limit=limit)
        notes = result.get("notes", [])
        if not notes:
            return f"No results found for: {query}"
        lines = [f'Search results for "{query}" ({len(notes)} notes):', ""]
        for n in notes:
            lines.append(f"- {n['title']} [{', '.join(n.get('tags', [])[:5])}]")
        return "\n".join(lines)

    @mcp.resource("notes://tags")
    def resource_tags() -> str:
        """List of all tags sorted by frequency."""
        result = list_tags()
        tags = result.get("tags", [])
        if not tags:
            return "No tags found."
        lines = [f"{t['name']}: {t['count']}" for t in tags[:50]]
        return "\n".join(lines)

    @mcp.resource("notes://series")
    def resource_series() -> str:
        """List of all distinct series sorted by frequency."""
        series_list = store.get_series_list()
        if not series_list:
            return "No series found."
        lines = [f"{s.name}: {s.count} notes (latest: {s.latest_date[:10] if s.latest_date else 'unknown'})" for s in series_list[:50]]
        return "\n".join(lines)

    @mcp.resource("notes://series/{series_name}")
    def resource_series_notes(series_name: str) -> str:
        """Notes in a specific series."""
        notes = store.get_notes_by_series(series_name, limit=20)
        if not notes:
            return f"No notes found in series '{series_name}'."
        lines = [f"Series: {series_name}", ""]
        for n in notes:
            lines.append(f"- {n.title} ({n.metadata.created[:10] if n.metadata.created else 'unknown date'})")
        return "\n".join(lines)

    @mcp.prompt()
    def summarize_recent(days: int = 7) -> str:
        """Prompt: Summarize all notes from the last N days.

        Args:
            days: Number of days to look back.
        """
        return f"Please summarize the key themes, people, and events in notes from the last {days} days."

    @mcp.prompt()
    def find_connections(person: str) -> str:
        """Prompt: Find notes related to a specific person.

        Args:
            person: Name of the person to look for (e.g. 'Alice' or 'Bob Smith').
        """
        return (
            f"Search for notes mentioning {person}. "
            f"Summarize their context: what projects, topics, or events are they connected to? "
            f"Identify any other people frequently mentioned alongside {person}."
        )

    @mcp.prompt()
    def search_for_context(query: str) -> str:
        """Prompt: Find notes relevant to a query and summarize connections.
        Useful for cross-referencing before summarizing.

        Args:
            query: Search query to find relevant prior discussions.
        """
        return f"Search for notes about '{query}'. Identify prior discussions, resolutions, and related concepts. Cross-reference with any similar or connected notes to provide a richer context summary."

    return mcp


def main():
    from store import NoteStore
    from calendar_data import CalendarProcessor

    store = NoteStore()
    cal = CalendarProcessor()
    cal.load()

    mcp = setup_mcp(store, calendar_processor=cal)
    mcp.run()


if __name__ == "__main__":
    main()

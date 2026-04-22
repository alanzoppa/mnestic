from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

import frontmatter
from fastmcp import FastMCP

if TYPE_CHECKING:
    from store import NoteStore

from utils import _normalize_meta

NOTES_DIR = os.path.join(os.path.dirname(__file__), "..", "notes")


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


def _is_safe_filename(name: str) -> bool:
    """Reject names with path traversal attempts."""
    if not name:
        return False
    return ".." not in name and "/" not in name and "\\" not in name and "\x00" not in name


def _find_note_file(source_id: str, note_id: str) -> str | None:
    for ext in (".md", ".txt", ""):
        if _is_safe_filename(source_id):
            candidate = os.path.join(NOTES_DIR, source_id + ext)
            if os.path.exists(candidate):
                return candidate
    for ext in (".md", ".txt", ""):
        if _is_safe_filename(note_id):
            candidate = os.path.join(NOTES_DIR, note_id + ext)
            if os.path.exists(candidate):
                return candidate
    return None


def setup_mcp(store: NoteStore, calendar_processor: Any | None = None) -> FastMCP:
    from embed import embed_query_sync

    mcp = FastMCP("notes-browser")

    @mcp.tool()
    def search_notes(query: str, limit: int = 10) -> dict[str, Any]:
        """Search notes using semantic search (embedding-based).

        Args:
            query: The search query string.
            limit: Maximum number of unique notes to return (default 10).
        """
        if not query.strip():
            return {"notes": []}
        embedding = embed_query_sync(query)
        raw = store.search_notes(embedding, n=limit * 5)
        seen: set[str] = set()
        notes: list[dict[str, Any]] = []
        for r in raw:
            meta = r.get("metadata", {})
            _normalize_meta(meta)
            nid = meta.get("note_id", r["id"])
            if nid in seen:
                continue
            seen.add(nid)
            notes.append(_note_from_unique(meta, nid))
            if len(notes) >= limit:
                break
        return {"notes": notes}

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

        meta = note.get("metadata", {})
        _normalize_meta(meta)
        source_id = meta.get("source_id", "")

        content = ""
        note_file = _find_note_file(source_id, note_id)
        if note_file and os.path.exists(note_file):
            try:
                post = frontmatter.load(note_file)
                content = post.content
            except Exception:
                pass

        created = meta.get("created", "")
        date_str = created[:10] if created else ""
        calendar_events = []
        if date_str and calendar_processor is not None:
            try:
                calendar_events = calendar_processor.get_events_for_date(date_str)
            except Exception:
                pass

        similar = store.get_similar(note["id"], n=10)
        similar_notes = []
        seen_similar: set[str] = set()
        logical_note_id = meta.get("note_id", note["id"])
        for s in similar:
            if s.get("distance") is None:
                continue
            s_meta = s.get("metadata", {})
            _normalize_meta(s_meta)
            s_nid = s_meta.get("note_id", s["id"])
            if s_nid == logical_note_id or s_nid in seen_similar:
                continue
            seen_similar.add(s_nid)
            similar_notes.append({
                "id": s_nid,
                "title": s_meta.get("title", ""),
                "score": 1 - s["distance"],
            })

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
            "tags": tags,
            "co_occurrence": co,
        }

    @mcp.tool()
    def get_notes_by_tag(tag: str, limit: int = 20) -> dict[str, Any]:
        """Return notes that have a specific tag.

        Args:
            tag: The tag to filter by (exact match, case-insensitive).
            limit: Maximum number of notes to return (default 20).
        """
        raw = store.get_notes_by_tag(tag, n=limit * 5)
        seen: set[str] = set()
        notes: list[dict[str, Any]] = []
        for r in raw:
            meta = r.get("metadata", {})
            _normalize_meta(meta)
            nid = meta.get("note_id", r["id"])
            if nid in seen:
                continue
            seen.add(nid)
            notes.append(_note_from_unique(meta, nid))
            if len(notes) >= limit:
                break
        return {"notes": notes}

    @mcp.tool()
    def get_stats() -> dict[str, Any]:
        """Return collection-level statistics: total notes, tags, date range, etc."""
        return store.get_stats()

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
            return {"events": events}
        except Exception:
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
                similar = store.get_similar(note["id"], n=limit + 5)
        seen: set[str] = set()
        notes: list[dict[str, Any]] = []
        for s in similar:
            if s.get("distance") is None:
                continue
            meta = s.get("metadata", {})
            _normalize_meta(meta)
            nid = meta.get("note_id", s["id"])
            if nid == note_id or nid in seen:
                continue
            seen.add(nid)
            notes.append({
                "id": nid,
                "title": meta.get("title", "Untitled"),
                "score": 1 - s["distance"],
            })
            if len(notes) >= limit:
                break
        return {"notes": notes}

    @mcp.resource("notes://stats")
    def resource_stats() -> str:
        """Collection statistics overview."""
        stats = store.get_stats()
        return (
            f"Total notes: {stats.get('total_notes', 0)}\n"
            f"Total tags: {stats.get('total_tags', 0)}\n"
            f"Total calendar events: {stats.get('total_calendar_events', 0)}\n"
            f"Date range: {stats.get('date_range', [None, None])}\n"
            f"Avg note length: {stats.get('avg_note_length', 0)} chars"
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

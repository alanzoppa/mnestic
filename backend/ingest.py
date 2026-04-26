import os
import json
import re
import hashlib
import frontmatter
from datetime import datetime
from pathlib import Path
from typing import Any

from langchain_text_splitters import MarkdownTextSplitter

from embed import embed_texts_sync, BATCH_SIZE
from store import NoteStore
from calendar_data import CalendarProcessor, CALENDAR_EXPORT_PATH, PEOPLE_REGISTRY_PATH


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
    sanitized = re.sub(r'[:/]+', '-', source_id)
    sanitized = sanitized.strip('-')
    return sanitized


def make_doc_id(note_id: str, chunk_index: int, filename: str) -> str:
    return f"{note_id}_chunk_{chunk_index}"


def _normalize_tags_participants(fm: dict) -> tuple[list[str], list[str]]:
    tags = fm.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    participants = fm.get("participants", [])
    if isinstance(participants, str):
        participants = [p.strip() for p in participants.split(",") if p.strip()]
    return tags, participants


def build_note_chunks(
    note_id: str,
    fm: dict,
    body: str,
    filename: str,
    calendar_context: str = "",
) -> tuple[list[str], list[dict], list[str]]:
    """Return (chunks, metadatas, ids) for a note ready to embed.

    Tier 1: title + folder + tags + participants + first ~2k chars + optional calendar context.
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
                }
                chunks.append(chunk)
                metadatas.append(chunk_metadata)
                ids.append(chunk_id)

    return chunks, metadatas, ids


def get_calendar_context(
    note_participants: list[str],
    created_str: str,
    calendar_events: list[dict],
) -> str:
    if not note_participants or not created_str:
        return ""
    note_date = created_str[:10]
    if not note_date:
        return ""
    relevant = []
    for event in calendar_events:
        if event.get("date") != note_date:
            continue
        attendees_str = event.get("attendees", "")
        attendee_list = [a.strip() for a in attendees_str.split(",") if a.strip()]
        has_overlap = any(
            p in attendee_list or any(p.lower() in a.lower() for a in attendee_list)
            for p in note_participants
        )
        if has_overlap:
            summary = event.get("summary", "Event")
            relevant.append(f"{summary} ({note_date})")
    if relevant:
        return "\n\nCalendar context: " + ", ".join(relevant)
    return ""


def ingest_notes(notes_dir: str, store: NoteStore, force: bool = False) -> dict:
    notes_path = Path(notes_dir)
    state_file = notes_path / ".ingest_state.json"

    ingest_state = {"last_ingest": "", "files": {}}
    if state_file.exists() and not force:
        try:
            ingest_state = json.loads(state_file.read_text())
        except (json.JSONDecodeError, IOError):
            pass

    cal = CalendarProcessor()
    cal.load()
    calendar_events = cal.process_events()

    all_files = [f for f in notes_path.iterdir() if f.suffix == ".md" and f.name != ".ingest_state.json"]
    notes_ingested = 0
    notes_skipped = 0
    chunks_created = 0
    errors = []

    all_chunks = []
    all_metadata = []
    all_ids = []

    ids_to_delete = []

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
                    continue

            tags, participants = _normalize_tags_participants(fm)
            created_val = fm.get("created", "")
            created_str = created_val.isoformat() if hasattr(created_val, "isoformat") else (str(created_val) if created_val else "")
            calendar_context = get_calendar_context(participants, created_str, calendar_events)

            chunks, metadatas, ids = build_note_chunks(
                note_id, fm, body, md_file.name, calendar_context=calendar_context
            )
            all_chunks.extend(chunks)
            all_metadata.extend(metadatas)
            all_ids.extend(ids)
            ids_to_delete.append(note_id)
            chunks_created += len(chunks)
            notes_ingested += 1

            ingest_state.setdefault("files", {})[note_id] = {
                "mtime": current_mtime,
                "chunks": len(chunks),
            }

        except Exception as e:
            errors.append(f"{md_file.name}: {str(e)}")

    for note_id_prefix in ids_to_delete:
        try:
            existing = store._notes.get(
                where={"note_id": note_id_prefix},
                include=["metadatas"],
            )
            if existing["ids"]:
                store.delete_notes(existing["ids"])
        except Exception:
            pass

    for i in range(0, len(all_chunks), BATCH_SIZE):
        batch_texts = all_chunks[i:i + BATCH_SIZE]
        batch_ids = all_ids[i:i + BATCH_SIZE]
        batch_metadata = all_metadata[i:i + BATCH_SIZE]

        try:
            embeddings = embed_texts_sync(batch_texts)
            if embeddings:
                store.add_notes(batch_ids, batch_texts, embeddings, batch_metadata)
        except Exception as e:
            errors.append(f"Embedding batch {i}: {str(e)}")

    ingest_state["last_ingest"] = datetime.utcnow().isoformat() + "Z"
    try:
        state_file.write_text(json.dumps(ingest_state, indent=2))
    except IOError as e:
        errors.append(f"State file error: {str(e)}")

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
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()
    errors = []
    events_ingested = 0

    all_texts = []
    all_ids = []
    all_metadata = []

    for event in events:
        event_id = event.get("id", "")
        if not event_id:
            continue

        embedding_text = cal.get_embedding_text(event)
        if not embedding_text:
            continue

        cal_id = f"cal_{event_id}"
        metadata = {
            "date": event.get("date", ""),
            "summary": event.get("summary", ""),
            "location": event.get("location", ""),
            "attendees": event.get("attendees", ""),
            "event_type": event.get("event_type", "default"),
        }

        all_texts.append(embedding_text)
        all_ids.append(cal_id)
        all_metadata.append(metadata)

    for i in range(0, len(all_texts), BATCH_SIZE):
        batch_texts = all_texts[i:i + BATCH_SIZE]
        batch_ids = all_ids[i:i + BATCH_SIZE]
        batch_metadata = all_metadata[i:i + BATCH_SIZE]

        try:
            embeddings = embed_texts_sync(batch_texts)
            if embeddings:
                store.add_calendar_events(batch_ids, batch_texts, embeddings, batch_metadata)
                events_ingested += len(batch_ids)
        except Exception as e:
            errors.append(f"Calendar batch {i}: {str(e)}")

    return {
        "events_ingested": events_ingested,
        "errors": errors,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--notes-dir", default=os.path.join(os.path.dirname(__file__), "..", "notes"))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--calendar-only", action="store_true")
    args = parser.parse_args()

    store = NoteStore()

    if args.calendar_only:
        result = ingest_calendar(store)
    else:
        result = ingest_notes(args.notes_dir, store, force=args.force)
    print(json.dumps(result, indent=2))

import os
import re
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import frontmatter
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from embed import embed_texts_sync
from embed import embed_query_sync
from store import NoteStore
from schema import discover_schema
from ingest import make_note_id, make_doc_id, chunk_text

NOTES_DIR = os.path.join(os.path.dirname(__file__), "..", "notes")

app = FastAPI(title="Notes Browser API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for images
images_dir = os.path.join(NOTES_DIR, "images")
if os.path.exists(images_dir):
    app.mount("/images", StaticFiles(directory=images_dir), name="images")

store = NoteStore()

calendar_processor: Any = None


def get_calendar():
    global calendar_processor
    if calendar_processor is None:
        from calendar_data import CalendarProcessor

        calendar_processor = CalendarProcessor()
        calendar_processor.load()
    return calendar_processor


_source_id_to_file: dict[str, str] = {}


def _build_source_id_cache() -> None:
    global _source_id_to_file
    if _source_id_to_file:
        return
    for f in os.listdir(NOTES_DIR):
        if not f.endswith(".md"):
            continue
        try:
            post = frontmatter.load(os.path.join(NOTES_DIR, f))
            sid = post.get("source_id", "")
            if sid:
                _source_id_to_file[sid] = f
        except Exception:
            continue


def find_note_file(source_id: str) -> str | None:
    _build_source_id_cache()
    filename = _source_id_to_file.get(source_id)
    if filename:
        return os.path.join(NOTES_DIR, filename)
    # Fallback: try matching source_id or note_id directly as a filename
    for ext in (".md", ".txt", ""):
        candidate = os.path.join(NOTES_DIR, source_id + ext)
        if os.path.exists(candidate):
            return candidate
    return None


def _invalidate_source_id_cache() -> None:
    global _source_id_to_file
    _source_id_to_file = {}


def _sanitize_filename(title: str) -> str:
    sanitized = re.sub(r'[:/\\]', '-', title)
    sanitized = sanitized.strip()
    if not sanitized:
        sanitized = "untitled"
    base = sanitized[:200]
    filepath = os.path.join(NOTES_DIR, f"{base}.md")
    if not os.path.exists(filepath):
        return base
    for i in range(2, 100):
        candidate = f"{base}__{i}"
        if not os.path.exists(os.path.join(NOTES_DIR, f"{candidate}.md")):
            return candidate
    return base


def _normalize_meta(meta: dict) -> dict:
    if "tags" in meta and isinstance(meta["tags"], str):
        meta["tags"] = [t.strip() for t in meta["tags"].split(",") if t.strip()]
    if "participants" in meta and isinstance(meta["participants"], str):
        meta["participants"] = [p.strip() for p in meta["participants"].split(",") if p.strip()]


class SearchRequest(BaseModel):
    query: str
    filters: dict = {}
    n: int = 20
    include_calendar: bool = True


class UpdateNoteRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    participants: list[str] | None = None


class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    metadata: dict
    score: float
    type: str


class IngestRequest(BaseModel):
    full: bool = False


@app.post("/api/search")
async def search(body: SearchRequest) -> dict:
    filters = body.filters
    tag_filter = filters.get("tags", "")

    where_clauses: list[dict] = []
    if filters.get("source"):
        where_clauses.append({"source": {"$eq": filters["source"]}})
    if filters.get("folder"):
        where_clauses.append({"folder": {"$eq": filters["folder"]}})
    if filters.get("date_gte"):
        where_clauses.append({"created": {"$gte": filters["date_gte"]}})
    if filters.get("date_lte"):
        where_clauses.append({"created": {"$lte": filters["date_lte"]}})

    where = None
    if len(where_clauses) == 1:
        where = where_clauses[0]
    elif len(where_clauses) > 1:
        where = {"$and": where_clauses}

    if body.query.strip() or not tag_filter:
        query_embedding = embed_query_sync(body.query)
        n_results = body.n * 10 if tag_filter else body.n
        note_results = store.search_notes(query_embedding, n=n_results, where=where)
        if tag_filter:
            tag_set = {t.strip().lower() for t in tag_filter.split(",") if t.strip()}
            note_results = [
                r for r in note_results
                if tag_set & {t.strip().lower() for t in r["metadata"].get("tags", "").split(",") if t.strip()}
            ]
            note_results = note_results[:body.n]
    else:
        note_results = store.get_notes_by_tag(tag_filter, n=body.n, where=where)

    all_results: list[dict] = []
    for r in note_results:
        meta = r["metadata"]
        _normalize_meta(meta)
        all_results.append(
            {
                "id": r["id"],
                "title": meta.get("title", ""),
                "snippet": r["document"][:200] if r["document"] else "",
                "metadata": meta,
                "score": r.get("score", 0.0),
                "type": "note",
            }
        )

    if body.include_calendar and body.query.strip():
        query_embedding = embed_query_sync(body.query)
        calendar_results = store.search_calendar(query_embedding, n=body.n)
        for r in calendar_results:
            all_results.append(
                {
                    "id": r["id"],
                    "title": r["metadata"].get("summary", ""),
                    "snippet": r["document"][:200] if r["document"] else "",
                    "metadata": r["metadata"],
                    "score": 1 - r["distance"] if r.get("distance") is not None else 0.0,
                    "type": "calendar",
                }
            )

    id_to_best: dict[str, dict] = {}
    seen_note_ids: dict[str, dict] = {}
    for r in all_results:
        rid = r["id"]
        rmeta = r.get("metadata", {})
        note_id = rmeta.get("note_id", rid)
        r["note_id"] = note_id
        if note_id in seen_note_ids:
            if r["score"] > seen_note_ids[note_id]["score"]:
                seen_note_ids[note_id] = r
        else:
            seen_note_ids[note_id] = r

    return {"results": list(seen_note_ids.values())}


@app.get("/api/notes/{note_id}")
async def get_note(note_id: str) -> dict:
    note = store.get_note(note_id)
    if not note:
        note = store.get_note_by_note_id(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    metadata = note["metadata"]
    _normalize_meta(metadata)
    source_id = metadata.get("source_id", "")
    logical_note_id = metadata.get("note_id", note["id"])

    content = ""
    note_file = find_note_file(source_id)
    if note_file and os.path.exists(note_file):
        post = frontmatter.load(note_file)
        content = post.content

    created = metadata.get("created", "")
    date_str = created[:10] if created else ""

    calendar_events = []
    if date_str:
        cal = get_calendar()
        calendar_events = cal.get_events_for_date(date_str)

    similar = store.get_similar(note["id"], n=10)
    similar_notes = []
    seen_similar = set()
    for s in similar:
        if s.get("distance") is None:
            continue
        s_meta = s["metadata"]
        _normalize_meta(s_meta)
        s_note_id = s_meta.get("note_id", s["id"])
        if s_note_id == logical_note_id or s_note_id in seen_similar:
            continue
        seen_similar.add(s_note_id)
        similar_notes.append({
            "id": s["id"],
            "note_id": s_note_id,
            "title": s_meta.get("title", ""),
            "score": 1 - s["distance"],
            "created": s_meta.get("created", ""),
        })

    return {
        "id": logical_note_id,
        "metadata": metadata,
        "content": content,
        "calendar_events": calendar_events,
        "similar_notes": similar_notes,
    }


def _reingest_note(note_id: str, md_path: str) -> None:
    store.delete_note_chunks(note_id)
    post = frontmatter.load(md_path)
    fm = post.metadata
    body = post.content
    source_id = fm.get("source_id", "")
    title = fm.get("title", "")
    folder = fm.get("folder", "")
    tags = fm.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    tags_str = ",".join(tags) if tags else ""
    participants = fm.get("participants", [])
    if isinstance(participants, str):
        participants = [p.strip() for p in participants.split(",") if p.strip()]
    participants_str = ",".join(participants) if participants else ""
    created_str = fm.get("created", "")
    modified_str = fm.get("modified", "")
    source = fm.get("source", "Apple Notes")

    tier1_text = f"Title: {title}\nFolder: {folder}\nTags: {tags_str}\nParticipants: {participants_str}\n\n{body[:2000]}"
    chunk_id_0 = make_doc_id(note_id, 0, os.path.basename(md_path))
    tier1_metadata = {
        "note_id": note_id,
        "filename": os.path.basename(md_path),
        "chunk_index": 0,
        "title": title,
        "folder": folder,
        "tags": tags_str,
        "participants": participants_str,
        "created": created_str,
        "modified": modified_str,
        "source": source,
        "source_id": source_id,
    }

    chunks = [tier1_text]
    metadatas = [tier1_metadata]
    ids = [chunk_id_0]

    if len(body) > 2000:
        remainder = body[1600:]
        for i, chunk in enumerate(chunk_text(remainder, 2000, 400)):
            if chunk.strip():
                chunk_index = i + 1
                chunks.append(chunk)
                metadatas.append({
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
                })
                ids.append(make_doc_id(note_id, chunk_index, os.path.basename(md_path)))

    embeddings = embed_texts_sync(chunks)
    if embeddings:
        store.add_notes(ids, chunks, embeddings, metadatas)


@app.patch("/api/notes/{note_id}")
async def update_note(note_id: str, body: UpdateNoteRequest) -> dict:
    if all(v is None for v in [body.title, body.content, body.tags, body.participants]):
        raise HTTPException(status_code=422, detail="No fields to update")

    note = store.get_note(note_id)
    if not note:
        note = store.get_note_by_note_id(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    metadata = note["metadata"]
    _normalize_meta(metadata)
    source_id = metadata.get("source_id", "")

    md_path = find_note_file(source_id)
    if not md_path or not os.path.exists(md_path):
        raise HTTPException(status_code=404, detail="Note file not found on disk")

    try:
        post = frontmatter.load(md_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read note file: {e}")

    renamed = False
    new_path = md_path

    if body.title is not None:
        post.metadata["title"] = body.title
        new_base = _sanitize_filename(body.title)
        new_filename = f"{new_base}.md"
        new_path = os.path.join(NOTES_DIR, new_filename)
        renamed = new_path != md_path

    if body.content is not None:
        pass

    if body.tags is not None:
        post.metadata["tags"] = body.tags

    if body.participants is not None:
        post.metadata["participants"] = body.participants

    post.metadata["modified"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    logical_note_id = metadata.get("note_id", note_id)

    try:
        if renamed:
            with open(new_path, "wb") as f:
                frontmatter.dump(post, f, allow_unicode=True)
            os.remove(md_path)
        else:
            with open(md_path, "wb") as f:
                frontmatter.dump(post, f, allow_unicode=True)

        _invalidate_source_id_cache()
        _reingest_note(logical_note_id, new_path if renamed else md_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save note: {e}")

    updated_note = store.get_note_by_note_id(logical_note_id)
    updated_meta = updated_note["metadata"] if updated_note else {}
    _normalize_meta(updated_meta)
    updated_source_id = updated_meta.get("source_id", "")
    updated_md_path = find_note_file(updated_source_id)
    updated_content = ""
    if updated_md_path and os.path.exists(updated_md_path):
        updated_content = frontmatter.load(updated_md_path).content

    return {
        "id": logical_note_id,
        "metadata": updated_meta,
        "content": updated_content,
    }


PEOPLE_REGISTRY_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "Desktop", "notes", "people_registry.json"
)
if not os.path.exists(PEOPLE_REGISTRY_PATH):
    PEOPLE_REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "people_registry.json")


@app.get("/api/people")
async def get_people() -> dict:
    if not os.path.exists(PEOPLE_REGISTRY_PATH):
        return {"people": []}
    try:
        with open(PEOPLE_REGISTRY_PATH, "r") as f:
            data = json.load(f)
        people = []
        for name, info in data.items():
            if name.startswith("_"):
                continue
            people.append({
                "name": name,
                "aliases": info.get("aliases", []),
                "context": info.get("context", ""),
            })
        return {"people": people}
    except Exception:
        return {"people": []}


@app.get("/api/tags")
async def get_tags() -> dict:
    tags, co_occurrence = store.get_tags()
    return {"tags": tags, "co_occurrence": co_occurrence}


@app.get("/api/timeline")
async def get_timeline(group_by: str = "month", tag: str | None = None) -> dict:
    periods = store.get_timeline(group_by=group_by, tag=tag)
    return {"periods": periods}


@app.get("/api/similar/{note_id}")
async def get_similar_notes(note_id: str, n: int = 10, threshold: float = 0.75) -> dict:
    similar = store.get_similar(note_id, n=n, threshold=threshold)
    query_note = store.get_note(note_id) or store.get_note_by_note_id(note_id)
    query_note_id = query_note["metadata"].get("note_id", note_id) if query_note else note_id
    seen = {query_note_id}
    notes = []
    for s in similar:
        if s.get("distance") is not None and (1 - s["distance"]) >= threshold:
            s_meta = s["metadata"]
            _normalize_meta(s_meta)
            s_nid = s_meta.get("note_id", s["id"])
            if s_nid in seen:
                continue
            seen.add(s_nid)
            notes.append({
                "id": s["id"],
                "note_id": s_nid,
                "title": s_meta.get("title", ""),
                "score": 1 - s["distance"],
                "created": s_meta.get("created", ""),
            })
    return {"notes": notes}


@app.post("/api/ingest")
async def ingest(body: IngestRequest) -> dict:
    import asyncio
    from ingest import ingest_notes, ingest_calendar

    if body.full:
        store.reset()
        state_file = Path(NOTES_DIR) / ".ingest_state.json"
        if state_file.exists():
            state_file.unlink()

    loop = asyncio.get_event_loop()
    notes_result = await loop.run_in_executor(None, ingest_notes, NOTES_DIR, store, body.full)
    calendar_result = await loop.run_in_executor(None, ingest_calendar, store)

    return {"notes_result": notes_result, "calendar_result": calendar_result}


@app.get("/api/graph")
async def get_graph(tag: str | None = None, folder: str | None = None, n_neighbors: int = 3, threshold: float = 0.75) -> dict:
    where_clauses = []
    if tag:
        where_clauses.append({"tags": {"$contains": tag}})
    if folder:
        where_clauses.append({"folder": {"$eq": folder}})
    where = None
    if len(where_clauses) == 1:
        where = where_clauses[0]
    elif len(where_clauses) > 1:
        where = {"$and": where_clauses}

    if tag and not where:
        all_notes = store._notes.get(include=["metadatas"])
        filtered_ids = []
        for i, meta in enumerate(all_notes.get("metadatas", [])):
            if not meta:
                continue
            note_tags = {t.strip().lower() for t in meta.get("tags", "").split(",") if t.strip()}
            if tag.lower() in note_tags:
                filtered_ids.append(all_notes["ids"][i])
        if filtered_ids:
            where_clause_ids = filtered_ids[:100]
        else:
            where_clause_ids = []
    else:
        where_clause_ids = None

    sample_ids = where_clause_ids if where_clause_ids else None
    if sample_ids and len(sample_ids) > 500:
        sample_ids = sample_ids[:500]

    all_meta = {}
    if sample_ids:
        batch = store._notes.get(ids=sample_ids, include=["metadatas"])
        seen_note_ids = set()
        for i, mid in enumerate(batch["ids"]):
            meta = batch["metadatas"][i] if batch["metadatas"] else {}
            _normalize_meta(meta)
            nid = meta.get("note_id", mid)
            if nid in seen_note_ids:
                continue
            seen_note_ids.add(nid)
            all_meta[mid] = meta
    else:
        all_data = store._notes.get(include=["metadatas"])
        seen_note_ids = set()
        for i, mid in enumerate(all_data["ids"]):
            meta = all_data["metadatas"][i] if all_data["metadatas"] else {}
            if not meta:
                continue
            if tag:
                note_tags = {t.strip().lower() for t in meta.get("tags", "").split(",") if t.strip()}
                if tag.lower() not in note_tags:
                    continue
            if folder and meta.get("folder", "") != folder:
                continue
            _normalize_meta(meta)
            nid = meta.get("note_id", mid)
            if nid in seen_note_ids:
                continue
            seen_note_ids.add(nid)
            all_meta[mid] = meta
            if len(all_meta) >= 500:
                break

    query_ids = list(all_meta.keys())
    if not query_ids:
        return {"nodes": [], "edges": []}

    batch_data = store._notes.get(ids=query_ids, include=["embeddings", "metadatas"])
    embeddings = batch_data.get("embeddings", [])
    if len(embeddings) == 0 or embeddings[0] is None:
        return {"nodes": [], "edges": []}

    import numpy as np
    emb_array = np.array([e for e in embeddings if e is not None])
    if len(emb_array) == 0:
        return {"nodes": [], "edges": []}

    norms = np.linalg.norm(emb_array, axis=1, keepdims=True)
    norms[norms == 0] = 1
    emb_normed = emb_array / norms
    sim_matrix = emb_normed @ emb_normed.T

    id_to_note_id = {}
    for mid, meta in all_meta.items():
        id_to_note_id[mid] = meta.get("note_id", mid)

    edge_set = set()
    edges = []
    for i in range(len(query_ids)):
        for j in range(i + 1, len(query_ids)):
            sim = float(sim_matrix[i][j])
            if sim >= threshold:
                src_nid = id_to_note_id.get(query_ids[i], query_ids[i])
                tgt_nid = id_to_note_id.get(query_ids[j], query_ids[j])
                if src_nid == tgt_nid:
                    continue
                pair = tuple(sorted([src_nid, tgt_nid]))
                if pair not in edge_set:
                    edge_set.add(pair)
                    edges.append({"source": pair[0], "target": pair[1], "weight": round(sim, 3)})

    connected = set()
    for e in edges:
        connected.add(e["source"])
        connected.add(e["target"])

    nodes = []
    for nid in connected:
        meta = all_meta.get(nid, {})
        nodes.append({
            "id": meta.get("note_id", nid),
            "title": meta.get("title", ""),
            "folder": meta.get("folder", ""),
            "tags": meta.get("tags", []) if isinstance(meta.get("tags"), list) else [],
            "source": meta.get("source", ""),
        })

    return {"nodes": nodes, "edges": edges}


@app.get("/api/schema")
async def get_schema() -> dict:
    return discover_schema(NOTES_DIR)


@app.get("/api/stats")
async def get_stats() -> dict:
    return store.get_stats()


@app.get("/api/calendar")
async def get_calendar_events(
    start_date: str | None = None, end_date: str | None = None, attendee: str | None = None
) -> dict:
    cal = get_calendar()
    events = cal.process_events()

    if start_date:
        events = [e for e in events if e["date"] >= start_date]
    if end_date:
        events = [e for e in events if e["date"] <= end_date]
    if attendee:
        normalized = cal.normalize_name(attendee)
        events = [e for e in events if normalized in e["attendee_names"]]

    return {"events": events}


@app.get("/api/calendar/{event_id}")
async def get_calendar_event(event_id: str) -> dict:
    cal = get_calendar()
    events = cal.process_events()

    event = None
    for e in events:
        if e["id"] == event_id:
            event = e
            break

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    date_str = event["date"]
    linked_notes = []
    seen_note_ids = set()
    if date_str:
        all_notes = store._notes.get(include=["metadatas"])
        for i, meta in enumerate(all_notes.get("metadatas", [])):
            if meta and meta.get("created", "").startswith(date_str):
                nid = meta.get("note_id", "")
                if nid and nid in seen_note_ids:
                    continue
                if nid:
                    seen_note_ids.add(nid)
                linked_notes.append(
                    {
                        "id": nid or all_notes["ids"][i],
                        "title": meta.get("title", ""),
                        "date": meta.get("created", "")[:10],
                    }
                )

    return {
        "id": event["id"],
        "summary": event["summary"],
        "start": event["start"],
        "end": event["end"],
        "location": event["location"],
        "attendees": event["attendee_names"],
        "description": event["description"],
        "linked_notes": linked_notes,
    }


@app.get("/api/calendar/date/{date}")
async def get_calendar_by_date(date: str) -> dict:
    cal = get_calendar()
    events = cal.get_events_for_date(date)

    all_notes = store._notes.get(include=["metadatas"])
    notes = []
    seen_note_ids = set()
    for i, meta in enumerate(all_notes.get("metadatas", [])):
        if meta and meta.get("created", "").startswith(date):
            nid = meta.get("note_id", "")
            if nid and nid in seen_note_ids:
                continue
            if nid:
                seen_note_ids.add(nid)
            _normalize_meta(meta)
            notes.append(
                {
                    "id": nid or all_notes["ids"][i],
                    "title": meta.get("title", ""),
                    "metadata": meta,
                }
            )

    return {"date": date, "events": events, "notes": notes}


@app.get("/api/images/{image_path:path}")
async def get_image(image_path: str):
    """Serve image files from the notes and images directories."""
    from fastapi.responses import FileResponse
    
    # Sanitize the path to prevent directory traversal
    safe_path = os.path.normpath(image_path).lstrip("/")
    if safe_path.startswith("..") or safe_path.startswith("/"):
        raise HTTPException(status_code=403, detail="Invalid image path")
    
    # Check if it's an image file before doing filesystem lookups
    allowed_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.pdf')
    if not safe_path.lower().endswith(allowed_extensions):
        raise HTTPException(status_code=403, detail="Invalid file type")
    
    # Search in: notes/, notes/../images/ (project-level images dir)
    search_dirs = [NOTES_DIR, os.path.join(NOTES_DIR, "..", "images")]
    
    for search_dir in search_dirs:
        full_path = os.path.join(search_dir, safe_path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return FileResponse(full_path)
    
    # Fallback: search recursively in each search dir by basename
    basename = os.path.basename(safe_path)
    for search_dir in search_dirs:
        for root, dirs, files in os.walk(search_dir):
            for file in files:
                if file.lower() == basename.lower():
                    full_path = os.path.join(root, file)
                    if os.path.exists(full_path) and os.path.isfile(full_path):
                        return FileResponse(full_path)
    
    raise HTTPException(status_code=404, detail="Image not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

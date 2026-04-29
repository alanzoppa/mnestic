from __future__ import annotations

import os
import re
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import frontmatter

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from constants import MAX_FILENAME_LEN, MAX_FILENAME_ATTEMPTS, MAX_GRAPH_NODES, MAX_GRAPH_WHERE_IDS, SNIPPET_MAX_LEN, DEFAULT_SIMILAR_N, DEFAULT_SIMILAR_THRESHOLD, RERANK_MAX_CANDIDATES
from embed import embed_texts_sync
from embed import embed_query_sync
from store import NoteStore
from rerank import Reranker
from schema import discover_schema
from ingest import make_note_id, make_doc_id, build_note_chunks
from utils import normalize_and_dedup_results
from graph_service import build_similarity_graph, build_similarity_graph_from_notes
from models import (
    SearchRequest,
    UpdateNoteRequest,
    IngestRequest,
    NoteMetadata,
    SearchResponse,
    NoteDetailResponse,
    UpdateNoteResponse,
    SimilarNotesResponse,
    PeopleResponse,
    TagsResponse,
    TimelineResponse,
    IngestResponse,
    GraphResponse,
    SchemaResponse,
    WatcherStatus,
    StatsResponse,
    CalendarEventsResponse,
    CalendarEventDetailResponse,
    CalendarDateResponse,
)

from watcher import NoteWatcher
from config import NOTES_DIR

note_watcher: NoteWatcher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global note_watcher
    note_watcher = NoteWatcher(NOTES_DIR, store, _invalidate_source_id_cache)
    note_watcher.start()
    yield
    if note_watcher:
        note_watcher.stop()


app = FastAPI(title="Notes Browser API", version="0.1.0", lifespan=lifespan)

logger = logging.getLogger(__name__)

store = NoteStore()

reranker = Reranker()

calendar_processor: Any = None


def get_calendar():
    global calendar_processor
    if calendar_processor is None:
        from calendar_data import CalendarProcessor
        calendar_processor = CalendarProcessor()
        try:
            calendar_processor.load()
        except Exception:
            pass
    return calendar_processor


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


_source_id_cache: dict[str, str] = {}
_source_id_cache_populated = False


def _build_source_id_cache() -> None:
    global _source_id_cache_populated
    if _source_id_cache_populated:
        return
    for f in os.listdir(NOTES_DIR):
        if not f.endswith(".md"):
            continue
        try:
            post = frontmatter.load(os.path.join(NOTES_DIR, f))
            sid = post.get("source_id", "")
            if sid:
                _source_id_cache[sid] = f
        except Exception as e:
            logger.warning("Skipping unreadable note file %s: %s", f, e)
            continue
    _source_id_cache_populated = True


def _is_safe_filename(name: str) -> bool:
    """Reject names with path traversal attempts."""
    if not name:
        return False
    return ".." not in name and "/" not in name and "\\" not in name and "\x00" not in name


def find_note_file(source_id: str) -> Optional[str]:
    _build_source_id_cache()
    filename = _source_id_cache.get(source_id)
    if filename:
        return os.path.join(NOTES_DIR, filename)
    # Fallback: try matching source_id directly as a filename (must be safe)
    if not _is_safe_filename(source_id):
        return None
    for ext in (".md", ".txt", ""):
        candidate = os.path.join(NOTES_DIR, source_id + ext)
        if os.path.exists(candidate):
            return candidate
    return None


def _invalidate_source_id_cache() -> None:
    global _source_id_cache_populated
    _source_id_cache.clear()
    _source_id_cache_populated = False


def _sanitize_filename(title: str) -> str:
    sanitized = re.sub(r'[:/\\]', '-', title)
    sanitized = sanitized.strip()
    if not sanitized:
        sanitized = "untitled"
    base = sanitized[:MAX_FILENAME_LEN]
    filepath = os.path.join(NOTES_DIR, f"{base}.md")
    if not os.path.exists(filepath):
        return base
    for i in range(2, 100):
        candidate = f"{base}__{i}"
        if not os.path.exists(os.path.join(NOTES_DIR, f"{candidate}.md")):
            return candidate
    return base


@app.post("/api/search", response_model=SearchResponse)
async def search(body: SearchRequest) -> dict:
    global reranker
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

    query_embedding = embed_query_sync(body.query) if body.query.strip() else None

    # Determine if we should rerank
    should_rerank = body.rerank and body.query.strip()

    if query_embedding is not None or not tag_filter:
        if query_embedding is not None:
            if should_rerank:
                n_results = min(body.n * 10, RERANK_MAX_CANDIDATES)
            else:
                n_results = body.n
            note_results = store.search_notes(query_embedding, n=n_results, where=where)
            if tag_filter:
                tag_set = {t.strip().lower() for t in tag_filter.split(",") if t.strip()}
                note_results = [
                    r for r in note_results
                    if tag_set & {t.strip().lower() for t in r["metadata"].get("tags", "").split(",") if t.strip()}
                ]
                if not should_rerank:
                    note_results = note_results[:body.n]
        else:
            note_results = store.list_notes(where=where, n=body.n)
    else:
        note_results = store.get_notes_by_tag(tag_filter, n=body.n, where=where)

    # Build note candidate dicts
    note_candidates: list[dict] = []
    for r in note_results:
        meta = r["metadata"]
        meta = NoteMetadata(**meta).model_dump()
        note_candidates.append(
            {
                "id": r["id"],
                "title": meta.get("title", ""),
                "snippet": r["document"][:SNIPPET_MAX_LEN] if r["document"] else "",
                "metadata": meta,
                "score": r.get("score", 0.0),
                "type": "note",
            }
        )

    # Rerank note candidates if enabled
    if should_rerank and note_candidates:
        note_candidates = reranker.rerank(body.query, note_candidates)
        note_candidates = note_candidates[:body.n]

    # Calendar results are not reranked
    calendar_results: list[dict] = []
    if body.include_calendar and query_embedding is not None:
        calendar_results_raw = store.search_calendar(query_embedding, n=body.n)
        for r in calendar_results_raw:
            calendar_results.append(
                {
                    "id": r["id"],
                    "title": r["metadata"].get("summary", ""),
                    "snippet": r["document"][:SNIPPET_MAX_LEN] if r["document"] else "",
                    "metadata": r["metadata"],
                    "score": 1 - r["distance"] if r.get("distance") is not None else 0.0,
                    "type": "calendar",
                }
            )

    # Merge and deduplicate by note_id
    all_results = note_candidates + calendar_results
    seen_note_ids: dict[str, dict] = {}
    for r in all_results:
        rid = r["id"]
        rmeta = r.get("metadata", {})
        note_id = rmeta.get("note_id") or rid
        r["note_id"] = note_id
        if note_id in seen_note_ids:
            if r["score"] > seen_note_ids[note_id]["score"]:
                seen_note_ids[note_id] = r
        else:
            seen_note_ids[note_id] = r

    return {"results": list(seen_note_ids.values())}


@app.get("/api/notes/{note_id}", response_model=NoteDetailResponse)
async def get_note(note_id: str) -> dict:
    note = store.get_note(note_id)
    if not note:
        note = store.get_note_by_note_id(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    metadata = NoteMetadata(**note["metadata"]).model_dump()
    source_id = metadata.get("source_id", "")
    logical_note_id = metadata.get("note_id") or note["id"]

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
    deduped = normalize_and_dedup_results(similar)
    for entry in deduped:
        s_note_id = entry["note_id"]
        if s_note_id == logical_note_id:
            continue
        meta = entry["metadata"]
        similar_notes.append({
            "id": entry["id"],
            "note_id": s_note_id,
            "title": meta.get("title", ""),
            "score": entry["score"],
            "created": meta.get("created", ""),
        })

    current_embedding = store.get_note_embedding(logical_note_id) or []
    similar_nids = [sn["note_id"] for sn in similar_notes if sn["note_id"]]
    embeddings_map = store.get_embeddings_for_notes(similar_nids)
    for sn in similar_notes:
        sn["embedding"] = embeddings_map.get(sn["note_id"], [])

    return {
        "id": logical_note_id,
        "metadata": metadata,
        "content": content,
        "calendar_events": calendar_events,
        "similar_notes": similar_notes,
        "embedding": current_embedding,
    }


def _reingest_note(note_id: str, md_path: str) -> None:
    post = frontmatter.load(md_path)
    chunks, metadatas, ids = build_note_chunks(
        note_id, post.metadata, post.content, os.path.basename(md_path)
    )
    embeddings = embed_texts_sync(chunks)
    if embeddings:
        store.delete_note_chunks(note_id)
        store.add_notes(ids, chunks, embeddings, metadatas)


@app.patch("/api/notes/{note_id}", response_model=UpdateNoteResponse)
async def update_note(note_id: str, body: UpdateNoteRequest) -> dict:
    if all(v is None for v in [body.title, body.content, body.tags, body.participants]):
        raise HTTPException(status_code=422, detail="No fields to update")

    note = store.get_note(note_id)
    if not note:
        note = store.get_note_by_note_id(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    metadata = NoteMetadata(**note["metadata"]).model_dump()
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
        post.content = body.content

    if body.tags is not None:
        post.metadata["tags"] = body.tags

    if body.participants is not None:
        post.metadata["participants"] = body.participants

    post.metadata["modified"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    logical_note_id = metadata.get("note_id") or note_id

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
    updated_meta = NoteMetadata(**updated_note["metadata"]).model_dump() if updated_note else {}
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


from config import PEOPLE_REGISTRY_PATH


@app.get("/api/people", response_model=PeopleResponse)
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


@app.get("/api/tags", response_model=TagsResponse)
async def get_tags() -> dict:
    tags, co_occurrence = store.get_tags()
    return {"tags": tags, "co_occurrence": co_occurrence}


@app.get("/api/timeline", response_model=TimelineResponse)
async def get_timeline(group_by: str = "month", tag: Optional[str] = None) -> dict:
    periods = store.get_timeline(group_by=group_by, tag=tag)
    return {"periods": periods}


@app.get("/api/similar/{note_id}", response_model=SimilarNotesResponse)
async def get_similar_notes(note_id: str, n: int = 10, threshold: float = 0.75) -> dict:
    similar = store.get_similar(note_id, n=n)
    query_note = store.get_note(note_id) or store.get_note_by_note_id(note_id)
    query_note_id = query_note["metadata"].get("note_id") or note_id if query_note else note_id
    deduped = normalize_and_dedup_results(similar, threshold=threshold)
    notes = []
    for entry in deduped:
        nid = entry["note_id"]
        if nid == query_note_id:
            continue
        meta = entry["metadata"]
        notes.append({
            "id": entry["id"],
            "note_id": nid,
            "title": meta.get("title", ""),
            "score": entry["score"],
            "created": meta.get("created", ""),
        })
    return {"notes": notes}


@app.post("/api/ingest", response_model=IngestResponse)
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


@app.get("/api/graph", response_model=GraphResponse)
async def get_graph(tag: Optional[str] = None, folder: Optional[str] = None, n_neighbors: int = 3, threshold: float = 0.75) -> dict:
    return build_similarity_graph(store, tag, folder, threshold)


@app.get("/api/search-graph", response_model=GraphResponse)
async def get_search_graph(query: str, threshold: float = 0.55, n: int = 50) -> dict:
    global reranker
    query_embedding = embed_query_sync(query) if query.strip() else None
    if query_embedding is None:
        return {"nodes": [], "edges": []}

    n_candidates = min(n * 5, RERANK_MAX_CANDIDATES)
    note_results = store.search_notes(query_embedding, n=n_candidates)

    note_ids = []
    scores = {}
    seen = set()
    for r in note_results:
        meta = r.get("metadata", {})
        nid = meta.get("note_id") or r["id"]
        if nid in seen:
            continue
        seen.add(nid)
        note_ids.append(nid)
        distance = r.get("distance")
        scores[nid] = 1 - (distance / 2) if distance is not None else 0.0

    return build_similarity_graph_from_notes(store, note_ids[:n], threshold, scores)


@app.get("/api/schema", response_model=SchemaResponse)
async def get_schema() -> dict:
    return discover_schema(NOTES_DIR)


@app.get("/api/watcher/status", response_model=WatcherStatus)
async def get_watcher_status() -> dict:
    if note_watcher is None:
        return {"running": False, "notes_dir": NOTES_DIR}
    return note_watcher.status()


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats() -> dict:
    return store.get_stats()


@app.get("/api/calendar", response_model=CalendarEventsResponse)
async def get_calendar_events(
    start_date: Optional[str] = None, end_date: Optional[str] = None, attendee: Optional[str] = None
) -> dict:
    cal = get_calendar()
    events = cal.process_events()

    if start_date:
        events = [e for e in events if e.date >= start_date]
    if end_date:
        events = [e for e in events if e.date <= end_date]
    if attendee:
        normalized = cal.normalize_name(attendee)
        events = [e for e in events if normalized in e.attendee_names]

    return {"events": events}


@app.get("/api/calendar/{event_id}", response_model=CalendarEventDetailResponse)
async def get_calendar_event(event_id: str) -> dict:
    cal = get_calendar()
    events = cal.process_events()

    event = None
    for e in events:
        if e.id == event_id:
            event = e
            break

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    date_str = event.date
    linked_notes = []
    if date_str:
        for note in store.get_notes_by_date(date_str):
            linked_notes.append({
                "id": note["id"],
                "title": note["title"],
                "date": date_str,
            })

    return {
        "id": event.id,
        "summary": event.summary,
        "start": event.start,
        "end": event.end,
        "location": event.location,
        "attendees": event.attendee_names,
        "description": event.description,
        "linked_notes": linked_notes,
    }


@app.get("/api/calendar/date/{date}", response_model=CalendarDateResponse)
async def get_calendar_by_date(date: str) -> dict:
    cal = get_calendar()
    events = cal.get_events_for_date(date)

    notes = []
    for note in store.get_notes_by_date(date):
        meta = note["metadata"]
        meta = NoteMetadata(**meta).model_dump()
        notes.append({
            "id": note["id"],
            "title": note["title"],
            "metadata": meta,
        })

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

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
from cachetools import TTLCache
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
from models import (
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

NOTES_DIR = os.path.join(os.path.dirname(__file__), "..", "notes")

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


_source_id_cache = TTLCache(maxsize=1000, ttl=300)


def _build_source_id_cache() -> None:
    if len(_source_id_cache) > 0:
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
    _source_id_cache.clear()


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


class SearchRequest(BaseModel):
    query: str
    filters: dict = Field(default_factory=dict)
    n: int = 20
    include_calendar: bool = True
    rerank: bool = True


class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    participants: Optional[list[str]] = None


class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    metadata: dict
    score: float
    type: str


class IngestRequest(BaseModel):
    full: bool = False


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

    return {
        "id": logical_note_id,
        "metadata": metadata,
        "content": content,
        "calendar_events": calendar_events,
        "similar_notes": similar_notes,
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
            where_clause_ids = filtered_ids[:250]
        else:
            where_clause_ids = []
    else:
        where_clause_ids = None

    sample_ids = where_clause_ids if where_clause_ids else None
    if sample_ids and len(sample_ids) > 1000:
        sample_ids = sample_ids[:1000]

    all_meta = {}
    if sample_ids:
        batch = store._notes.get(ids=sample_ids, include=["metadatas"])
        seen_note_ids = set()
        for i, mid in enumerate(batch["ids"]):
            meta = batch["metadatas"][i] if batch["metadatas"] else {}
            meta = NoteMetadata(**meta).model_dump()
            nid = meta.get("note_id") or mid
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
            meta = NoteMetadata(**meta).model_dump()
            nid = meta.get("note_id") or mid
            if nid in seen_note_ids:
                continue
            seen_note_ids.add(nid)
            all_meta[mid] = meta
            if len(all_meta) >= 1000:
                break

    query_ids = list(all_meta.keys())
    if not query_ids:
        return {"nodes": [], "edges": []}

    batch_data = store._notes.get(ids=query_ids, include=["embeddings", "metadatas"])
    embeddings = batch_data.get("embeddings", [])
    if len(embeddings) == 0 or embeddings[0] is None:
        return {"nodes": [], "edges": []}

    from sklearn.metrics.pairwise import cosine_similarity

    clean_embeddings = [e for e in embeddings if e is not None]
    if not clean_embeddings:
        return {"nodes": [], "edges": []}

    sim_matrix = cosine_similarity(clean_embeddings)

    id_to_note_id = {}
    for mid, meta in all_meta.items():
        id_to_note_id[mid] = meta.get("note_id") or mid

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
    nid_to_meta = {meta.get("note_id") or mid: meta for mid, meta in all_meta.items()}
    for nid in connected:
        meta = nid_to_meta.get(nid, {})
        nodes.append({
            "id": meta.get("note_id") or nid,
            "title": meta.get("title", ""),
            "folder": meta.get("folder", ""),
            "tags": meta.get("tags", []) if isinstance(meta.get("tags"), list) else [],
            "source": meta.get("source", ""),
            "created": meta.get("created", ""),
        })

    return {"nodes": nodes, "edges": edges}


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

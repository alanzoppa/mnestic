import os
from pathlib import Path
from typing import Any

import frontmatter
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from embed import embed_query_sync
from store import NoteStore
from schema import discover_schema

NOTES_DIR = os.path.join(os.path.dirname(__file__), "..", "notes")

app = FastAPI(title="Notes Browser API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return None


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
    for r in all_results:
        rid = r["id"]
        if rid not in id_to_best or r["score"] > id_to_best[rid]["score"]:
            id_to_best[rid] = r

    return {"results": list(id_to_best.values())}


@app.get("/api/notes/{note_id}")
async def get_note(note_id: str) -> dict:
    note = store.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    metadata = note["metadata"]
    _normalize_meta(metadata)
    source_id = metadata.get("source_id", "")

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

    similar = store.get_similar(note_id, n=10)
    similar_notes = [{"id": s["id"], "title": s["metadata"].get("title", ""), "score": 1 - s["distance"]} for s in similar if s.get("distance") is not None]

    return {
        "id": note_id,
        "metadata": metadata,
        "content": content,
        "calendar_events": calendar_events,
        "similar_notes": similar_notes,
    }


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
    notes = [
        {"id": s["id"], "title": s["metadata"].get("title", ""), "score": 1 - s["distance"]}
        for s in similar
        if s.get("distance") is not None and (1 - s["distance"]) >= threshold
    ]
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
        for i, mid in enumerate(batch["ids"]):
            meta = batch["metadatas"][i] if batch["metadatas"] else {}
            _normalize_meta(meta)
            all_meta[mid] = meta
    else:
        all_data = store._notes.get(include=["metadatas"])
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

    edge_set = set()
    edges = []
    for i in range(len(query_ids)):
        for j in range(i + 1, len(query_ids)):
            sim = float(sim_matrix[i][j])
            if sim >= threshold:
                pair = tuple(sorted([query_ids[i], query_ids[j]]))
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
            "id": nid,
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
    if date_str:
        all_notes = store._notes.get(include=["metadatas"])
        for i, meta in enumerate(all_notes.get("metadatas", [])):
            if meta and meta.get("created", "").startswith(date_str):
                linked_notes.append(
                    {
                        "id": all_notes["ids"][i],
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
    for i, meta in enumerate(all_notes.get("metadatas", [])):
        if meta and meta.get("created", "").startswith(date):
            notes.append(
                {
                    "id": all_notes["ids"][i],
                    "title": meta.get("title", ""),
                    "metadata": meta,
                }
            )

    return {"date": date, "events": events, "notes": notes}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

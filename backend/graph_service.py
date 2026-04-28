from __future__ import annotations

from typing import Any

from sklearn.metrics.pairwise import cosine_similarity

from store import NoteStore
from models import NoteMetadata


def build_similarity_graph(
    store: NoteStore,
    tag: str | None = None,
    folder: str | None = None,
    threshold: float = 0.75,
) -> dict[str, Any]:
    """Build a similarity graph from note embeddings.

    Returns {'nodes': [...], 'edges': [...]} matching GraphResponse schema.
    """
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

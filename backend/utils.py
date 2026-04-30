"""Shared utility helpers for the notes browser backend."""

from __future__ import annotations

from models import NoteMetadata, NoteResult


def normalize_and_dedup_results(
    raw_results: list[NoteResult] | list[dict],
    threshold: float | None = None,
) -> list[dict]:
    """Normalize metadata and deduplicate ChromaDB results by note_id, keeping highest score.

    Accepts NoteResult objects or raw dicts (for backward compatibility).
    Returns list of dicts with keys: id, note_id, metadata, score
    sorted by score descending.
    """
    seen: dict[str, dict] = {}
    for r in raw_results:
        if isinstance(r, NoteResult):
            meta = r.metadata.model_dump()
            nid = meta.get("note_id") or r.id
            if not nid:
                continue
            if r.distance is not None:
                score = 1.0 - r.distance
            else:
                score = r.score
        else:
            meta = r.get("metadata", {})
            if meta:
                meta = NoteMetadata(**meta).model_dump()
            nid = meta.get("note_id") or r.get("id", "")
            if not nid:
                continue
            if "distance" in r and r["distance"] is not None:
                score = 1.0 - r["distance"]
            else:
                score = r.get("score", 0.0)

        if threshold is not None and score < threshold:
            continue

        entry: dict = {
            "id": r.id if isinstance(r, NoteResult) else r.get("id", nid),
            "note_id": nid,
            "metadata": meta,
            "score": score,
        }
        if nid not in seen or score > seen[nid]["score"]:
            seen[nid] = entry

    return sorted(seen.values(), key=lambda x: x["score"], reverse=True)
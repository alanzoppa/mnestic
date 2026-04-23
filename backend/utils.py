"""Shared utility helpers for the notes browser backend."""

from __future__ import annotations


def _normalize_meta(meta: dict) -> None:
    """Convert comma-separated tags and participants strings to lists in-place."""
    if "tags" in meta and isinstance(meta["tags"], str):
        meta["tags"] = [t.strip() for t in meta["tags"].split(",") if t.strip()]
    if "participants" in meta and isinstance(meta["participants"], str):
        meta["participants"] = [p.strip() for p in meta["participants"].split(",") if p.strip()]


def normalize_and_dedup_results(raw_results: list[dict], threshold: float | None = None) -> list[dict]:
    """Normalize metadata and deduplicate ChromaDB results by note_id, keeping highest score.

    Each raw result should have: id, metadata, and either score or distance.
    Returns list of dicts with keys: id, note_id, metadata, score
    sorted by score descending.
    """
    seen: dict[str, dict] = {}
    for r in raw_results:
        meta = r.get("metadata", {})
        if meta:
            _normalize_meta(meta)
        nid = meta.get("note_id", r.get("id", ""))
        if not nid:
            continue

        if "distance" in r and r["distance"] is not None:
            score = 1.0 - r["distance"]
        else:
            score = r.get("score", 0.0)

        if threshold is not None and score < threshold:
            continue

        entry = {
            "id": r.get("id", nid),
            "note_id": nid,
            "metadata": meta,
            "score": score,
        }
        if nid not in seen or score > seen[nid]["score"]:
            seen[nid] = entry

    return sorted(seen.values(), key=lambda x: x["score"], reverse=True)

"""Shared utility helpers for the notes browser backend."""

from __future__ import annotations


def _normalize_meta(meta: dict) -> None:
    """Convert comma-separated tags and participants strings to lists in-place."""
    if "tags" in meta and isinstance(meta["tags"], str):
        meta["tags"] = [t.strip() for t in meta["tags"].split(",") if t.strip()]
    if "participants" in meta and isinstance(meta["participants"], str):
        meta["participants"] = [p.strip() for p in meta["participants"].split(",") if p.strip()]

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

import frontmatter
from filelock import FileLock

from config import NOTES_DIR
from constants import MAX_FILENAME_LEN, MAX_FILENAME_ATTEMPTS

logger = logging.getLogger(__name__)


def _is_safe_filename(name: str) -> bool:
    """Reject names with path traversal attempts."""
    if not name:
        return False
    return ".." not in name and "/" not in name and "\\" not in name and "\x00" not in name


# ---------------------------------------------------------------------------
# source_id -> filename cache (used by find_note_file)
# ---------------------------------------------------------------------------

_source_id_cache: dict[str, str] = {}
_source_id_cache_populated = False


def _build_source_id_cache(notes_dir: str) -> None:
    global _source_id_cache_populated
    if _source_id_cache_populated:
        return
    if not os.path.exists(notes_dir):
        _source_id_cache_populated = True
        return
    for f in os.listdir(notes_dir):
        if not f.endswith(".md"):
            continue
        try:
            post = frontmatter.load(os.path.join(notes_dir, f))
            sid = post.get("source_id", "")
            if sid:
                _source_id_cache[sid] = f
        except Exception as e:
            logger.debug("Skipping unparseable note %s: %s", f, e)
            continue
    _source_id_cache_populated = True


def find_note_file(source_id: str, notes_dir: str) -> str | None:
    """Resolve a source_id to an on-disk note file path.

    Scans all .md files in *notes_dir*, reads frontmatter, and maps
    ``source_id`` → filename. Falls back to treating *source_id* as a
    literal filename only when it passes the safety check.
    """
    _build_source_id_cache(notes_dir)
    filename = _source_id_cache.get(source_id)
    if filename:
        return os.path.join(notes_dir, filename)
    if not _is_safe_filename(source_id):
        return None
    for ext in (".md", ".txt", ""):
        candidate = os.path.join(notes_dir, source_id + ext)
        if os.path.exists(candidate):
            return candidate
    return None


def _invalidate_source_id_cache() -> None:
    global _source_id_cache_populated
    _source_id_cache.clear()
    _source_id_cache_populated = False


def _sanitize_filename(title: str, notes_dir: str) -> str:
    """Derive a unique, safe filename base from a note title.

    Returns the base name (without ``.md`` suffix). If a file with that
    base already exists in *notes_dir*, appends ``__2``, ``__3``, etc.
    """
    sanitized = re.sub(r"[:/\\]", "-", title)
    sanitized = sanitized.strip()
    if not sanitized:
        sanitized = "untitled"
    base = sanitized[:MAX_FILENAME_LEN]
    filepath = os.path.join(notes_dir, f"{base}.md")
    if not os.path.exists(filepath):
        return base
    for i in range(2, MAX_FILENAME_ATTEMPTS + 1):
        candidate = f"{base}__{i}"
        if not os.path.exists(os.path.join(notes_dir, f"{candidate}.md")):
            return candidate
    raise RuntimeError(f"Could not find unique filename for '{base}' after {MAX_FILENAME_ATTEMPTS} attempts")


# ---------------------------------------------------------------------------
# state helpers
# ---------------------------------------------------------------------------


def _state_lock(state_file: Path) -> Path:
    return state_file.with_suffix(state_file.suffix + ".lock")


def _to_path(state_file: str | Path) -> Path:
    return Path(state_file) if isinstance(state_file, str) else state_file


def _read_state(state_file: str | Path) -> dict:
    state_file = _to_path(state_file)
    lock = FileLock(str(_state_lock(state_file)))
    with lock.acquire(timeout=10):
        if state_file.exists():
            try:
                return json.loads(state_file.read_text())
            except Exception as e:
                logger.warning("Failed to parse state file %s: %s", state_file, e)
        return {}


def _write_state(state_file: str | Path, data: dict) -> None:
    state_file = _to_path(state_file)
    lock = FileLock(str(_state_lock(state_file)))
    with lock.acquire(timeout=10):
        state_file.write_text(json.dumps(data, indent=2))

from __future__ import annotations

import json
from pathlib import Path

from filelock import FileLock


def _is_safe_filename(name: str) -> bool:
    """Reject names with path traversal attempts."""
    if not name:
        return False
    return ".." not in name and "/" not in name and "\\" not in name and "\x00" not in name


def _state_lock(state_file: Path) -> Path:
    return state_file.with_suffix(state_file.suffix + ".lock")


def _read_state(state_file: Path) -> dict:
    lock = FileLock(str(_state_lock(state_file)))
    with lock.acquire(timeout=10):
        if state_file.exists():
            try:
                return json.loads(state_file.read_text())
            except Exception:
                pass
        return {}


def _write_state(state_file: Path, data: dict) -> None:
    lock = FileLock(str(_state_lock(state_file)))
    with lock.acquire(timeout=10):
        state_file.write_text(json.dumps(data, indent=2))

"""Environment-based configuration with persistent .env file.

Auto-creates a .env file in the project root with sensible defaults
if one doesn't already exist. External paths (calendar export, people
registry, note source) are configurable there. Internal paths are derived
deterministically from the module location.
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    # Fallback for environments without python-dotenv;
    # load_dotenv is just a convenience, we read os.environ directly.
    load_dotenv = None


REPO_ROOT = Path(os.path.abspath(__file__)).parent.parent
_ENV_PATH = REPO_ROOT / ".env"

_ENV_DEFAULTS = """# Machine-specific paths — adjust for your environment
CALENDAR_EXPORT_PATH=~/Downloads/calendar-export.json
PEOPLE_REGISTRY_PATH=~/Desktop/notes/people_registry.json
NOTES_SOURCE=~/Desktop/notes/Apple Notes
"""


def _ensure_env() -> None:
    if _ENV_PATH.exists():
        return
    try:
        _ENV_PATH.write_text(_ENV_DEFAULTS, encoding="utf-8")
    except Exception:
        pass


def _load_env() -> None:
    if load_dotenv is not None:
        load_dotenv(dotenv_path=_ENV_PATH, override=True)


def _expand(path: str) -> str:
    if not path:
        return ""
    return os.path.expanduser(path)


# Bootstrap on import
_ensure_env()
_load_env()

# External data sources (from .env or defaults)
CALENDAR_EXPORT_PATH: str = _expand(os.getenv("CALENDAR_EXPORT_PATH", "~/Downloads/calendar-export.json"))
PEOPLE_REGISTRY_PATH: str = _expand(os.getenv("PEOPLE_REGISTRY_PATH", "~/Desktop/notes/people_registry.json"))
NOTES_SOURCE: str = _expand(os.getenv("NOTES_SOURCE", "~/Desktop/notes/Apple Notes"))

# Internal paths derived from repo root
NOTES_DIR: str = str(REPO_ROOT / "notes")
CHROMA_PERSIST_DIR: str = str(REPO_ROOT / "chroma_data")
IMAGES_DIR: str = str(REPO_ROOT / "images")
DATA_DIR: str = str(REPO_ROOT / "data")


__all__ = [
    "REPO_ROOT",
    "CALENDAR_EXPORT_PATH",
    "PEOPLE_REGISTRY_PATH",
    "NOTES_SOURCE",
    "NOTES_DIR",
    "CHROMA_PERSIST_DIR",
    "IMAGES_DIR",
    "DATA_DIR",
]
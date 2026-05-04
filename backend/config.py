"""Environment-based configuration with pydantic-settings.

Loads from a .env file in the project root if it exists. External paths
(calendar export, people registry, note source) are configurable there.
Internal paths are derived deterministically from the module location.
"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    """Machine-specific paths loaded from .env with sensible defaults."""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # External data sources (from .env or defaults)
    calendar_export_path: str = "~/Downloads/calendar-export.json"
    people_registry_path: str = "~/Desktop/notes/people_registry.json"
    notes_source: str = "~/Desktop/notes/Apple Notes"

    # Embedding providers
    openrouter_api_key: str = ""
    openrouter_embed_model: str = "qwen/qwen3-embedding-8b"
    ollama_embed_model: str = "qwen3-embedding"
    embed_provider_ingest: str = "openrouter"
    embed_provider_query: str = "openrouter"

    @field_validator("calendar_export_path", "people_registry_path", "notes_source", mode="before")
    @classmethod
    def expand_user(cls, v: str) -> str:
        return os.path.expanduser(v) if v else v

    @field_validator("embed_provider_ingest", "embed_provider_query", mode="before")
    @classmethod
    def validate_embed_provider(cls, v: str) -> str:
        if v not in ("ollama", "openrouter"):
            raise ValueError(f"embed_provider must be 'ollama' or 'openrouter', got '{v}'")
        return v

    # Internal paths derived deterministically
    @property
    def repo_root(self) -> Path:
        return Path(__file__).resolve().parent.parent

    @property
    def notes_dir(self) -> str:
        return str(self.repo_root / "notes")

    @property
    def chroma_persist_dir(self) -> str:
        return str(self.repo_root / "chroma_data")

    @property
    def images_dir(self) -> str:
        return str(self.repo_root / "images")

    @property
    def data_dir(self) -> str:
        return str(self.repo_root / "data")


# Module-level singleton
settings = Settings()

# Flat re-exports for backward compatibility
REPO_ROOT = settings.repo_root
CALENDAR_EXPORT_PATH = settings.calendar_export_path
PEOPLE_REGISTRY_PATH = settings.people_registry_path
NOTES_SOURCE = settings.notes_source
NOTES_DIR = settings.notes_dir
CHROMA_PERSIST_DIR = settings.chroma_persist_dir
IMAGES_DIR = settings.images_dir
DATA_DIR = settings.data_dir

OPENROUTER_API_KEY = settings.openrouter_api_key
OPENROUTER_EMBED_MODEL = settings.openrouter_embed_model
OLLAMA_EMBED_MODEL = settings.ollama_embed_model
EMBED_PROVIDER_INGEST = settings.embed_provider_ingest
EMBED_PROVIDER_QUERY = settings.embed_provider_query

import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from config import (
    REPO_ROOT,
    CALENDAR_EXPORT_PATH,
    PEOPLE_REGISTRY_PATH,
    NOTES_SOURCE,
    NOTES_DIR,
    CHROMA_PERSIST_DIR,
    IMAGES_DIR,
    DATA_DIR,
    Settings,
)


def test_repo_root_is_directory():
    assert REPO_ROOT.is_dir()
    assert (REPO_ROOT / "backend").is_dir()
    assert (REPO_ROOT / "frontend").is_dir()


def test_notes_dir_inside_repo():
    assert Path(NOTES_DIR) == REPO_ROOT / "notes"


def test_chroma_persist_dir_inside_repo():
    assert Path(CHROMA_PERSIST_DIR) == REPO_ROOT / "chroma_data"


def test_images_dir_inside_repo():
    assert Path(IMAGES_DIR) == REPO_ROOT / "images"


def test_data_dir_inside_repo():
    assert Path(DATA_DIR) == REPO_ROOT / "data"


def test_settings_env_defaults(monkeypatch, tmp_path):
    monkeypatch.setenv("HOME", str(tmp_path))
    s = Settings()
    assert s.calendar_export_path.startswith(str(tmp_path))
    assert "calendar-export.json" in s.calendar_export_path
    assert s.people_registry_path.startswith(str(tmp_path))
    assert s.notes_source.startswith(str(tmp_path))


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("CALENDAR_EXPORT_PATH", "/custom/cal.json")
    monkeypatch.setenv("PEOPLE_REGISTRY_PATH", "/custom/people.json")
    s = Settings()
    assert s.calendar_export_path == "/custom/cal.json"
    assert s.people_registry_path == "/custom/people.json"
    assert isinstance(s.notes_source, str)


def test_expanduser_in_validator(monkeypatch, tmp_path):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("NOTES_SOURCE", "~/Notes")
    s = Settings()
    assert s.notes_source == str(tmp_path / "Notes")


def test_settings_singleton_matches_exports():
    from config import settings as singleton

    assert singleton.calendar_export_path == CALENDAR_EXPORT_PATH
    assert singleton.people_registry_path == PEOPLE_REGISTRY_PATH
    assert singleton.notes_source == NOTES_SOURCE
    assert singleton.notes_dir == NOTES_DIR
    assert singleton.chroma_persist_dir == CHROMA_PERSIST_DIR
    assert singleton.images_dir == IMAGES_DIR
    assert singleton.data_dir == DATA_DIR
    assert singleton.repo_root == REPO_ROOT

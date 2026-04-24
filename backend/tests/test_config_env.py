import os
import sys
import json
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


def test_repo_root_is_directory():
    from config_env import REPO_ROOT

    assert REPO_ROOT.is_dir()
    assert (REPO_ROOT / "backend").is_dir()
    assert (REPO_ROOT / "frontend").is_dir()


def test_notes_dir_inside_repo():
    from config_env import NOTES_DIR, REPO_ROOT

    assert Path(NOTES_DIR) == REPO_ROOT / "notes"


def test_chroma_persist_dir_inside_repo():
    from config_env import CHROMA_PERSIST_DIR, REPO_ROOT

    assert Path(CHROMA_PERSIST_DIR) == REPO_ROOT / "chroma_data"


def test_env_file_created(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    env_file = tmp_path / ".env"
    monkeypatch.setattr("config_env._ENV_PATH", env_file)
    from config_env import _ensure_env

    _ensure_env()
    assert env_file.exists()
    content = env_file.read_text()
    assert "CALENDAR_EXPORT_PATH" in content
    assert "PEOPLE_REGISTRY_PATH" in content
    assert "NOTES_SOURCE" in content


def test_env_overrides(monkeypatch, tmp_path):
    from config_env import CALENDAR_EXPORT_PATH, PEOPLE_REGISTRY_PATH

    assert isinstance(CALENDAR_EXPORT_PATH, str)
    assert isinstance(PEOPLE_REGISTRY_PATH, str)

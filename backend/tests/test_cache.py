import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from models import StatsResponse

DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture(autouse=True)
def clear_cache():
    # Reset cache state before every test in this module
    import shared
    shared._invalidate_source_id_cache()


@pytest.fixture
def app_client(tmp_path):
    notes_dir = tmp_path / "notes"
    notes_dir.mkdir()

    # Create multiple notes with Apple Notes source_ids containing / and :
    apple_ids = [
        "x-coredata://1234567890/com.apple.notes.Note/ABCDEFGHIJ",
        "x-coredata://0987654321/com.apple.notes.Note/ZYXWVUTSRQ",
    ]
    evernote_ids = [
        "evernote:note:abc123def456",
        "evernote:note:xyz789uvw012",
    ]

    for i, sid in enumerate(apple_ids):
        fpath = notes_dir / f"Apple_Note_{i}.md"
        fpath.write_text(f"---\nsource_id: {sid}\nsource: Apple Notes\ntitle: Apple Note {i}\n---\n\nContent.")

    for i, sid in enumerate(evernote_ids):
        fpath = notes_dir / f"Evernote_Note_{i}.md"
        fpath.write_text(f"---\nsource_id: {sid}\nsource: Evernote\ntitle: Evernote Note {i}\n---\n\nContent.")

    notes_dir_str = str(notes_dir)

    mock_store = MagicMock()
    mock_store.get_stats.return_value = StatsResponse(total_notes=4)

    with patch("main.NoteStore", return_value=mock_store), \
         patch("main.embed_query_sync", return_value=DUMMY_EMBEDDING), \
         patch("main.NOTES_DIR", notes_dir_str):
        from main import app
        import main
        main.store = mock_store
        main.reranker = MagicMock()
        main.reranker.rerank.side_effect = lambda query, candidates: candidates
        client = TestClient(app)
        yield client, notes_dir_str


def test_all_notes_found_by_source_id(app_client):
    c, notes_dir = app_client
    from shared import find_note_file, _source_id_cache

    # Build cache by calling find_note_file once
    find_note_file("x-coredata://1234567890/com.apple.notes.Note/ABCDEFGHIJ", notes_dir)
    assert len(_source_id_cache) == 4

    # Every source_id should resolve
    for sid in _source_id_cache:
        result = find_note_file(sid, notes_dir)
        assert result is not None, f"Failed to find note for source_id: {sid}"
        assert os.path.exists(result)


def test_apple_notes_source_id_with_colon_slash(app_client):
    c, notes_dir = app_client
    from shared import find_note_file

    sid = "x-coredata://1234567890/com.apple.notes.Note/ABCDEFGHIJ"
    result = find_note_file(sid, notes_dir)
    assert result is not None
    assert os.path.basename(result) == "Apple_Note_0.md"


def test_invalidation_then_find_rebuilds_cache(app_client):
    c, notes_dir = app_client
    import shared

    # Warm cache
    shared.find_note_file("evernote:note:abc123def456", notes_dir)
    assert len(shared._source_id_cache) == 4
    assert shared._source_id_cache_populated is True

    # Invalidate
    shared._invalidate_source_id_cache()
    assert len(shared._source_id_cache) == 0
    assert shared._source_id_cache_populated is False

    # Adding a new note after invalidation
    new_sid = "x-coredata://NEWNOTE"
    new_path = os.path.join(notes_dir, "New_Note.md")
    with open(new_path, "w") as f:
        f.write(f"---\nsource_id: {new_sid}\nsource: Apple Notes\ntitle: New Note\n---\n\nContent.")

    # find_note_file should rebuild and find the new note
    result = shared.find_note_file(new_sid, notes_dir)
    assert result is not None
    assert os.path.basename(result) == "New_Note.md"
    assert len(shared._source_id_cache) == 5


def test_evernote_source_id(app_client):
    c, notes_dir = app_client
    from shared import find_note_file

    sid = "evernote:note:xyz789uvw012"
    result = find_note_file(sid, notes_dir)
    assert result is not None
    assert os.path.basename(result) == "Evernote_Note_1.md"

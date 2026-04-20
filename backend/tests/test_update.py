import sys
import os
import json
from unittest.mock import patch, MagicMock, mock_open

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import frontmatter
from fastapi.testclient import TestClient

DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture
def app_client_with_files(tmp_path):
    notes_dir = tmp_path / "notes"
    notes_dir.mkdir()

    post = frontmatter.Post("Original note body content.")
    post.metadata["title"] = "Test Note"
    post.metadata["folder"] = "Notes"
    post.metadata["created"] = "2024-01-01T10:00:00Z"
    post.metadata["modified"] = "2024-01-01T10:00:00Z"
    post.metadata["source_id"] = "x-coredata://test-note-1"
    post.metadata["source"] = "Apple Notes"
    post.metadata["tags"] = ["notes", "test"]
    post.metadata["participants"] = ["Alice"]

    filepath = notes_dir / "Test_Note.md"
    with open(filepath, "wb") as f:
        frontmatter.dump(post, f, allow_unicode=True)

    mock_store = MagicMock()
    mock_store.get_note.return_value = None
    mock_store.get_note_by_note_id.return_value = {
        "id": "x-coredata---test-note-1_chunk_0",
        "metadata": {
            "note_id": "x-coredata---test-note-1",
            "source_id": "x-coredata://test-note-1",
            "title": "Test Note",
            "folder": "Notes",
            "tags": "notes,test",
            "participants": "Alice",
            "created": "2024-01-01T10:00:00Z",
            "modified": "2024-01-01T10:00:00Z",
            "source": "Apple Notes",
        },
        "document": "Title: Test Note\nFolder: Notes\nTags: notes,test\nParticipants: Alice\n\nOriginal note body content.",
    }
    mock_store.delete_note_chunks.return_value = 1
    mock_store.add_notes.return_value = None

    notes_dir_str = str(notes_dir)

    with patch("main.NoteStore", return_value=mock_store), \
         patch("main.embed_texts_sync", return_value=[DUMMY_EMBEDDING]), \
         patch("main.NOTES_DIR", notes_dir_str):
        from main import app
        import main
        main.store = mock_store
        main._source_id_to_file = {}
        client = TestClient(app)
        yield client, mock_store, notes_dir_str


def test_update_note_title(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    mock_store.get_note_by_note_id.return_value = {
        "id": "x-coredata---test-note-1_chunk_0",
        "metadata": {
            "note_id": "x-coredata---test-note-1",
            "source_id": "x-coredata://test-note-1",
            "title": "Updated Title",
            "folder": "Notes",
            "tags": "notes,test",
            "participants": "Alice",
            "created": "2024-01-01T10:00:00Z",
            "modified": "2024-06-01T12:00:00Z",
            "source": "Apple Notes",
        },
        "document": "Updated content",
    }

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"title": "Updated Title"})
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert "metadata" in data

    mock_store.delete_note_chunks.assert_called_once_with("x-coredata---test-note-1")
    mock_store.add_notes.assert_called_once()


def test_update_note_content(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"content": "New body content"})
    assert res.status_code == 200

    mock_store.delete_note_chunks.assert_called_once()
    mock_store.add_notes.assert_called_once()


def test_update_note_tags(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"tags": ["notes", "test", "new-tag"]})
    assert res.status_code == 200
    data = res.json()
    assert "metadata" in data

    for f in os.listdir(notes_dir):
        if f.endswith(".md"):
            post = frontmatter.load(os.path.join(notes_dir, f))
            assert "new-tag" in post.metadata["tags"]


def test_update_note_participants(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"participants": ["Alice", "Bob"]})
    assert res.status_code == 200

    for f in os.listdir(notes_dir):
        if f.endswith(".md"):
            post = frontmatter.load(os.path.join(notes_dir, f))
            assert "Bob" in post.metadata["participants"]


def test_update_note_no_fields(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={})
    assert res.status_code == 422


def test_update_note_not_found(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    mock_store.get_note.return_value = None
    mock_store.get_note_by_note_id.return_value = None

    res = c.patch("/api/notes/nonexistent-id", json={"title": "Nope"})
    assert res.status_code == 404


def test_update_note_modifies_file(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"title": "Renamed Note"})
    assert res.status_code == 200

    found_renamed = False
    for f in os.listdir(notes_dir):
        if f.endswith(".md"):
            post = frontmatter.load(os.path.join(notes_dir, f))
            if post.metadata.get("title") == "Renamed Note":
                found_renamed = True
                break
    assert found_renamed


def test_get_people(app_client_with_files, tmp_path):
    c, mock_store, notes_dir = app_client_with_files

    registry = {
        "_metadata": {"total_people": 2},
        "Alice Smith": {"aliases": ["Alice"], "context": "direct report"},
        "Bob Jones": {"aliases": ["Bob"], "context": "colleague"},
    }
    reg_path = tmp_path / "people_registry.json"
    reg_path.write_text(json.dumps(registry))

    with patch("main.PEOPLE_REGISTRY_PATH", str(reg_path)):
        res = c.get("/api/people")

    assert res.status_code == 200
    data = res.json()
    assert "people" in data
    assert len(data["people"]) == 2
    names = [p["name"] for p in data["people"]]
    assert "Alice Smith" in names
    assert "Bob Jones" in names
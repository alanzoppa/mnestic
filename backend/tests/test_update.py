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


def test_update_content_writes_to_file(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    new_content = "Completely rewritten note body."
    res = c.patch("/api/notes/x-coredata---test-note-1", json={"content": new_content})
    assert res.status_code == 200

    found = False
    for f in os.listdir(notes_dir):
        if f.endswith(".md"):
            post = frontmatter.load(os.path.join(notes_dir, f))
            if post.content.strip() == new_content:
                found = True
                break
    assert found, "Content PATCH should write new body to the markdown file"


def test_reingest_deletes_old_chunks_after_embedding(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    call_order = []
    mock_store.delete_note_chunks.side_effect = lambda *a, **kw: call_order.append("delete")
    mock_store.add_notes.side_effect = lambda *a, **kw: call_order.append("add")

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"title": "Atomic Test"})
    assert res.status_code == 200

    assert call_order == ["delete", "add"], f"delete should happen after embedding succeeds, got {call_order}"


def test_reingest_preserves_chunks_on_embedding_failure(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    with patch("main.embed_texts_sync", return_value=None):
        res = c.patch("/api/notes/x-coredata---test-note-1", json={"title": "Fail Embed"})

    assert res.status_code == 200
    mock_store.delete_note_chunks.assert_not_called()
    mock_store.add_notes.assert_not_called()


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


def test_reingest_chunks_contain_updated_content(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    new_body = "This is the updated body that should appear in reingested chunks."
    res = c.patch("/api/notes/x-coredata---test-note-1", json={"content": new_body})
    assert res.status_code == 200

    mock_store.add_notes.assert_called_once()
    call_args = mock_store.add_notes.call_args
    chunks = call_args[0][1]
    assert any(new_body in chunk for chunk in chunks), f"Updated content not found in reingested chunks: {chunks}"


def test_reingest_metadata_has_comma_separated_tags(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"tags": ["alpha", "beta", "gamma"]})
    assert res.status_code == 200

    mock_store.add_notes.assert_called_once()
    call_args = mock_store.add_notes.call_args
    metadatas = call_args[0][3]
    for md in metadatas:
        assert md["tags"] == "alpha,beta,gamma", f"Tags should be comma-serialized in chunk metadata, got: {md['tags']}"
        assert "alpha" not in md["tags"] or "," in md["tags"], "Tags should not be an array in ChromaDB metadata"


def test_reingest_metadata_has_comma_separated_participants(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"participants": ["Alice", "Bob", "Carol"]})
    assert res.status_code == 200

    mock_store.add_notes.assert_called_once()
    call_args = mock_store.add_notes.call_args
    metadatas = call_args[0][3]
    for md in metadatas:
        assert md["participants"] == "Alice,Bob,Carol", f"Participants should be comma-serialized, got: {md['participants']}"


def test_reingest_chunk_text_includes_updated_title(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"title": "Brand New Title"})
    assert res.status_code == 200

    mock_store.add_notes.assert_called_once()
    call_args = mock_store.add_notes.call_args
    chunks = call_args[0][1]
    assert chunks[0].startswith("Title: Brand New Title"), f"First chunk should contain updated title, got: {chunks[0][:80]}"


def test_reingest_uses_correct_note_id(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={"tags": ["solo"]})
    assert res.status_code == 200

    mock_store.delete_note_chunks.assert_called_once_with("x-coredata---test-note-1")
    mock_store.add_notes.assert_called_once()
    call_args = mock_store.add_notes.call_args
    metadatas = call_args[0][3]
    for md in metadatas:
        assert md["note_id"] == "x-coredata---test-note-1"
    ids = call_args[0][0]
    for cid in ids:
        assert "x-coredata---test-note-1" in cid


def test_title_rename_creates_new_file_and_removes_old(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    old_files = set(os.listdir(notes_dir))
    res = c.patch("/api/notes/x-coredata---test-note-1", json={"title": "Renamed Note File"})
    assert res.status_code == 200

    new_files = set(os.listdir(notes_dir))
    added = new_files - old_files
    removed = old_files - new_files
    assert len(added) == 1, f"Expected 1 new file, got {added}"
    assert len(removed) == 1, f"Expected 1 removed file, got {removed}"
    assert "Renamed_Note_File.md" in added or "Renamed-Note-File.md" in added


def test_combined_update_propagates_all_fields(app_client_with_files):
    c, mock_store, notes_dir = app_client_with_files

    res = c.patch("/api/notes/x-coredata---test-note-1", json={
        "title": "Combined Update",
        "content": "Updated body for combined test.",
        "tags": ["combined", "multi"],
        "participants": ["Dana"],
    })
    assert res.status_code == 200

    call_args = mock_store.add_notes.call_args
    chunks = call_args[0][1]
    metadatas = call_args[0][3]

    assert chunks[0].startswith("Title: Combined Update")
    assert "Updated body for combined test." in chunks[0]
    assert metadatas[0]["tags"] == "combined,multi"
    assert metadatas[0]["participants"] == "Dana"
    assert metadatas[0]["title"] == "Combined Update"


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
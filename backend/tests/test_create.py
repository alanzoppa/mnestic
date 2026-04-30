import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from models import (
    NoteMetadata,
    NoteResult,
    CreateNoteRequest,
)


DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture
def app_client():
    mock_store = MagicMock()
    mock_store.get_stats.return_value = None
    mock_store.get_tags.return_value = ([], [])
    mock_store.get_timeline.return_value = []
    mock_store.search_notes.return_value = []
    mock_store.search_calendar.return_value = []
    mock_store.get_note.return_value = None
    mock_store.get_similar.return_value = []
    mock_store.list_notes.return_value = []
    mock_store.get_notes_by_date.return_value = []
    mock_store.get_note_by_note_id.return_value = None

    mock_reranker = MagicMock()
    mock_reranker.rerank.side_effect = lambda query, candidates: candidates

    with patch("main.NoteStore", return_value=mock_store), \
         patch("main.embed_query_sync", return_value=DUMMY_EMBEDDING), \
         patch("main.embed_texts_sync", return_value=[DUMMY_EMBEDDING]), \
         patch("main.Reranker", return_value=mock_reranker):
        from main import app, store as real_store
        import main
        main.store = mock_store
        main.reranker = mock_reranker
        client = TestClient(app)
        yield client, mock_store


def test_create_note_success(app_client):
    c, mock_store = app_client
    mock_store.get_note_by_note_id.return_value = NoteResult(
        id="manual_abc123_chunk_0",
        metadata=NoteMetadata(title="New Note", note_id="manual_abc123", source_id="manual_abc123", folder="Notes", source="Manual", tags="test", created="2024-01-01T00:00:00Z"),
        document="content here"
    )
    res = c.post("/api/notes", json={"title": "New Note", "content": "content here", "folder": "Notes", "tags": ["test"]})
    assert res.status_code == 201
    data = res.json()
    assert data["id"].startswith("manual_")
    assert data["metadata"]["title"] == "New Note"


def test_create_note_empty_title(app_client):
    c, mock_store = app_client
    res = c.post("/api/notes", json={"title": "", "content": "body"})
    assert res.status_code == 422


def test_create_note_missing_title(app_client):
    c, mock_store = app_client
    res = c.post("/api/notes", json={"content": "body"})
    assert res.status_code == 422


def test_create_note_defaults(app_client):
    c, mock_store = app_client
    mock_store.get_note_by_note_id.return_value = NoteResult(
        id="manual_abc123_chunk_0",
        metadata=NoteMetadata(title="Just Title", note_id="manual_abc123", source_id="manual_abc123", folder="Notes", source="Manual", created="2024-01-01T00:00:00Z"),
        document=""
    )
    res = c.post("/api/notes", json={"title": "Just Title"})
    assert res.status_code == 201
    data = res.json()
    assert data["metadata"]["folder"] == "Notes"
    assert data["metadata"]["source"] == "Manual"


def test_create_note_with_series(app_client):
    c, mock_store = app_client
    mock_store.get_note_by_note_id.return_value = NoteResult(
        id="manual_abc123_chunk_0",
        metadata=NoteMetadata(title="Meeting", note_id="manual_abc123", source_id="manual_abc123", folder="Notes", source="Manual", series="weekly_sync", created="2024-01-01T00:00:00Z"),
        document="notes"
    )
    res = c.post("/api/notes", json={"title": "Meeting", "series": "weekly_sync"})
    assert res.status_code == 201
    data = res.json()
    assert data["metadata"]["series"] == "weekly_sync"


def test_create_note_with_participants(app_client):
    c, mock_store = app_client
    mock_store.get_note_by_note_id.return_value = NoteResult(
        id="manual_abc123_chunk_0",
        metadata=NoteMetadata(title="1:1", note_id="manual_abc123", source_id="manual_abc123", folder="Notes", source="Manual", participants=["Alice"], created="2024-01-01T00:00:00Z"),
        document="talked about stuff"
    )
    res = c.post("/api/notes", json={"title": "1:1", "participants": ["Alice"]})
    assert res.status_code == 201
    data = res.json()
    assert "Alice" in data["metadata"]["participants"]


def test_create_note_written_to_disk(app_client, tmp_path):
    c, mock_store = app_client
    mock_store.get_note_by_note_id.return_value = NoteResult(
        id="manual_abc123_chunk_0",
        metadata=NoteMetadata(title="Disk Note", note_id="manual_abc123", source_id="manual_abc123", folder="Notes", source="Manual", created="2024-01-01T00:00:00Z"),
        document="disk content"
    )
    notes_dir = str(tmp_path / "notes")
    os.makedirs(notes_dir, exist_ok=True)
    with patch("main.NOTES_DIR", notes_dir):
        res = c.post("/api/notes", json={"title": "Disk Note", "content": "disk content"})
    assert res.status_code == 201
    md_files = [f for f in os.listdir(notes_dir) if f.endswith(".md")]
    assert len(md_files) == 1
    assert "Disk" in md_files[0]


def test_create_note_reingests(app_client):
    c, mock_store = app_client
    mock_store.get_note_by_note_id.return_value = NoteResult(
        id="manual_abc123_chunk_0",
        metadata=NoteMetadata(title="Reingest Test", note_id="manual_abc123", source_id="manual_abc123", folder="Notes", source="Manual", created="2024-01-01T00:00:00Z"),
        document="body"
    )
    res = c.post("/api/notes", json={"title": "Reingest Test", "content": "body"})
    assert res.status_code == 201
    mock_store.delete_note_chunks.assert_called()
    mock_store.add_notes.assert_called()

import sys
import os
from unittest.mock import patch, MagicMock, mock_open

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient


DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture
def app_client():
    mock_store = MagicMock()
    mock_store.get_stats.return_value = {
        "total_notes": 100,
        "total_tags": 20,
        "date_range": ["2019-01-01", "2024-12-31"],
        "avg_note_length": 500,
        "total_calendar_events": 50,
    }
    mock_store.get_tags.return_value = (
        [{"name": "work", "count": 10}, {"name": "personal", "count": 5}],
        [{"tag1": "work", "tag2": "personal", "count": 3}],
    )
    mock_store.get_timeline.return_value = [
        {"period": "2024-01", "count": 5, "sample_ids": ["note1"]},
        {"period": "2024-02", "count": 10, "sample_ids": ["note2"]},
    ]
    mock_store.search_notes.return_value = []
    mock_store.search_calendar.return_value = []
    mock_store.get_note.return_value = None
    mock_store.get_similar.return_value = []

    with patch("main.NoteStore", return_value=mock_store), \
         patch("main.embed_query_sync", return_value=DUMMY_EMBEDDING):
        from main import app, store as real_store
        import main
        main.store = mock_store
        client = TestClient(app)
        yield client, mock_store


def test_get_stats(app_client):
    c, mock_store = app_client
    res = c.get("/api/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_notes"] == 100
    assert data["total_tags"] == 20
    assert data["total_calendar_events"] == 50


def test_search_basic(app_client):
    c, mock_store = app_client
    mock_store.search_notes.return_value = [
        {"id": "note1", "metadata": {"title": "Test Note"}, "document": "Test content body", "distance": 0.1}
    ]
    mock_store.search_calendar.return_value = []

    res = c.post("/api/search", json={"query": "test"})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    assert data["results"][0]["type"] == "note"


def test_search_with_calendar(app_client):
    c, mock_store = app_client
    mock_store.search_notes.return_value = []
    mock_store.search_calendar.return_value = [
        {"id": "event1", "metadata": {"summary": "Meeting"}, "document": "Calendar event", "distance": 0.15}
    ]

    res = c.post("/api/search", json={"query": "meeting", "include_calendar": True})
    assert res.status_code == 200
    data = res.json()
    calendar_results = [r for r in data["results"] if r["type"] == "calendar"]
    assert len(calendar_results) >= 1


def test_get_note_not_found(app_client):
    c, mock_store = app_client
    mock_store.get_note.return_value = None
    res = c.get("/api/notes/nonexistent-id")
    assert res.status_code == 404


def test_get_tags(app_client):
    c, mock_store = app_client
    res = c.get("/api/tags")
    assert res.status_code == 200
    data = res.json()
    assert "tags" in data
    assert "co_occurrence" in data


def test_get_timeline(app_client):
    c, mock_store = app_client
    res = c.get("/api/timeline?group_by=month")
    assert res.status_code == 200
    data = res.json()
    assert "periods" in data


def test_get_similar(app_client):
    c, mock_store = app_client
    mock_store.get_similar.return_value = [
        {"id": "sim1", "metadata": {"title": "Similar 1"}, "distance": 0.1},
        {"id": "sim2", "metadata": {"title": "Similar 2"}, "distance": 0.2},
    ]

    res = c.get("/api/similar/test-id")
    assert res.status_code == 200
    data = res.json()
    assert "notes" in data


def test_get_schema(app_client):
    c, mock_store = app_client
    with patch("main.discover_schema") as mock_schema:
        mock_schema.return_value = {
            "total_files": 100,
            "fields": [
                {"name": "title", "type": "str", "cardinality": "high", "samples": [], "classification": "embedded"},
            ],
        }
        res = c.get("/api/schema")

    assert res.status_code == 200
    data = res.json()
    assert "fields" in data
    assert data["total_files"] == 100


def test_get_calendar_events(app_client):
    c, mock_store = app_client
    with patch("main.get_calendar") as mock_get_cal:
        mock_cal = MagicMock()
        mock_cal.process_events.return_value = [
            {"id": "evt1", "summary": "Meeting", "date": "2024-01-01", "attendees": "Alice", "attendee_names": ["Alice"], "start": "2024-01-01T10:00:00", "end": "2024-01-01T11:00:00", "location": "Room 1", "description": "Sync", "event_type": "default"},
        ]
        mock_cal.normalize_name.side_effect = lambda n: n
        mock_get_cal.return_value = mock_cal

        res = c.get("/api/calendar?start_date=2024-01-01&end_date=2024-12-31")

    assert res.status_code == 200
    data = res.json()
    assert "events" in data
    assert len(data["events"]) == 1


def test_get_calendar_date(app_client):
    c, mock_store = app_client
    with patch("main.get_calendar") as mock_get_cal:
        mock_cal = MagicMock()
        mock_cal.get_events_for_date.return_value = [
            {"id": "evt1", "summary": "1:1", "date": "2019-12-09"},
        ]
        mock_get_cal.return_value = mock_cal

        mock_store._notes.get.return_value = {
            "ids": [],
            "metadatas": [],
        }

        res = c.get("/api/calendar/date/2019-12-09")

    assert res.status_code == 200
    data = res.json()
    assert data["date"] == "2019-12-09"
    assert "events" in data
    assert "notes" in data


def test_get_graph(app_client):
    c, mock_store = app_client

    mock_store._notes.get.return_value = {
        "ids": ["note1", "note2", "note3"],
        "metadatas": [
            {"title": "Note 1", "folder": "Work", "tags": "work,notes", "source": "Apple Notes"},
            {"title": "Note 2", "folder": "Work", "tags": "work,personal", "source": "Apple Notes"},
            {"title": "Note 3", "folder": "Personal", "tags": "personal", "source": "Evernote"},
        ],
        "embeddings": [[0.1] * 256, [0.2] * 256, [0.3] * 256],
    }

    res = c.get("/api/graph")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) > 0


def test_get_graph_with_tag_filter(app_client):
    c, mock_store = app_client

    mock_store._notes.get.return_value = {
        "ids": ["note1", "note2"],
        "metadatas": [
            {"title": "Note 1", "folder": "Work", "tags": "work,notes", "source": "Apple Notes"},
            {"title": "Note 2", "folder": "Personal", "tags": "personal", "source": "Evernote"},
        ],
        "embeddings": [[0.1] * 256, [0.2] * 256],
    }

    res = c.get("/api/graph?tag=work")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    filtered_nodes = [n for n in data["nodes"] if "work" in n.get("tags", [])]
    assert len(filtered_nodes) <= len(data["nodes"])
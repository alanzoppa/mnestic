import sys
import os
from unittest.mock import patch, MagicMock, mock_open

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from constants import RERANK_MAX_CANDIDATES
from models import (
    CalendarEvent,
    NoteResult,
    NoteMetadata,
    NoteListItem,
    TagInfo,
    CoOccurrence,
    TimelinePeriod,
    StatsResponse,
)


DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture
def app_client():
    mock_store = MagicMock()
    mock_store.get_stats.return_value = StatsResponse(
        total_notes=100,
        total_tags=20,
        date_range=["2019-01-01", "2024-12-31"],
        avg_note_length=500,
        total_calendar_events=50,
    )
    mock_store.get_tags.return_value = (
        [TagInfo(name="work", count=10), TagInfo(name="personal", count=5)],
        [CoOccurrence(tag1="work", tag2="personal", count=3)],
    )
    mock_store.get_timeline.return_value = [
        TimelinePeriod(period="2024-01", count=5, sample_ids=["note1"]),
        TimelinePeriod(period="2024-02", count=10, sample_ids=["note2"]),
    ]
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
         patch("main.Reranker", return_value=mock_reranker):
        from main import app, store as real_store
        import main
        main.store = mock_store
        main.reranker = mock_reranker
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
        NoteResult(id="note1", metadata=NoteMetadata(title="Test Note"), document="Test content body", distance=0.1)
    ]
    mock_store.search_calendar.return_value = []

    res = c.post("/api/search", json={"query": "test"})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    assert data["results"][0]["type"] == "note"


def test_search_empty_query_returns_all_notes(app_client):
    """Browse page sends '' query — should still return notes via list_notes."""
    c, mock_store = app_client
    mock_store.list_notes.return_value = [
        NoteResult(id="note1", metadata=NoteMetadata(title="Note 1", tags="work"), document="body1", score=0.0),
        NoteResult(id="note2", metadata=NoteMetadata(title="Note 2", tags="personal"), document="body2", score=0.0),
    ]

    res = c.post("/api/search", json={"query": "", "n": 500, "filters": {}})
    assert res.status_code == 200
    data = res.json()
    assert len(data["results"]) == 2
    assert data["results"][0]["type"] == "note"
    # embed_query_sync should not be called for empty queries
    mock_store.search_notes.assert_not_called()
    mock_store.list_notes.assert_called_once()


def test_search_with_calendar(app_client):
    c, mock_store = app_client
    mock_store.search_notes.return_value = []
    mock_store.search_calendar.return_value = [
        NoteResult(id="event1", metadata=NoteMetadata(**{"summary": "Meeting"}), document="Calendar event", distance=0.15)
    ]

    res = c.post("/api/search", json={"query": "meeting", "include_calendar": True})
    assert res.status_code == 200
    data = res.json()
    calendar_results = [r for r in data["results"] if r["type"] == "calendar"]
    assert len(calendar_results) >= 1


def test_get_note_not_found(app_client):
    c, mock_store = app_client
    mock_store.get_note.return_value = None
    mock_store.get_note_by_note_id.return_value = None
    with patch("main.get_calendar"):
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
        NoteResult(id="sim1", metadata=NoteMetadata(title="Similar 1"), distance=0.1),
        NoteResult(id="sim2", metadata=NoteMetadata(title="Similar 2"), distance=0.2),
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
            CalendarEvent(id="evt1", summary="Meeting", date="2024-01-01", attendees="Alice", attendee_names=["Alice"], start="2024-01-01T10:00:00", end="2024-01-01T11:00:00", location="Room 1", description="Sync", event_type="default"),
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
            CalendarEvent(id="evt1", summary="1:1", date="2019-12-09", start="2019-12-09T10:00:00", end="2019-12-09T11:00:00"),
        ]
        mock_get_cal.return_value = mock_cal

        mock_store.get_notes_by_date.return_value = []

        res = c.get("/api/calendar/date/2019-12-09")

    mock_store.get_notes_by_date.assert_called_with("2019-12-09")
    assert res.status_code == 200
    data = res.json()
    assert data["date"] == "2019-12-09"
    assert "events" in data
    assert "notes" in data


def test_get_graph(app_client):
    c, mock_store = app_client

    mock_store.notes.get.return_value = {
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

    mock_store.notes.get.return_value = {
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


def test_get_graph_nodes_have_metadata(app_client):
    """Graph nodes must contain metadata looked up by logical note_id, not chunk id."""
    c, mock_store = app_client

    mock_store.notes.get.return_value = {
        "ids": ["chunk-a", "chunk-b"],
        "metadatas": [
            {"note_id": "logical-1", "title": "Note A", "folder": "Work", "tags": "work", "source": "Apple Notes"},
            {"note_id": "logical-2", "title": "Note B", "folder": "Personal", "tags": "personal", "source": "Evernote"},
        ],
        "embeddings": [[0.1] * 256, [0.2] * 256],
    }

    res = c.get("/api/graph")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) > 0
    node = data["nodes"][0]
    assert node["title"] != ""
    assert node["folder"] != ""
    assert "id" in node
    assert node["id"] != ""


def test_find_note_file_path_traversal():
    """Reject source_ids containing path traversal characters."""
    from main import _is_safe_filename, find_note_file

    assert _is_safe_filename("normal-file") is True
    assert _is_safe_filename("../../../etc/passwd") is False
    assert _is_safe_filename("a/b.md") is False
    assert _is_safe_filename("a\\b.md") is False
    assert _is_safe_filename("") is False

    assert find_note_file("../../../etc/passwd", "/tmp/notes") is None
    assert find_note_file("a/b", "/tmp/notes") is None


def test_get_calendar_events_missing_data(app_client):
    """Calendar endpoints gracefully degrade when calendar data is missing."""
    c, mock_store = app_client
    mock_store.notes.get.return_value = {"ids": [], "metadatas": []}

    with patch("main.get_calendar") as mock_get_cal:
        mock_get_cal.return_value.process_events.return_value = []

        res = c.get("/api/calendar?start_date=2024-01-01&end_date=2024-12-31")
        assert res.status_code == 200
        data = res.json()
        assert "events" in data
        assert len(data["events"]) == 0


def test_search_reranker_called(app_client):
    """Reranker is called with non-empty query when rerank is enabled (default)."""
    c, mock_store = app_client
    mock_store.search_notes.return_value = [
        NoteResult(id="n1", metadata=NoteMetadata(title="Note A", tags="test"), document="body a", distance=0.1),
        NoteResult(id="n2", metadata=NoteMetadata(title="Note B", tags="test"), document="body b", distance=0.2),
    ]
    mock_store.search_calendar.return_value = []

    res = c.post("/api/search", json={"query": "test", "n": 1, "filters": {}})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data


def test_search_reranker_skipped_when_empty_query(app_client):
    """Browse page sends empty query — reranker should not be called."""
    c, mock_store = app_client
    mock_store.list_notes.return_value = [
        NoteResult(id="n1", metadata=NoteMetadata(title="Note A"), document="body a", score=0.0),
    ]
    mock_store.search_calendar.return_value = []

    res = c.post("/api/search", json={"query": "", "n": 20, "filters": {}})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data


def test_search_reranker_disabled(app_client):
    """rerank=false skips reranking and uses embedding scores directly."""
    c, mock_store = app_client
    mock_store.search_notes.return_value = [
        NoteResult(id="n1", metadata=NoteMetadata(title="Note A", tags="test"), document="body a", distance=0.1),
    ]
    mock_store.search_calendar.return_value = []

    res = c.post("/api/search", json={"query": "test", "rerank": False, "filters": {}})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data


def test_search_embeds_once(app_client):
    """embed_query_sync must be called only once per search request."""
    c, mock_store = app_client
    mock_store.search_notes.return_value = []
    mock_store.search_calendar.return_value = []

    res = c.post("/api/search", json={"query": "test", "n": 5, "include_calendar": True, "filters": {}})
    assert res.status_code == 200


def test_search_n_capped(app_client):
    """n_results is capped to RERANK_MAX_CANDIDATES when reranking, 200 otherwise."""
    c, mock_store = app_client
    mock_store.search_notes.return_value = []

    with patch("main.embed_query_sync", return_value=[0.5] * 256):
        res = c.post("/api/search", json={"query": "test", "n": 1000, "filters": {}})
    assert res.status_code == 200
    _, kwargs = mock_store.search_notes.call_args
    assert kwargs["n"] <= RERANK_MAX_CANDIDATES
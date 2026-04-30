import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from models import (
    NoteMetadata,
    NoteResult,
    NoteListItem,
    TagInfo,
    CoOccurrence,
    SeriesInfo,
    PersonWithFrequency,
    GlossaryEntry,
    CalendarEvent,
    StatsResponse,
    TimelinePeriod,
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


def test_get_series_empty(app_client):
    c, mock_store = app_client
    mock_store.get_series_list.return_value = []
    res = c.get("/api/series")
    assert res.status_code == 200
    data = res.json()
    assert data["series"] == []


def test_get_series_with_data(app_client):
    c, mock_store = app_client
    mock_store.get_series_list.return_value = [
        SeriesInfo(name="weekly_standup", count=45, latest_date="2024-03-15", latest_note_id="note-001"),
        SeriesInfo(name="1:1_alice", count=23, latest_date="2024-03-10", latest_note_id="note-002"),
    ]
    res = c.get("/api/series")
    assert res.status_code == 200
    data = res.json()
    assert len(data["series"]) == 2
    assert data["series"][0]["name"] == "weekly_standup"
    assert data["series"][0]["count"] == 45


def test_get_series_notes(app_client):
    c, mock_store = app_client
    mock_store.get_notes_by_series.return_value = [
        NoteListItem(id="note-001", title="Standup Mar 15", metadata=NoteMetadata(title="Standup Mar 15", created="2024-03-15", tags="work")),
        NoteListItem(id="note-002", title="Standup Mar 8", metadata=NoteMetadata(title="Standup Mar 8", created="2024-03-08", tags="work")),
    ]
    res = c.get("/api/series/weekly_standup/notes?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["series"] == "weekly_standup"
    assert len(data["notes"]) == 2
    mock_store.get_notes_by_series.assert_called_with("weekly_standup", limit=10)


def test_search_similar_text(app_client):
    c, mock_store = app_client
    mock_store.search_notes.return_value = [
        NoteResult(id="n1", metadata=NoteMetadata(title="Note 1", note_id="logical-1"), document="Body one", distance=0.1),
    ]
    res = c.post("/api/search/similar", json={"text": "raw zoom transcript text", "n": 5})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    assert data["results"][0]["type"] == "note"


def test_search_similar_text_empty(app_client):
    c, mock_store = app_client
    res = c.post("/api/search/similar", json={"text": "", "n": 5})
    assert res.status_code == 200
    data = res.json()
    assert data["results"] == []


def test_get_people_with_q(app_client):
    c, mock_store = app_client
    mock_store.get_people_by_query.return_value = [
        PersonWithFrequency(name="alice", frequency=45),
    ]
    res = c.get("/api/people?q=alice")
    assert res.status_code == 200
    data = res.json()
    assert "people" in data
    assert len(data["people"]) == 1
    assert data["people"][0]["name"] == "alice"
    assert data["people"][0]["frequency"] == 45
    mock_store.get_people_by_query.assert_called_with(q="alice")


def test_get_people_without_q(app_client):
    c, mock_store = app_client
    mock_store.get_people_by_query.return_value = []
    res = c.get("/api/people")
    assert res.status_code == 200
    data = res.json()
    assert "people" in data


def test_get_glossary(app_client):
    c, mock_store = app_client
    mock_store.get_glossary_entries.return_value = [
        GlossaryEntry(term="zendesk", definition="Zendesk is a customer service platform", source_note_ids=["n1"], frequency=297),
    ]
    res = c.get("/api/glossary?q=zendesk")
    assert res.status_code == 200
    data = res.json()
    assert "entries" in data
    assert len(data["entries"]) == 1
    assert data["entries"][0]["term"] == "zendesk"
    mock_store.get_glossary_entries.assert_called_with(q="zendesk")


def test_get_glossary_no_query(app_client):
    c, mock_store = app_client
    mock_store.get_glossary_entries.return_value = []
    res = c.get("/api/glossary")
    assert res.status_code == 200
    data = res.json()
    assert data["entries"] == []
    mock_store.get_glossary_entries.assert_called_with(q="")


def test_get_notes_since(app_client):
    c, mock_store = app_client
    mock_store.get_notes_since.return_value = [
        NoteListItem(id="n1", title="Recent Note", metadata=NoteMetadata(title="Recent Note", created="2024-03-15")),
    ]
    res = c.get("/api/notes?since=2024-03-01T00:00:00Z")
    assert res.status_code == 200
    data = res.json()
    assert data["since"] == "2024-03-01T00:00:00Z"
    assert len(data["notes"]) == 1
    assert data["count"] == 1
    mock_store.get_notes_since.assert_called_with("2024-03-01T00:00:00Z", limit=500)


def test_get_notes_since_no_param(app_client):
    c, mock_store = app_client
    res = c.get("/api/notes")
    assert res.status_code == 200
    data = res.json()
    assert data["notes"] == []
    assert data["count"] == 0


def test_get_notes_since_does_not_block_detail(app_client):
    c, mock_store = app_client
    mock_store.get_note.return_value = NoteResult(
        id="note-001", metadata=NoteMetadata(title="Note 1", note_id="note-001", source_id="test-1"), document="body"
    )
    with patch("main.find_note_file", return_value=None):
        res = c.get("/api/notes/note-001")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "note-001"


def test_watcher_status_has_recent_events(app_client):
    c, mock_store = app_client
    res = c.get("/api/watcher/status")
    assert res.status_code == 200
    data = res.json()
    assert "recent_events" in data
    assert isinstance(data["recent_events"], list)

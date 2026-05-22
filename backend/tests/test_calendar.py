from models import CalendarEvent
import sys
import os
import json

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from calendar_data import CalendarProcessor


@pytest.mark.unit
def test_load_missing_calendar_graceful():
    cal = CalendarProcessor("/nonexistent/calendar.json", "/nonexistent/registry.json")
    cal.load()
    assert cal._events == []
    assert cal._alias_map == {}
    events = cal.process_events()
    assert events == []


@pytest.mark.unit
def test_load_missing_registry_graceful(tmp_path):
    cal_path = tmp_path / "calendar.json"
    cal_path.write_text('{"events": []}')
    cal = CalendarProcessor(str(cal_path), "/nonexistent/registry.json")
    cal.load()
    assert cal._events == []
    assert cal._alias_map == {}


@pytest.mark.unit
def test_load(loaded_calendar):
    assert loaded_calendar._events is not None


@pytest.mark.unit
def test_normalize_name_alias(loaded_calendar):
    assert loaded_calendar.normalize_name("Alice") == "Alice Smith"


@pytest.mark.unit
def test_normalize_name_canonical(loaded_calendar):
    assert loaded_calendar.normalize_name("Alice Smith") == "Alice Smith"


@pytest.mark.unit
def test_normalize_name_unknown(loaded_calendar):
    assert loaded_calendar.normalize_name("Unknown Person") == "Unknown Person"


@pytest.mark.unit
def test_normalize_name_empty(loaded_calendar):
    assert loaded_calendar.normalize_name("") == ""


@pytest.mark.unit
def test_process_events_count(loaded_calendar):
    events = loaded_calendar.process_events()
    assert len(events) == 3
    assert all(isinstance(e, CalendarEvent) for e in events)


@pytest.mark.unit
def test_process_events_fields(loaded_calendar):
    events = loaded_calendar.process_events()
    first = events[0]
    assert first.id
    assert first.summary
    assert first.start
    assert first.end
    assert hasattr(first, "location")
    assert hasattr(first, "date")
    assert hasattr(first, "attendees")
    assert hasattr(first, "attendee_names")


@pytest.mark.unit
def test_process_events_all_day(loaded_calendar):
    events = loaded_calendar.process_events()
    all_day = next(e for e in events if e.id == "evt003")
    assert all_day.date == "2021-06-01"
    assert "T00:00:00" in all_day.start


@pytest.mark.unit
def test_get_events_for_date(loaded_calendar):
    events = loaded_calendar.get_events_for_date("2019-12-09")
    assert len(events) == 1
    assert events[0].summary == "1:1 with Alice"


@pytest.mark.unit
def test_get_events_for_participant(loaded_calendar):
    events = loaded_calendar.get_events_for_participant("Alice")
    assert len(events) >= 1


@pytest.mark.unit
def test_get_embedding_text(loaded_calendar):
    events = loaded_calendar.process_events()
    first = events[0]
    text = loaded_calendar.get_embedding_text(first)
    assert not text.startswith("search_document:")
    assert "1:1 with Alice" in text
    assert "Alice Smith" in text
    assert "Conference Room A" in text


@pytest.mark.unit
def test_get_events_for_date_matches_notes(tmp_store, sample_calendar):
    """Calendar events link to notes by matching the date metadata field."""
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()

    matching_event = next(e for e in events if e.date == "2019-12-09")

    tmp_store.add_notes(
        ids=["n1", "n2"],
        documents=["doc1", "doc2"],
        embeddings=[[0.1] * 256, [0.2] * 256],
        metadatas=[
            {"note_id": "nid1", "title": "Note A", "date": "2019-12-09", "created": "2019-12-09T17:31:51-05:00"},
            {"note_id": "nid2", "title": "Note B", "date": "2020-03-15", "created": "2020-03-15T10:00:00Z"},
        ],
    )

    date_notes = tmp_store.notes.get(where={"date": "2019-12-09"}, include=["metadatas"])
    assert len(date_notes["ids"]) == 1
    assert date_notes["metadatas"][0]["title"] == "Note A"


@pytest.mark.unit
def test_process_events_cached(loaded_calendar):
    """process_events caches its output; subsequent calls return the same list."""
    first = loaded_calendar.process_events()
    second = loaded_calendar.process_events()
    assert first is second
    assert len(first) == 3

    # After load(), cache should be invalidated
    loaded_calendar.load()
    third = loaded_calendar.process_events()
    assert third is not first
    assert len(third) == 3

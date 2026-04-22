import sys
import os
import json

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from calendar_data import CalendarProcessor


def test_load_missing_calendar_graceful():
    cal = CalendarProcessor("/nonexistent/calendar.json", "/nonexistent/registry.json")
    cal.load()
    assert cal._events == []
    assert cal._alias_map == {}
    events = cal.process_events()
    assert events == []


def test_load_missing_registry_graceful(tmp_path):
    cal_path = tmp_path / "calendar.json"
    cal_path.write_text('{"events": []}')
    cal = CalendarProcessor(str(cal_path), "/nonexistent/registry.json")
    cal.load()
    assert cal._events == []
    assert cal._alias_map == {}


def test_load(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    assert cal._events is not None


def test_normalize_name_alias(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    assert cal.normalize_name("Alice") == "Alice Smith"


def test_normalize_name_canonical(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    assert cal.normalize_name("Alice Smith") == "Alice Smith"


def test_normalize_name_unknown(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    assert cal.normalize_name("Unknown Person") == "Unknown Person"


def test_normalize_name_empty(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    assert cal.normalize_name("") == ""


def test_process_events_count(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()
    assert len(events) == 3


def test_process_events_fields(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()
    first = events[0]
    assert "id" in first
    assert "summary" in first
    assert "start" in first
    assert "end" in first
    assert "location" in first
    assert "date" in first
    assert "attendees" in first
    assert "attendee_names" in first


def test_process_events_all_day(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()
    all_day = next(e for e in events if e["id"] == "evt003")
    assert all_day["date"] == "2021-06-01"
    assert "T00:00:00" in all_day["start"]


def test_get_events_for_date(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.get_events_for_date("2019-12-09")
    assert len(events) == 1
    assert events[0]["summary"] == "1:1 with Alice"


def test_get_events_for_participant(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.get_events_for_participant("Alice")
    assert len(events) >= 1


def test_get_embedding_text(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    events = cal.process_events()
    first = events[0]
    text = cal.get_embedding_text(first)
    assert text.startswith("search_document:")
    assert "1:1 with Alice" in text
    assert "Alice Smith" in text
    assert "Conference Room A" in text

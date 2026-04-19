import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from ingest import chunk_text, make_note_id, make_doc_id, get_calendar_context


def test_chunk_text_short():
    result = chunk_text("hello")
    assert result == ["hello"]


def test_chunk_text_empty():
    result = chunk_text("")
    assert result == []


def test_chunk_text_overlaps():
    text = "a" * 3000
    result = chunk_text(text)
    assert len(result) > 1
    assert result[1].startswith(text[1600:1600 + 400])


def test_chunk_text_custom_size():
    text = "".join(chr(65 + i % 26) for i in range(250))
    result = chunk_text(text, chunk_size=100, overlap=20)
    assert len(result) > 1
    assert result[0] == text[:100]
    assert result[1] == text[80:180]


def test_make_note_id_colons():
    result = make_note_id("x-coredata://test/id")
    assert ":" not in result
    assert "/" not in result


def test_make_note_id_strips_dashes():
    result = make_note_id("---test---")
    assert result == "test"


def test_make_note_id_evernote():
    result = make_note_id("evernote:note:abc123")
    assert ":" not in result


def test_make_doc_id_deterministic():
    id1 = make_doc_id("note1", 0, "file1.md")
    id2 = make_doc_id("note1", 0, "file2.md")
    assert id1 == id2
    assert id1 == "note1_chunk_0"


def test_make_doc_id_format():
    result = make_doc_id("note1", 0, "file.md")
    assert result == "note1_chunk_0"


def test_get_calendar_context_no_participants():
    result = get_calendar_context([], "2019-12-09", [])
    assert result == ""


def test_get_calendar_context_no_date():
    result = get_calendar_context(["Alice"], "", [])
    assert result == ""


def test_get_calendar_context_match():
    events = [{"date": "2019-12-09", "summary": "Meeting", "attendees": "Alice Smith", "attendee_names": ["Alice Smith"]}]
    result = get_calendar_context(["Alice"], "2019-12-09", events)
    assert "Meeting" in result
    assert "2019-12-09" in result


def test_get_calendar_context_no_match():
    events = [{"date": "2019-12-09", "summary": "Meeting", "attendees": "Alice Smith", "attendee_names": ["Alice Smith"]}]
    result = get_calendar_context(["Unknown"], "2019-12-09", events)
    assert result == ""

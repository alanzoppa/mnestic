import json
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from ingest import chunk_text, make_note_id, make_doc_id, get_calendar_context
from models import CalendarEvent


def test_chunk_text_short():
    result = chunk_text("hello")
    assert result == ["hello"]


def test_chunk_text_empty():
    result = chunk_text("")
    assert result == []


def test_chunk_text_respects_markdown():
    text = "\n\n".join([f"## Section {i}\n\n" + "This is a paragraph with many words to fill space. " * 30 for i in range(5)])
    result = chunk_text(text)
    assert len(result) > 1
    # MarkdownTextSplitter should keep headers intact and respect paragraphs
    for chunk in result:
        # Headers should not be split mid-line
        lines = chunk.splitlines()
        for line in lines:
            if line.startswith("##"):
                assert "Section" in line, "Headers should be kept whole"


def test_chunk_text_custom_size():
    text = "word " * 500
    result = chunk_text(text, chunk_size=100, overlap=20)
    assert len(result) > 1
    # Chunks should be approximately the requested size
    for chunk in result:
        assert len(chunk) <= 120  # allow some structural overhead


def test_chunk_text_overlap():
    text = "\n\nParagraph " + "word " * 100 + "\n\nParagraph " + "word " * 100
    chunks = chunk_text(text, chunk_size=200, overlap=40)
    assert len(chunks) > 1
    # Adjacent chunks should have some shared content
    for i in range(len(chunks) - 1):
        words_current = set(chunks[i].split())
        words_next = set(chunks[i+1].split())
        shared = words_current & words_next
        assert len(shared) > 0, "overlapping chunks should share some words"


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


def test_make_doc_id_different_for_different_files():
    id1 = make_doc_id("note1", 0, "file1.md")
    id2 = make_doc_id("note1", 0, "file2.md")
    assert id1 != id2
    assert id1.startswith("note1_file_")
    assert id1.endswith("_chunk_0")


def test_make_doc_id_same_for_same_file():
    id1 = make_doc_id("note1", 0, "file.md")
    id2 = make_doc_id("note1", 0, "file.md")
    assert id1 == id2
    assert "file_" in id1
    assert "_chunk_0" in id1


def test_get_calendar_context_no_participants():
    result = get_calendar_context([], "2019-12-09", [])
    assert result == ""


def test_get_calendar_context_no_date():
    result = get_calendar_context(["Alice"], "", [])
    assert result == ""


def test_get_calendar_context_match():
    events = [CalendarEvent(id="evt1", summary="Meeting", start="2019-12-09T10:00:00", end="2019-12-09T11:00:00", attendees="Alice Smith", attendee_names=["Alice Smith"], date="2019-12-09")]
    result = get_calendar_context(["Alice"], "2019-12-09", events)
    assert "Meeting" in result
    assert "2019-12-09" in result


def test_get_calendar_context_no_match():
    events = [CalendarEvent(id="evt1", summary="Meeting", start="2019-12-09T10:00:00", end="2019-12-09T11:00:00", attendees="Alice Smith", attendee_names=["Alice Smith"], date="2019-12-09")]
    result = get_calendar_context(["Unknown"], "2019-12-09", events)
    assert result == ""

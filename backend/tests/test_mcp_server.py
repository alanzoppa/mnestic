import asyncio
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from mcp_server import setup_mcp
import mcp_server as mcp_server_module

from calendar_data import CalendarProcessor


def _run(coro):
    """Run an async coroutine for test assertions."""
    return asyncio.run(coro)


def _tool_text(result):
    """Extract JSON text from an MCP tool result."""
    if result is None:
        return None
    content = getattr(result, "content", None)
    if not content:
        return None
    first = content[0]
    return getattr(first, "text", None)


def _resource_text(result):
    """Extract text string from an MCP resource read result."""
    contents = getattr(result, "contents", None)
    if not contents:
        return ""
    first = contents[0]
    return getattr(first, "content", "")


@pytest.fixture
def sample_embeddings():
    """Return a set of distinct 256-dim embeddings."""
    return {
        "e1": [0.1] * 256,
        "e2": [0.2] * 256,
        "e3": [0.3] * 256,
        "e4": [0.4] * 256,
    }


@pytest.fixture
def populated_store(tmp_store, sample_embeddings):
    """Populate tmp_store with 4 notes for consistent testing."""
    e = sample_embeddings
    tmp_store.add_notes(
        ids=["note1", "note2", "note3", "note4"],
        documents=["doc1", "doc2", "doc3", "doc4"],
        embeddings=[e["e1"], e["e2"], e["e3"], e["e4"]],
        metadatas=[
            {
                "note_id": "nid1",
                "title": "Meeting Notes",
                "folder": "Work",
                "tags": "work,meeting",
                "participants": "Alice,Bob",
                "created": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
                "modified": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
                "source": "Apple Notes",
                "source_id": "x-coredata://meeting",
            },
            {
                "note_id": "nid2",
                "title": "Project Roadmap",
                "folder": "Work",
                "tags": "work,roadmap",
                "participants": "Alice",
                "created": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(),
                "modified": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(),
                "source": "Evernote",
                "source_id": "evernote:note:abc",
            },
            {
                "note_id": "nid3",
                "title": "Personal Journal",
                "folder": "Personal",
                "tags": "personal,journal",
                "participants": [],
                "created": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
                "modified": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
                "source": "Apple Notes",
                "source_id": "x-coredata://journal",
            },
            {
                "note_id": "nid4",
                "title": "Sprint Review",
                "folder": "Work",
                "tags": "work,meeting",
                "participants": "Bob,Charlie",
                "created": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
                "modified": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
                "source": "Apple Notes",
                "source_id": "x-coredata://sprint",
            },
        ],
    )
    return tmp_store


@pytest.fixture
def populated_store_with_calendar(populated_store, tmp_path):
    """Return a calendar processor alongside the populated store."""
    cal = CalendarProcessor()
    return populated_store, cal


@pytest.mark.unit
def test_search_notes_mocked_embedding(populated_store):
    with patch("embed.embed_query_sync", return_value=[0.15] * 256):
        mcp = setup_mcp(populated_store, calendar_processor=None)
        result = _run(mcp.call_tool("search_notes", {"query": "meeting", "limit": 5}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    assert "notes" in data
    titles = {n["title"] for n in data["notes"]}
    assert "Meeting Notes" in titles


@pytest.mark.unit
def test_get_note_found(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("get_note", {"note_id": "nid1"}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    assert data["title"] == "Meeting Notes"
    assert data["folder"] == "Work"
    assert data["source"] == "Apple Notes"
    assert "tags" in data
    assert "participants" in data
    assert "content" in data
    assert "calendar_events" in data
    assert "similar_notes" in data


@pytest.mark.unit
def test_get_note_not_found(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("get_note", {"note_id": "nonexistent"}))

    assert _tool_text(result) is None


@pytest.mark.unit
def test_get_recent_notes_filter_and_sort(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("get_recent_notes", {"days": 50}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    assert len(data["notes"]) == 3  # 5d, 10d, 45d

    dates = [n["created"] for n in data["notes"]]
    assert dates == sorted(dates, reverse=True)


@pytest.mark.unit
def test_list_tags_counts_and_cooccur(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("list_tags", {}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    tags = {t["name"]: t["count"] for t in data["tags"]}
    assert tags.get("work") == 3
    assert tags.get("meeting") == 2
    assert tags.get("personal") == 1

    co = {tuple(sorted([c["tag1"], c["tag2"]])): c["count"] for c in data["co_occurrence"]}
    assert ("meeting", "work") in co


@pytest.mark.unit
def test_get_notes_by_tag_exact_match(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("get_notes_by_tag", {"tag": "meeting", "limit": 10}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    titles = {n["title"] for n in data["notes"]}
    assert "Meeting Notes" in titles
    assert "Sprint Review" in titles
    assert "Project Roadmap" not in titles


@pytest.mark.unit
def test_get_stats(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("get_stats", {}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    assert data["total_notes"] == 4
    assert data["total_calendar_events"] == 0
    assert data["avg_note_length"] > 0
    assert data["date_range"][0] is not None


@pytest.mark.unit
def test_get_calendar_events_empty_with_none_processor(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.call_tool("get_calendar_events", {}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    assert data["events"] == []


@pytest.mark.unit
def test_find_similar_notes(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    # "nid1" is a logical note_id (not the raw chunk ID), so this exercises
    # the resolution fallback that maps logical IDs to underlying chunk IDs.
    result = _run(mcp.call_tool("find_similar_notes", {"note_id": "nid1", "limit": 3}))

    text = _tool_text(result)
    assert text is not None
    data = json.loads(text)
    assert len(data["notes"]) == 3
    ids = {n["id"] for n in data["notes"]}
    assert "nid1" not in ids
    assert all("score" in n for n in data["notes"])


@pytest.mark.unit
def test_resource_stats(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.read_resource("notes://stats"))

    text = _resource_text(result)
    assert "Total notes: 4" in text
    assert "Total tags:" in text


@pytest.mark.unit
def test_resource_recent(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.read_resource("notes://recent"))

    text = _resource_text(result)
    assert "Notes from the last 7 days" in text
    assert "Meeting Notes" in text


@pytest.mark.unit
def test_resource_recent_days(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.read_resource("notes://recent/50"))

    text = _resource_text(result)
    assert "Notes from the last 50 days" in text
    assert "Meeting Notes" in text
    assert "Sprint Review" in text
    assert "Project Roadmap" in text
    assert "Personal Journal" not in text


@pytest.mark.unit
def test_resource_note(populated_store, tmp_path, monkeypatch):
    notes_dir = tmp_path / "notes"
    notes_dir.mkdir()
    # source_id contains colons, so also create a fallback by note_id filename
    note_file = notes_dir / "nid1.md"
    note_file.write_text("# Meeting Notes\n\nThis is the body.\n")

    monkeypatch.setattr(mcp_server_module, "NOTES_DIR", str(notes_dir))
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.read_resource("notes://note/nid1"))

    text = _resource_text(result)
    assert "Title: Meeting Notes" in text
    assert "Folder: Work" in text
    assert "This is the body" in text


@pytest.mark.unit
def test_resource_tags(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.read_resource("notes://tags"))

    text = _resource_text(result)
    assert "work:" in text
    assert "meeting:" in text


@patch("embed.embed_query_sync", return_value=[0.15] * 256)
@pytest.mark.unit
def test_resource_search(mock_embed, populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.read_resource("notes://search/meeting"))

    text = _resource_text(result)
    assert 'Search results for "meeting"' in text
    assert "Meeting Notes" in text


@pytest.mark.unit
def test_prompt_summarize_recent(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.render_prompt("summarize_recent", {"days": "14"}))

    assert len(result.messages) == 1
    msg = result.messages[0]
    assert "last 14 days" in msg.content.text


@pytest.mark.unit
def test_prompt_find_connections(populated_store):
    mcp = setup_mcp(populated_store, calendar_processor=None)
    result = _run(mcp.render_prompt("find_connections", {"person": "Alice"}))

    assert len(result.messages) == 1
    msg = result.messages[0]
    assert "Alice" in msg.content.text
    assert "projects, topics, or events" in msg.content.text

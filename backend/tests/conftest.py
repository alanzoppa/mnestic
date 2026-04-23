import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import frontmatter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from store import NoteStore
from calendar_data import CalendarProcessor


@pytest.fixture
def tmp_store(tmp_path):
    return NoteStore(persist_dir=str(tmp_path / "chroma_test"))


@pytest.fixture
def sample_note_files(tmp_path):
    notes_dir = tmp_path / "notes"
    notes_dir.mkdir()

    notes = [
        {
            "title": "Test Note One",
            "folder": "Notes",
            "created": "2019-12-09T17:31:51-05:00",
            "modified": "2019-12-09T17:45:50-05:00",
            "source_id": "x-coredata://test-note-1",
            "source": "Apple Notes",
            "tags": ["notes", "test"],
            "participants": ["Alice", "Bob"],
            "content": "This is the body of test note one. It has some content about management and hiring.",
        },
        {
            "title": "Test Note Two",
            "folder": "Work",
            "created": "2020-03-15T10:00:00Z",
            "modified": "2020-03-15T12:00:00Z",
            "source_id": "evernote:note:abc123def456",
            "source": "Evernote",
            "tags": ["work", "evernote", "zendesk"],
            "participants": [],
            "content": "Body of test note two. Discussion about React, Redux, and frontend architecture.",
        },
        {
            "title": "Test Short Note",
            "folder": "Personal",
            "created": "2021-06-01T08:00:00Z",
            "modified": "2021-06-01T08:30:00Z",
            "source_id": "x-coredata://test-short",
            "source": "Apple Notes",
            "tags": ["personal"],
            "participants": [],
            "content": "Short note.",
        },
    ]

    filenames = []
    for note_data in notes:
        content = note_data.pop("content")
        post = frontmatter.Post(content)
        for k, v in note_data.items():
            post.metadata[k] = v
        safe_name = post.metadata["title"].replace(" ", "_")
        filepath = notes_dir / f"{safe_name}.md"
        with open(filepath, "wb") as f:
            frontmatter.dump(post, f, allow_unicode=True)
        filenames.append(str(filepath))

    return notes_dir, filenames


@pytest.fixture
def sample_calendar(tmp_path):
    calendar_data = {
        "events": [
            {
                "id": "evt001",
                "summary": "1:1 with Alice",
                "start": {"dateTime": "2019-12-09T10:00:00-06:00"},
                "end": {"dateTime": "2019-12-09T11:00:00-06:00"},
                "location": "Conference Room A",
                "description": "Weekly sync",
                "attendees": [
                    {"displayName": "Alice Smith", "email": "alice@example.com", "self": False},
                    {"displayName": "C. Alan Zoppa", "email": "alan@example.com", "self": True},
                ],
                "eventType": "default",
            },
            {
                "id": "evt002",
                "summary": "Team Standup",
                "start": {"dateTime": "2020-03-15T09:00:00-05:00"},
                "end": {"dateTime": "2020-03-15T09:15:00-05:00"},
                "location": "",
                "description": "",
                "attendees": [],
                "eventType": "default",
            },
            {
                "id": "evt003",
                "summary": "All-day Retreat",
                "start": {"date": "2021-06-01"},
                "end": {"date": "2021-06-02"},
                "location": "Offsite",
                "description": "Quarterly planning",
                "attendees": [
                    {"displayName": "Bob Jones", "email": "bob@example.com", "self": False},
                ],
                "eventType": "default",
            },
        ]
    }
    cal_path = tmp_path / "calendar.json"
    cal_path.write_text(json.dumps(calendar_data))

    registry = {
        "_metadata": {"total_people": 2},
        "Alice Smith": {"aliases": ["Alice"], "context": "direct report"},
        "Bob Jones": {"aliases": ["Bob"], "context": "colleague"},
    }
    reg_path = tmp_path / "people_registry.json"
    reg_path.write_text(json.dumps(registry))

    return str(cal_path), str(reg_path)


@pytest.fixture
def loaded_calendar(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    return cal
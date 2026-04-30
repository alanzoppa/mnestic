import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from store import NoteStore
from models import NoteMetadata, NoteResult, NoteListItem, SeriesInfo, PersonWithFrequency, GlossaryEntry
import pytest


def test_get_series_list_empty(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1"],
        documents=["doc1"],
        embeddings=[embedding],
        metadatas=[{"title": "Note 1", "tags": "work"}],
    )
    result = tmp_store.get_series_list()
    assert len(result) == 0


def test_get_series_list_with_series(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2", "note3"],
        documents=["doc1", "doc2", "doc3"],
        embeddings=[embedding, [0.2]*256, [0.3]*256],
        metadatas=[
            {"title": "Standup 1", "tags": "work", "series": "weekly_standup", "created": "2024-01-01"},
            {"title": "Standup 2", "tags": "work", "series": "weekly_standup", "created": "2024-01-08"},
            {"title": "1:1 Alice", "tags": "1:1", "series": "1:1_alice", "created": "2024-01-05"},
        ],
    )
    result = tmp_store.get_series_list()
    assert len(result) == 2
    assert result[0].name == "weekly_standup"
    assert result[0].count == 2
    assert result[1].name == "1:1_alice"
    assert result[1].count == 1


def test_get_notes_by_series(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2", "note3"],
        documents=["doc1", "doc2", "doc3"],
        embeddings=[embedding, [0.2]*256, [0.3]*256],
        metadatas=[
            {"title": "Old Standup", "tags": "work", "series": "weekly_standup", "created": "2024-01-01", "note_id": "n1"},
            {"title": "New Standup", "tags": "work", "series": "weekly_standup", "created": "2024-02-01", "note_id": "n2"},
            {"title": "Other Note", "tags": "personal", "series": "other_series", "created": "2024-01-15", "note_id": "n3"},
        ],
    )
    result = tmp_store.get_notes_by_series("weekly_standup")
    assert len(result) == 2
    assert result[0].title == "New Standup"
    assert result[1].title == "Old Standup"


def test_get_notes_by_series_respects_limit(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1", "n2", "n3"],
        documents=["d1", "d2", "d3"],
        embeddings=[embedding, [0.2]*256, [0.3]*256],
        metadatas=[
            {"title": "S1", "series": "test_series", "created": "2024-01-01", "note_id": "n1"},
            {"title": "S2", "series": "test_series", "created": "2024-02-01", "note_id": "n2"},
            {"title": "S3", "series": "test_series", "created": "2024-03-01", "note_id": "n3"},
        ],
    )
    result = tmp_store.get_notes_by_series("test_series", limit=2)
    assert len(result) == 2


def test_get_people_by_query(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1", "n2"],
        documents=["d1", "d2"],
        embeddings=[embedding, [0.2]*256],
        metadatas=[
            {"title": "Note", "participants": "Alice, Bob", "note_id": "n1"},
            {"title": "Note2", "participants": "Alice", "note_id": "n2"},
        ],
    )
    result = tmp_store.get_people_by_query(q="ali")
    assert len(result) == 1
    assert result[0].name == "alice"
    assert result[0].frequency == 2


def test_get_people_by_query_no_match(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1"],
        documents=["d1"],
        embeddings=[embedding],
        metadatas=[{"title": "Note", "participants": "Alice", "note_id": "n1"}],
    )
    result = tmp_store.get_people_by_query(q="nonexistent")
    assert len(result) == 0


def test_get_people_by_query_all(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1", "n2"],
        documents=["d1", "d2"],
        embeddings=[embedding, [0.2]*256],
        metadatas=[
            {"title": "Note", "participants": "Alice, Bob", "note_id": "n1"},
            {"title": "Note2", "participants": "Charlie", "note_id": "n2"},
        ],
    )
    result = tmp_store.get_people_by_query()
    assert len(result) == 3


def test_get_glossary_entries(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1", "n2"],
        documents=["d1", "d2"],
        embeddings=[embedding, [0.2]*256],
        metadatas=[
            {"title": "T1", "tags": "work,notes", "note_id": "n1"},
            {"title": "T2", "tags": "work", "note_id": "n2"},
        ],
    )
    result = tmp_store.get_glossary_entries(q="work")
    assert len(result) >= 1
    assert result[0].term == "work"
    assert result[0].frequency >= 2


def test_get_notes_since(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1", "n2"],
        documents=["d1", "d2"],
        embeddings=[embedding, [0.2]*256],
        metadatas=[
            {"title": "Old", "created": "2024-01-01T10:00:00Z", "note_id": "n1"},
            {"title": "New", "created": "2024-06-01T10:00:00Z", "note_id": "n2"},
        ],
    )
    result = tmp_store.get_notes_since("2024-03-01T00:00:00Z")
    assert len(result) == 1
    assert result[0].title == "New"


def test_get_notes_since_future(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1"],
        documents=["d1"],
        embeddings=[embedding],
        metadatas=[{"title": "Old", "created": "2024-01-01T10:00:00Z", "note_id": "n1"}],
    )
    result = tmp_store.get_notes_since("2099-01-01T00:00:00Z")
    assert len(result) == 0


def test_get_notes_since_bad_timestamp(tmp_store):
    result = tmp_store.get_notes_since("not-a-date")
    assert len(result) == 0
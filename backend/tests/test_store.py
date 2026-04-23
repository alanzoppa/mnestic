import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from store import NoteStore, _serialize_metadata, _to_chroma_scalar as _flatten_tags, _to_chroma_scalar_participants as _flatten_participants
import pytest


def test_flatten_tags_list():
    assert _flatten_tags(["a", "b", "c"]) == "a,b,c"


def test_flatten_tags_string():
    assert _flatten_tags("already") == "already"


def test_flatten_tags_none():
    assert _flatten_tags(None) == ""


def test_flatten_participants_list():
    assert _flatten_participants(["Alice", "Bob"]) == "Alice,Bob"


def test_flatten_participants_none():
    assert _flatten_participants(None) == ""


def test_serialize_metadata_lists():
    assert _serialize_metadata({"tags": ["a", "b"]}) == {"tags": "a,b"}


def test_serialize_metadata_none():
    assert _serialize_metadata({"x": None}) == {}


def test_serialize_metadata_bool():
    assert _serialize_metadata({"flag": True}) == {"flag": "true"}


def test_serialize_metadata_int():
    assert _serialize_metadata({"count": 5}) == {"count": 5}


def test_add_and_search_notes(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256
    embedding3 = [0.3] * 256

    tmp_store.add_notes(
        ids=["note1", "note2", "note3"],
        documents=["doc1", "doc2", "doc3"],
        embeddings=[embedding1, embedding2, embedding3],
        metadatas=[{"title": "Note 1"}, {"title": "Note 2"}, {"title": "Note 3"}],
    )

    results = tmp_store.search_notes(embedding1, n=5)
    result_ids = [r["id"] for r in results]
    assert "note1" in result_ids


def test_add_and_search_calendar(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256

    tmp_store.add_calendar_events(
        ids=["cal1", "cal2"],
        documents=["event1", "event2"],
        embeddings=[embedding1, embedding2],
        metadatas=[{"title": "Event 1"}, {"title": "Event 2"}],
    )

    results = tmp_store.search_calendar(embedding1, n=5)
    assert len(results) >= 1
    assert results[0]["id"] == "cal1"


def test_get_note_found(tmp_store):
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1"],
        documents=["doc1"],
        embeddings=[embedding],
        metadatas=[{"title": "Test Note", "tags": ["work", "notes"]}],
    )

    result = tmp_store.get_note("note1")
    assert result is not None
    assert result["id"] == "note1"
    assert "title" in result["metadata"]


def test_get_note_not_found(tmp_store):
    result = tmp_store.get_note("nonexistent")
    assert result is None


def test_get_tags(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256

    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding1, embedding2],
        metadatas=[{"tags": ["work", "notes"]}, {"tags": ["work", "personal"]}],
    )

    tag_list, _ = tmp_store.get_tags()
    tag_counts = {t["name"]: t["count"] for t in tag_list}
    assert tag_counts["work"] == 2
    assert tag_counts["notes"] == 1
    assert tag_counts["personal"] == 1


def test_get_tags_co_occurrence(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256

    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding1, embedding2],
        metadatas=[{"tags": ["work", "notes"]}, {"tags": ["work", "notes"]}],
    )

    _, co_occur = tmp_store.get_tags()
    work_notes = next((c for c in co_occur if c["tag1"] == "notes" and c["tag2"] == "work"), None)
    assert work_notes is not None
    assert work_notes["count"] == 2


def test_get_timeline(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256

    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding1, embedding2],
        metadatas=[{"created": "2024-01-15T10:00:00"}, {"created": "2024-01-20T12:00:00"}],
    )

    timeline = tmp_store.get_timeline(group_by="month")
    assert len(timeline) == 1
    assert timeline[0]["period"] == "2024-01"
    assert timeline[0]["count"] == 2


def test_get_timeline_filter_by_tag(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256

    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding1, embedding2],
        metadatas=[
            {"created": "2024-01-15T10:00:00", "tags": "work"},
            {"created": "2024-01-20T12:00:00", "tags": "personal"},
        ],
    )

    timeline = tmp_store.get_timeline(group_by="month", tag="work")
    assert len(timeline) == 1
    assert timeline[0]["count"] == 1
    assert "note1" in timeline[0]["sample_ids"]


def test_get_stats(tmp_store):
    embedding1 = [0.1] * 256
    embedding2 = [0.2] * 256

    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["hello world", "another note here"],
        embeddings=[embedding1, embedding2],
        metadatas=[{"created": "2024-01-15T10:00:00", "title": "Note 1"}, {"created": "2024-01-20T12:00:00", "title": "Note 2"}],
    )

    cal_embedding = [0.3] * 256
    tmp_store.add_calendar_events(
        ids=["cal1"],
        documents=["event"],
        embeddings=[cal_embedding],
        metadatas=[{"summary": "Test Event"}],
    )

    stats = tmp_store.get_stats()
    assert stats["total_notes"] == 2
    assert stats["total_calendar_events"] == 1
    assert stats["total_tags"] >= 0
    assert stats["avg_note_length"] > 0


def test_delete_notes(tmp_store):
    embedding = [0.1] * 256

    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding, [0.2] * 256],
        metadatas=[{"title": "Note 1"}, {"title": "Note 2"}],
    )

    tmp_store.delete_notes(["note1"])

    result = tmp_store.get_note("note1")
    assert result is None

    result2 = tmp_store.get_note("note2")
    assert result2 is not None


def test_reset(tmp_store):
    embedding = [0.1] * 256

    tmp_store.add_notes(
        ids=["note1"],
        documents=["doc1"],
        embeddings=[embedding],
        metadatas=[{"title": "Note 1"}],
    )

    tmp_store.add_calendar_events(
        ids=["cal1"],
        documents=["event"],
        embeddings=[embedding],
        metadatas=[{"summary": "Event 1"}],
    )

    tmp_store.reset()

    stats = tmp_store.get_stats()
    assert stats["total_notes"] == 0
    assert stats["total_calendar_events"] == 0


def test_get_notes_by_tag_no_documents(tmp_store):
    """get_notes_by_tag must not load document bodies — only metadata."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding, [0.2] * 256],
        metadatas=[
            {"tags": "work,notes"},
            {"tags": "personal"},
        ],
    )
    result = tmp_store.get_notes_by_tag("work")
    assert len(result) == 1
    assert result[0]["id"] == "note1"
    assert result[0]["document"] == ""


def test_get_notes_by_tag_with_where(tmp_store):
    """get_notes_by_tag passes where clauses through to ChromaDB."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding, [0.2] * 256],
        metadatas=[
            {"tags": "work,notes", "source": "Apple Notes"},
            {"tags": "work,personal", "source": "Evernote"},
        ],
    )
    result = tmp_store.get_notes_by_tag("work", where={"source": "Evernote"})
    assert len(result) == 1
    assert result[0]["metadata"]["source"] == "Evernote"


def test_get_similar_single_db_call(tmp_store):
    """get_similar must issue only one DB get call."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2", "note3"],
        documents=["d1", "d2", "d3"],
        embeddings=[embedding, [0.2] * 256, [0.3] * 256],
        metadatas=[{"title": "N1"}, {"title": "N2"}, {"title": "N3"}],
    )
    original_get = tmp_store._notes.get
    call_count = [0]

    def counting_get(*args, **kwargs):
        call_count[0] += 1
        return original_get(*args, **kwargs)

    tmp_store._notes.get = counting_get
    similar = tmp_store.get_similar("note1", n=2)
    tmp_store._notes.get = original_get

    assert call_count[0] == 1
    assert len(similar) <= 2
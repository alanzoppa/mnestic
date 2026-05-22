import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from store import NoteStore, _serialize_metadata, _to_chroma_scalar as _flatten_tags, _to_chroma_scalar as _flatten_participants
from models import NoteResult, NoteMetadata, TagInfo, CoOccurrence, TimelinePeriod, StatsResponse
from unittest.mock import MagicMock, PropertyMock, patch
import pytest


@pytest.mark.integration
def test_flatten_tags_list():
    assert _flatten_tags(["a", "b", "c"]) == "a,b,c"


@pytest.mark.integration
def test_flatten_tags_string():
    assert _flatten_tags("already") == "already"


@pytest.mark.integration
def test_flatten_tags_none():
    assert _flatten_tags(None) == ""


@pytest.mark.integration
def test_flatten_participants_list():
    assert _flatten_participants(["Alice", "Bob"]) == "Alice,Bob"


@pytest.mark.integration
def test_flatten_participants_none():
    assert _flatten_participants(None) == ""


@pytest.mark.integration
def test_serialize_metadata_lists():
    assert _serialize_metadata({"tags": ["a", "b"]}) == {"tags": "a,b"}


@pytest.mark.integration
def test_serialize_metadata_none():
    assert _serialize_metadata({"x": None}) == {}


@pytest.mark.integration
def test_serialize_metadata_bool():
    assert _serialize_metadata({"flag": True}) == {"flag": "true"}


@pytest.mark.integration
def test_serialize_metadata_int():
    assert _serialize_metadata({"count": 5}) == {"count": 5}


@pytest.mark.integration
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
    result_ids = [r.id for r in results]
    assert "note1" in result_ids


@pytest.mark.integration
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
    assert results[0].id == "cal1"


@pytest.mark.integration
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
    assert result.id == "note1"
    assert result.metadata.title == "Test Note"


@pytest.mark.integration
def test_get_note_not_found(tmp_store):
    result = tmp_store.get_note("nonexistent")
    assert result is None


@pytest.mark.integration
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
    tag_counts = {t.name: t.count for t in tag_list}
    assert tag_counts["work"] == 2
    assert tag_counts["notes"] == 1
    assert tag_counts["personal"] == 1


@pytest.mark.integration
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
    work_notes = next((c for c in co_occur if c.tag1 == "notes" and c.tag2 == "work"), None)
    assert work_notes is not None
    assert work_notes.count == 2


@pytest.mark.integration
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
    assert timeline[0].period == "2024-01"
    assert timeline[0].count == 2


@pytest.mark.integration
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
    assert timeline[0].count == 1
    assert "note1" in timeline[0].sample_ids


@pytest.mark.integration
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
    assert stats.total_notes == 2
    assert stats.total_calendar_events == 1
    assert stats.total_tags >= 0
    assert stats.avg_note_length > 0


@pytest.mark.integration
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


@pytest.mark.integration
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
    assert stats.total_notes == 0
    assert stats.total_calendar_events == 0


@pytest.mark.integration
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
    assert result[0].id == "note1"
    assert result[0].document == ""


@pytest.mark.integration
def test_get_notes_by_tag_deduplicates_by_note_id(tmp_store):
    """A note with multiple chunks sharing a tag must appear only once."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1_chunk_0", "n1_chunk_1", "n1_chunk_2", "n2_chunk_0"],
        documents=["d1a", "d1b", "d1c", "d2"],
        embeddings=[embedding, [0.3] * 256, [0.5] * 256, [0.7] * 256],
        metadatas=[
            {"note_id": "n1", "tags": "meeting,work"},
            {"note_id": "n1", "tags": "meeting,work"},
            {"note_id": "n1", "tags": "meeting,work"},
            {"note_id": "n2", "tags": "meeting"},
        ],
    )
    result = tmp_store.get_notes_by_tag("meeting")
    assert len(result) == 2
    note_ids = {r.metadata.note_id for r in result}
    assert note_ids == {"n1", "n2"}


@pytest.mark.integration
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
    assert result[0].metadata.source == "Evernote"


@pytest.mark.integration
def test_get_similar_single_db_call(tmp_store):
    """get_similar must issue only one DB get call."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2", "note3"],
        documents=["d1", "d2", "d3"],
        embeddings=[embedding, [0.2] * 256, [0.3] * 256],
        metadatas=[{"title": "N1"}, {"title": "N2"}, {"title": "N3"}],
    )
    # notes is a property returning a fresh collection each time; save original.get
    actual_collection = tmp_store.notes
    original_get = actual_collection.get
    call_count = [0]

    def counting_get(*args, **kwargs):
        call_count[0] += 1
        return original_get(*args, **kwargs)

    mock_collection = MagicMock()
    mock_collection.get = counting_get
    with patch.object(type(tmp_store), 'notes', new_callable=PropertyMock, return_value=mock_collection):
        similar = tmp_store.get_similar("note1", n=2)

    assert call_count[0] == 1
    assert len(similar) <= 2


@pytest.mark.integration
def test_list_notes_no_filter(tmp_store):
    """list_notes returns all unique notes when no where filter is applied."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding, [0.2] * 256],
        metadatas=[
            {"title": "Note 1", "folder": "Work", "note_id": "n1"},
            {"title": "Note 2", "folder": "Personal", "note_id": "n2"},
        ],
    )
    results = tmp_store.list_notes()
    assert len(results) == 2
    titles = {r.metadata.title for r in results}
    assert titles == {"Note 1", "Note 2"}


@pytest.mark.integration
def test_list_notes_with_where_filter(tmp_store):
    """list_notes respects the where parameter for filtering."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["note1", "note2"],
        documents=["doc1", "doc2"],
        embeddings=[embedding, [0.2] * 256],
        metadatas=[
            {"title": "Note 1", "folder": "Work", "note_id": "n1"},
            {"title": "Note 2", "folder": "Personal", "note_id": "n2"},
        ],
    )
    results = tmp_store.list_notes(where={"folder": "Work"})
    assert len(results) == 1
    assert results[0].metadata.title == "Note 1"


@pytest.mark.integration
def test_list_notes_deduplicates_by_note_id(tmp_store):
    """list_notes returns only one entry per logical note_id (skips chunks)."""
    embedding = [0.1] * 256
    tmp_store.add_notes(
        ids=["n1_chunk0", "n1_chunk1"],
        documents=["doc1", "doc2"],
        embeddings=[embedding, embedding],
        metadatas=[
            {"title": "Note 1", "note_id": "n1"},
            {"title": "Note 1", "note_id": "n1"},
        ],
    )
    results = tmp_store.list_notes()
    assert len(results) == 1
    assert results[0].metadata.title == "Note 1"

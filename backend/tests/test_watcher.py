import sys
import os
import json
import time
import threading
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from watcher import NoteWatcher, _DebounceEntry

DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture
def setup_watcher(tmp_path):
    notes_dir = tmp_path / "notes"
    notes_dir.mkdir()
    mock_store = MagicMock()
    mock_store.delete_note_chunks = MagicMock(return_value=0)
    mock_store.add_notes = MagicMock()
    cache_called = []

    def _invalidate():
        cache_called.append(1)

    w = NoteWatcher(str(notes_dir), store=mock_store, invalidate_cache_callback=_invalidate)
    return w, notes_dir, mock_store, cache_called


def write_note(path, title="Test", source_id="note1", body="Hello"):
    content = (
        "---\n"
        f"title: {title}\n"
        f"source_id: {source_id}\n"
        "created: 2024-01-01T00:00:00Z\n"
        "modified: 2024-01-01T00:00:00Z\n"
        "source: Test\n"
        "tags: [tag]\n"
        "participants: []\n"
        "---\n\n"
        f"{body}"
    )
    path.write_text(content, encoding="utf-8")


@pytest.mark.integration
def test_status_initial(setup_watcher):
    w, *_ = setup_watcher
    s = w.status()
    assert s["running"] is False
    assert s["events_processed"] == 0
    assert s["pending_count"] == 0
    assert s["recent_events"] == []


@pytest.mark.integration
def test_build_filename_map(setup_watcher):
    w, notes_dir, *_ = setup_watcher
    write_note(notes_dir / "test.md")
    w._build_filename_map()
    assert w._filename_to_note_id.get("test.md") == "note1"


@pytest.mark.integration
def test_handle_upsert(setup_watcher):
    w, notes_dir, mock_store, *_ = setup_watcher
    write_note(notes_dir / "test.md")
    with patch("watcher.embed_texts_sync", return_value=[DUMMY_EMBEDDING]):
        w._handle_upsert("test.md")
    mock_store.delete_note_chunks.assert_called_once()
    mock_store.add_notes.assert_called_once()
    assert w._filename_to_note_id.get("test.md") == "note1"


@pytest.mark.integration
def test_handle_upsert_no_chunks_skips(setup_watcher):
    w, notes_dir, mock_store, *_ = setup_watcher
    write_note(notes_dir / "test.md", body="")
    with patch("watcher.embed_texts_sync", return_value=[]):
        w._handle_upsert("test.md")
    mock_store.delete_note_chunks.assert_not_called()
    mock_store.add_notes.assert_not_called()


@pytest.mark.integration
def test_handle_delete(setup_watcher):
    w, notes_dir, mock_store, cache_called = setup_watcher
    w._filename_to_note_id = {"test.md": "note1"}
    state_file = notes_dir / ".ingest_state.json"
    state_file.write_text('{"files": {"note1": {"mtime": 1, "chunks": 2}}}')
    w._handle_delete("note1", "test.md")
    mock_store.delete_note_chunks.assert_called_once_with("note1")
    assert len(cache_called) == 1
    data = json.loads(state_file.read_text())
    assert "note1" not in data.get("files", {})


@pytest.mark.integration
def test_on_event_filters_non_md(setup_watcher):
    w, *_ = setup_watcher
    w._on_event("modified", "/some/path/photo.jpg")
    assert len(w._pending) == 0


@pytest.mark.integration
def test_on_event_filters_ingest_state(setup_watcher):
    w, *_ = setup_watcher
    w._on_event("modified", "/some/path/.ingest_state.json")
    assert len(w._pending) == 0


@pytest.mark.integration
def test_on_event_debounce(setup_watcher):
    w, *_ = setup_watcher
    w._on_event("modified", "/some/path/test.md")
    assert "test.md" in w._pending
    w._on_event("modified", "/some/path/test.md")
    assert len(w._pending) == 1


@pytest.mark.integration
def test_on_deleted_immediate(setup_watcher):
    w, _, mock_store, cache_called = setup_watcher
    w._filename_to_note_id = {"test.md": "note1"}
    w._on_event("deleted", "/some/path/test.md")
    assert "test.md" not in w._filename_to_note_id
    mock_store.delete_note_chunks.assert_called_once_with("note1")
    assert len(cache_called) == 1


@pytest.mark.integration
def test_process_pending_ready(setup_watcher):
    w, notes_dir, mock_store, *_ = setup_watcher
    write_note(notes_dir / "test.md")
    from watcher import DEBOUNCE_SECONDS

    w._pending["test.md"] = _DebounceEntry(
        event_type="modified",
        scheduled_at=time.monotonic() - DEBOUNCE_SECONDS - 1,
    )
    with patch("watcher.embed_texts_sync", return_value=[DUMMY_EMBEDDING]):
        w._process_pending()
    mock_store.delete_note_chunks.assert_called_once()
    assert "test.md" not in w._pending


@pytest.mark.integration
def test_process_pending_batch(setup_watcher):
    w, notes_dir, mock_store, *_ = setup_watcher
    write_note(notes_dir / "a.md", source_id="a", title="A")
    write_note(notes_dir / "b.md", source_id="b", title="B")
    from watcher import DEBOUNCE_SECONDS

    stale = time.monotonic() - DEBOUNCE_SECONDS - 1
    w._pending["a.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)
    w._pending["b.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)
    with patch("watcher.embed_texts_bulk", return_value=[DUMMY_EMBEDDING, DUMMY_EMBEDDING]):
        w._process_pending()
    assert mock_store.delete_note_chunks.call_count == 2
    assert mock_store.add_notes.call_count == 2
    assert w._filename_to_note_id.get("a.md") == "a"
    assert w._filename_to_note_id.get("b.md") == "b"
    assert w._events_processed == 2
    assert "a.md" not in w._pending
    assert "b.md" not in w._pending


@pytest.mark.integration
def test_record_event_roll(setup_watcher):
    w, *_ = setup_watcher
    for i in range(25):
        w._record_event("upsert", f"n{i}.md", f"note{i}")
    assert len(w._recent_events) == 20
    assert w._recent_events[0]["filename"] == "n5.md"
    assert w._recent_events[-1]["filename"] == "n24.md"


@pytest.mark.integration
def test_update_ingest_state(setup_watcher):
    w, notes_dir, *_ = setup_watcher
    md_path = notes_dir / "test.md"
    md_path.write_text("x")
    w._update_ingest_state("note1", md_path, 2)
    state = json.loads((notes_dir / ".ingest_state.json").read_text())
    assert state["files"]["note1"]["chunks"] == 2


@pytest.mark.integration
def test_remove_note_id(setup_watcher):
    w, notes_dir, *_ = setup_watcher
    state_file = notes_dir / ".ingest_state.json"
    state_file.write_text('{"files": {"note1": {"chunks": 1}}}')
    w._remove_from_ingest_state("note1")
    state = json.loads(state_file.read_text())
    assert "note1" not in state.get("files", {})


@pytest.mark.integration
def test_start_stop(setup_watcher):
    w, *_ = setup_watcher
    assert w.running is False
    w.start()
    assert w.running is True
    w.stop()
    assert w.running is False


@pytest.mark.integration
def test_startup_scan_queues_untracked(setup_watcher):
    w, notes_dir, *_ = setup_watcher
    write_note(notes_dir / "untracked.md", source_id="untracked", body="Hello world")
    w._startup_scan()
    assert "untracked.md" in w._pending
    assert w._filename_to_note_id.get("untracked.md") == "untracked"


@pytest.mark.integration
def test_startup_scan_queues_stale_mtime(setup_watcher):
    w, notes_dir, *_ = setup_watcher
    write_note(notes_dir / "stale.md", source_id="stale", body="Content")
    state_file = notes_dir / ".ingest_state.json"
    state_file.write_text('{"files": {"stale": {"mtime": 1, "chunks": 2}}}')
    w._startup_scan()
    assert "stale.md" in w._pending


@pytest.mark.integration
def test_startup_scan_skips_up_to_date(setup_watcher):
    w, notes_dir, *_ = setup_watcher
    write_note(notes_dir / "fresh.md", source_id="fresh", body="Content")
    fp = notes_dir / "fresh.md"
    mtime = fp.stat().st_mtime
    state_file = notes_dir / ".ingest_state.json"
    state_file.write_text(json.dumps({"files": {"fresh": {"mtime": mtime, "chunks": 2}}}))
    w._startup_scan()
    assert "fresh.md" not in w._pending


@pytest.mark.integration
def test_startup_scan_cleans_state_orphans(setup_watcher):
    w, notes_dir, mock_store, cache_called = setup_watcher
    w._filename_to_note_id = {"existing.md": "existing"}
    state_file = notes_dir / ".ingest_state.json"
    state_file.write_text('{"files": {"existing": {"mtime": 1}, "orphan": {"mtime": 1}}}')
    w._store = mock_store
    w._cleanup_orphans(json.loads(state_file.read_text()).get("files", {}))
    mock_store.delete_note_chunks.assert_any_call("orphan")
    assert "orphan" not in json.loads(state_file.read_text()).get("files", {})
    assert len(cache_called) == 1


@pytest.mark.integration
def test_startup_scan_cleans_chroma_orphans(setup_watcher):
    w, notes_dir, mock_store, cache_called = setup_watcher
    w._filename_to_note_id = {"existing.md": "existing"}
    mock_store.get_unique_notes.return_value = {
        "ids": ["doc1"],
        "metadatas": [{"note_id": "orphan"}],
    }
    w._cleanup_orphans({})
    mock_store.delete_note_chunks.assert_called_once_with("orphan")
    assert len(cache_called) == 1


@pytest.mark.integration
def test_on_moved_queues_upsert(setup_watcher):
    w, notes_dir, mock_store, *_ = setup_watcher
    write_note(notes_dir / "moved.md", source_id="moved", body="Moved content")
    w._on_event("moved", str(notes_dir / "moved.md"))
    assert "moved.md" in w._pending


@pytest.mark.integration
def test_on_moved_debounce(setup_watcher):
    w, *_ = setup_watcher
    w._on_event("moved", "/some/path/moved.md")
    assert "moved.md" in w._pending

    w._on_event("moved", "/some/path/moved.md")
    assert len(w._pending) == 1


@pytest.mark.integration
def test_start_resolves_symlink(tmp_path):
    real_dir = tmp_path / "real_notes"
    real_dir.mkdir()
    write_note(real_dir / "test.md", source_id="symtest")

    link_dir = tmp_path / "link_notes"
    link_dir.symlink_to(real_dir)

    mock_store = MagicMock()
    mock_store.delete_note_chunks = MagicMock(return_value=0)
    mock_store.add_notes = MagicMock()
    mock_store.get_unique_notes = MagicMock(return_value={"ids": [], "metadatas": []})

    w = NoteWatcher(str(link_dir), store=mock_store, invalidate_cache_callback=None)

    with patch("watcher.Observer.schedule") as mock_schedule:
        w.start()

    args, _ = mock_schedule.call_args
    scheduled_path = args[1]
    assert scheduled_path == str(real_dir.resolve())
    assert scheduled_path != str(link_dir)

    w.stop()


@pytest.mark.integration
@pytest.mark.slow
def test_full_cycle_multiple_files_batch(setup_watcher):
    w, notes_dir, mock_store, _ = setup_watcher
    from watcher import DEBOUNCE_SECONDS

    write_note(notes_dir / "a.md", source_id="batch_a", title="A")
    write_note(notes_dir / "b.md", source_id="batch_b", title="B")
    write_note(notes_dir / "c.md", source_id="batch_c", title="C")

    stale = time.monotonic() - DEBOUNCE_SECONDS - 1
    w._filename_to_note_id = {"a.md": "batch_a", "b.md": "batch_b", "c.md": "batch_c"}
    w._pending["a.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)
    w._pending["b.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)
    w._pending["c.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)

    with patch("watcher.embed_texts_bulk", return_value=[DUMMY_EMBEDDING] * 3) as mock_bulk:
        with patch("watcher.embed_texts_sync") as mock_sync:
            with patch.object(w, "_startup_scan"):
                w.start()
                time.sleep(2)

    mock_bulk.assert_called_once()
    mock_sync.assert_not_called()

    assert mock_store.add_notes.call_count == 3
    assert mock_store.delete_note_chunks.call_count == 3
    assert w.status()["events_processed"] == 3

    w.stop()


@pytest.mark.integration
@pytest.mark.slow
def test_git_pull_scenario(setup_watcher):
    w, notes_dir, mock_store, _ = setup_watcher
    from watcher import DEBOUNCE_SECONDS

    write_note(notes_dir / "existing.md", source_id="existing", body="Old content")
    write_note(notes_dir / "new1.md", source_id="new1", body="New file 1")
    write_note(notes_dir / "new2.md", source_id="new2", body="New file 2")

    state_file = notes_dir / ".ingest_state.json"
    state_data = {"files": {"to_delete": {"mtime": 1, "chunks": 1}}}
    state_file.write_text(json.dumps(state_data))

    # Simulate the startup scan's orphan cleanup for the deleted file
    w._handle_delete("to_delete", "to_delete.md")

    stale = time.monotonic() - DEBOUNCE_SECONDS - 1
    w._filename_to_note_id = {"existing.md": "existing", "new1.md": "new1", "new2.md": "new2"}
    w._pending["existing.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)
    w._pending["new1.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)
    w._pending["new2.md"] = _DebounceEntry(event_type="modified", scheduled_at=stale)

    with patch("watcher.embed_texts_bulk", return_value=[DUMMY_EMBEDDING] * 3) as mock_bulk:
        with patch("watcher.embed_texts_sync") as mock_sync:
            with patch.object(w, "_startup_scan"):
                w.start()
                time.sleep(2)

    mock_bulk.assert_called_once()
    mock_sync.assert_not_called()

    assert mock_store.add_notes.call_count == 3
    # 3 upsert chunk deletes + 1 orphan deletion = 4
    assert mock_store.delete_note_chunks.call_count == 4

    # 3 upserts + 1 orphan deletion
    assert w.status()["events_processed"] == 4

    # Deleted file's note_id was removed from ChromaDB
    delete_calls_for_deleted = [c for c in mock_store.delete_note_chunks.call_args_list if c[0][0] == "to_delete"]
    assert len(delete_calls_for_deleted) >= 1

    # Deleted file's entry removed from state
    final_state = json.loads(state_file.read_text())
    assert "to_delete" not in final_state.get("files", {})

    w.stop()

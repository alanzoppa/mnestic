import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient


DUMMY_EMBEDDING = [0.1] * 256


@pytest.fixture
def app_client():
    mock_store = MagicMock()
    mock_store.get_stats.return_value = {
        "total_notes": 0,
        "total_tags": 0,
        "date_range": [None, None],
        "avg_note_length": 0,
        "total_calendar_events": 0,
    }
    mock_store.search_notes.return_value = []
    mock_store.search_calendar.return_value = []
    mock_store.get_note.return_value = None
    mock_store.get_similar.return_value = []

    mock_reranker = MagicMock()
    mock_reranker.rerank.side_effect = lambda query, candidates: candidates

    with patch("main.NoteStore", return_value=mock_store), \
         patch("main.embed_query_sync", return_value=DUMMY_EMBEDDING), \
         patch("main.Reranker", return_value=mock_reranker):
        from main import app, store as real_store
        import main as main_module
        main_module.store = mock_store
        main_module.reranker = mock_reranker
        client = TestClient(app)
        yield client, mock_store


@pytest.fixture
def app_client_with_store(tmp_path):
    """App client backed by a real NoteStore for graph tests."""
    from store import NoteStore

    store = NoteStore(persist_dir=str(tmp_path / "chroma_test"))

    mock_reranker = MagicMock()
    mock_reranker.rerank.side_effect = lambda query, candidates: candidates

    with patch("main.NoteStore", return_value=store), \
         patch("main.embed_query_sync", return_value=DUMMY_EMBEDDING), \
         patch("main.Reranker", return_value=mock_reranker):
        from main import app
        import main as main_module
        main_module.store = store
        main_module.reranker = mock_reranker
        client = TestClient(app)
        yield client, store


def test_graph_empty(app_client):
    c, _ = app_client
    res = c.get("/api/graph")
    assert res.status_code == 200
    data = res.json()
    assert data == {"nodes": [], "edges": []}


def test_graph_single_note(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["note_1_chunk_0"],
        documents=["Alpha"],
        embeddings=[[1.0, 0.0]],
        metadatas=[{"note_id": "note_1", "title": "Alpha", "tags": "work"}],
    )
    res = c.get("/api/graph")
    assert res.status_code == 200
    data = res.json()
    assert data["nodes"] == []
    assert data["edges"] == []


def test_graph_two_similar_notes(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.9, 0.1]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work,important"},
            {"note_id": "note_2", "title": "Beta", "tags": "work"},
        ],
    )
    res = c.get("/api/graph?threshold=0.75")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) == 1
    assert data["edges"][0]["weight"] >= 0.75


def test_graph_same_note_id_skip(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["note_1_chunk_0", "note_1_chunk_1"],
        documents=["Alpha part 1", "Alpha part 2"],
        embeddings=[[1.0, 0.0], [0.95, 0.05]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work"},
            {"note_id": "note_1", "title": "Alpha", "tags": "work"},
        ],
    )
    res = c.get("/api/graph?threshold=0.75")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) == 0
    assert len(data["edges"]) == 0


def test_graph_tag_filter(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["n1_chunk_0", "n2_chunk_0", "n3_chunk_0"],
        documents=["A", "B", "C"],
        embeddings=[[1.0, 0.0], [0.9, 0.1], [0.1, 1.0]],
        metadatas=[
            {"note_id": "n1", "title": "Work Note", "tags": "work"},
            {"note_id": "n2", "title": "Another Work", "tags": "work"},
            {"note_id": "n3", "title": "Personal", "tags": "personal"},
        ],
    )
    res = c.get("/api/graph?tag=work&threshold=0.75")
    assert res.status_code == 200
    data = res.json()
    for node in data["nodes"]:
        assert "work" in node.get("tags", [])


def test_graph_threshold_behavior(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["n1_chunk_0", "n2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.7, 0.7]],
        metadatas=[
            {"note_id": "n1", "title": "Alpha", "tags": "work"},
            {"note_id": "n2", "title": "Beta", "tags": "work"},
        ],
    )
    res_high = c.get("/api/graph?threshold=0.95")
    assert res_high.status_code == 200
    assert len(res_high.json()["edges"]) == 0

    res_low = c.get("/api/graph?threshold=0.5")
    assert res_low.status_code == 200
    assert len(res_low.json()["edges"]) == 1


def test_graph_response_schema(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["n1_chunk_0", "n2_chunk_0"],
        documents=["A", "B"],
        embeddings=[[1.0, 0.0], [0.9, 0.1]],
        metadatas=[
            {"note_id": "n1", "title": "Note One", "folder": "Work", "tags": "work", "source": "Apple Notes", "created": "2024-01-01"},
            {"note_id": "n2", "title": "Note Two", "folder": "Personal", "tags": "personal", "source": "Evernote", "created": "2024-02-01"},
        ],
    )
    res = c.get("/api/graph?threshold=0.75")
    assert res.status_code == 200
    data = res.json()
    if data["nodes"]:
        node = data["nodes"][0]
        assert "id" in node
        assert "title" in node
        assert "folder" in node
        assert "tags" in node
        assert "source" in node
        assert "created" in node
    if data["edges"]:
        edge = data["edges"][0]
        assert "source" in edge
        assert "target" in edge
        assert "weight" in edge


def test_search_graph_empty(app_client_with_store):
    c, store = app_client_with_store
    res = c.get("/api/search-graph?query=test")
    assert res.status_code == 200
    data = res.json()
    assert data == {"nodes": [], "edges": []}


def test_search_graph_with_results(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["n1_chunk_0", "n2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[DUMMY_EMBEDDING, [0.1] * 256],
        metadatas=[
            {"note_id": "n1", "title": "Alpha", "tags": "work", "chunk_index": 0},
            {"note_id": "n2", "title": "Beta", "tags": "work", "chunk_index": 0},
        ],
    )
    res = c.get("/api/search-graph?query=test&threshold=0.55&n=50")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) == 1
    res = c.get("/api/search-graph?query=test&threshold=0.55&n=50")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) == 1


def test_search_graph_scores_on_nodes(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["n1_chunk_0", "n2_chunk_0"],
        documents=["Work notes", "Personal stuff"],
        embeddings=[DUMMY_EMBEDDING, [0.09 + 0.01 * i for i in range(256)]],
        metadatas=[
            {"note_id": "n1", "title": "Work", "tags": "work", "chunk_index": 0},
            {"note_id": "n2", "title": "Personal", "tags": "personal", "chunk_index": 0},
        ],
    )
    res = c.get("/api/search-graph?query=test&threshold=0.55")
    assert res.status_code == 200
    data = res.json()
    if data["nodes"]:
        for node in data["nodes"]:
            assert "search_score" in node


def test_search_graph_no_query(app_client_with_store):
    c, store = app_client_with_store
    res = c.get("/api/search-graph?query=   ")
    assert res.status_code == 200
    data = res.json()
    assert data == {"nodes": [], "edges": []}


def test_search_graph_reranker_integration(app_client_with_store):
    c, store = app_client_with_store
    store.add_notes(
        ids=["n1_chunk_0", "n2_chunk_0"],
        documents=["A", "B"],
        embeddings=[DUMMY_EMBEDDING, [0.1 if i % 2 == 0 else 0.0 for i in range(256)]],
        metadatas=[
            {"note_id": "n1", "title": "A", "tags": "work", "chunk_index": 0},
            {"note_id": "n2", "title": "B", "tags": "work", "chunk_index": 0},
        ],
    )
    res = c.get("/api/search-graph?query=test&threshold=0.95")
    assert res.status_code == 200
    data = res.json()
    assert len(data["edges"]) == 0

    res2 = c.get("/api/search-graph?query=test&threshold=0.5")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["nodes"]) == 2
    assert len(data2["edges"]) == 1
    assert data2["edges"][0]["weight"] >= 0.5

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock

import pytest

from graph_service import build_similarity_graph_from_notes

DUMMY_EMBEDDING = [0.1] * 256


def test_empty_note_ids(tmp_store):
    result = build_similarity_graph_from_notes(tmp_store, [])
    assert result == {"nodes": [], "edges": []}


def test_single_note(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0"],
        documents=["Alpha"],
        embeddings=[[1.0, 0.0]],
        metadatas=[{"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 0}],
    )
    result = build_similarity_graph_from_notes(tmp_store, ["note_1"])
    assert result["nodes"] == []
    assert result["edges"] == []


def test_two_similar_notes(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.95, 0.05]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work,important", "chunk_index": 0},
            {"note_id": "note_2", "title": "Beta", "tags": "work", "chunk_index": 0},
        ],
    )
    result = build_similarity_graph_from_notes(tmp_store, ["note_1", "note_2"], threshold=0.75)
    assert len(result["nodes"]) == 2
    assert len(result["edges"]) == 1
    assert result["edges"][0]["weight"] >= 0.75


def test_two_dissimilar_notes(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.1, 0.9]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 0},
            {"note_id": "note_2", "title": "Beta", "tags": "personal", "chunk_index": 0},
        ],
    )
    result = build_similarity_graph_from_notes(tmp_store, ["note_1", "note_2"], threshold=0.75)
    assert len(result["nodes"]) == 0
    assert len(result["edges"]) == 0


def test_duplicate_note_ids(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0", "note_1_chunk_1"],
        documents=["Alpha part 1", "Alpha part 2"],
        embeddings=[[1.0, 0.0], [0.95, 0.05]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 0},
            {"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 1},
        ],
    )
    result = build_similarity_graph_from_notes(tmp_store, ["note_1"], threshold=0.75)
    assert len(result["nodes"]) == 0
    assert len(result["edges"]) == 0


def test_scores_propagation(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.9, 0.1]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 0},
            {"note_id": "note_2", "title": "Beta", "tags": "work", "chunk_index": 0},
        ],
    )
    scores = {"note_1": 0.95, "note_2": 0.88}
    result = build_similarity_graph_from_notes(tmp_store, ["note_1", "note_2"], scores=scores)
    for node in result["nodes"]:
        assert "search_score" in node
        assert node["search_score"] == scores[node["id"]]


def test_no_scores(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.9, 0.1]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 0},
            {"note_id": "note_2", "title": "Beta", "tags": "work", "chunk_index": 0},
        ],
    )
    result = build_similarity_graph_from_notes(tmp_store, ["note_1", "note_2"])
    for node in result["nodes"]:
        assert "search_score" not in node


def test_tags_as_list(tmp_store):
    tmp_store.add_notes(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        documents=["Alpha", "Beta"],
        embeddings=[[1.0, 0.0], [0.95, 0.05]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work,important,test", "chunk_index": 0},
            {"note_id": "note_2", "title": "Beta", "tags": "personal", "chunk_index": 0},
        ],
    )
    result = build_similarity_graph_from_notes(tmp_store, ["note_1", "note_2"], threshold=0.75)
    assert len(result["nodes"]) == 2
    for node in result["nodes"]:
        assert isinstance(node["tags"], list)
    note1 = next(n for n in result["nodes"] if n["id"] == "note_1")
    assert "work" in note1["tags"]
    assert "important" in note1["tags"]
    assert "test" in note1["tags"]


def test_note_ids_capped_at_1000(tmp_store):
    many_ids = [f"note_{i}" for i in range(1500)]
    result = build_similarity_graph_from_notes(tmp_store, many_ids, threshold=0.75)
    assert result == {"nodes": [], "edges": []}


def test_missing_embeddings(tmp_store):
    mock_store = MagicMock()
    mock_store._notes.get.return_value = {
        "ids": ["note_1_chunk_0"],
        "metadatas": [{"note_id": "note_1", "title": "Alpha", "tags": "work", "chunk_index": 0}],
        "embeddings": [None],
    }
    result = build_similarity_graph_from_notes(mock_store, ["note_1"])
    assert result == {"nodes": [], "edges": []}
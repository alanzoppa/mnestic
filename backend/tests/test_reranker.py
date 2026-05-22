from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from rerank import Reranker
from constants import RERANKER_MODEL, RERANK_BATCH_SIZE


@pytest.mark.unit
def test_init_default_model():
    r = Reranker()
    assert r.model_name == RERANKER_MODEL


@pytest.mark.unit
def test_init_custom_model():
    r = Reranker("custom/model")
    assert r.model_name == "custom/model"


@pytest.mark.unit
def test_available_false_when_cross_encoder_none():
    with patch("rerank.CrossEncoder", None):
        r = Reranker()
        assert not r.available()


@pytest.mark.unit
def test_rerank_returns_original_order_when_unavailable():
    candidates = [{"title": "B", "score": 0.5}, {"title": "A", "score": 0.9}]
    with patch("rerank.CrossEncoder", None):
        r = Reranker()
        result = r.rerank("test", candidates)
    assert result == candidates


@pytest.mark.unit
def test_rerank_empty_candidates():
    r = Reranker()
    assert r.rerank("test", []) == []


@pytest.mark.unit
def test_rerank_builds_correct_pairs():
    mock_model = MagicMock()
    mock_model.predict.return_value = [0.9]
    candidates = [{"title": "My Title", "snippet": "My snippet."}]
    with patch("rerank.CrossEncoder", return_value=mock_model):
        r = Reranker()
        r.rerank("my query", candidates)
    mock_model.predict.assert_called_once()
    args, kwargs = mock_model.predict.call_args
    assert args[0] == [("my query", "My Title. My snippet.")]


@pytest.mark.unit
def test_rerank_sorts_by_score_descending():
    mock_model = MagicMock()
    mock_model.predict.return_value = [0.3, 0.9, 0.6]
    candidates = [
        {"title": "Low", "score": 0.0},
        {"title": "High", "score": 0.0},
        {"title": "Mid", "score": 0.0},
    ]
    with patch("rerank.CrossEncoder", return_value=mock_model):
        r = Reranker()
        result = r.rerank("test", candidates)
    titles = [c["title"] for c in result]
    assert titles == ["High", "Mid", "Low"]


@pytest.mark.unit
def test_rerank_uses_batch_size():
    mock_model = MagicMock()
    mock_model.predict.return_value = [0.9]
    candidates = [{"title": "T", "snippet": "S."}]
    with patch("rerank.CrossEncoder", return_value=mock_model):
        r = Reranker()
        r.rerank("q", candidates)
    _, kwargs = mock_model.predict.call_args
    assert kwargs["batch_size"] == RERANK_BATCH_SIZE

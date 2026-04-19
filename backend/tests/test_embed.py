import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from embed import _l2_normalize, EMBED_DIM, embed_texts_sync
from unittest.mock import patch, MagicMock

import pytest


def test_l2_normalize_zero_vector():
    assert _l2_normalize([0, 0, 0]) == [0, 0, 0]


def test_l2_normalize_unit_vector():
    result = _l2_normalize([1, 0, 0])
    assert result == [1, 0, 0]


def test_l2_normalize_arbitrary():
    result = _l2_normalize([3, 4])
    assert abs(result[0] - 0.6) < 1e-10
    assert abs(result[1] - 0.8) < 1e-10


def test_l2_normalize_result_has_norm_1():
    vec = [1.2, -3.4, 5.6, 7.8]
    result = _l2_normalize(vec)
    norm = math.sqrt(sum(x * x for x in result))
    assert abs(norm - 1.0) < 1e-10


def test_embed_texts_sync_empty():
    result = embed_texts_sync([])
    assert result == []


def _make_mock_response(embeddings):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"embeddings": embeddings}
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _make_mock_client(responses):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.side_effect = responses
    return mock_client


def test_embed_texts_sync_calls_ollama():
    with patch("embed.httpx.Client") as mock_cls:
        mock_client = _make_mock_client([_make_mock_response([[0.1] * 768])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"])

        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://localhost:11434/api/embed"
        assert call_args[1]["json"]["model"] == "nomic-embed-text-v2-moe"


def test_embed_texts_sync_prefixes_search_document():
    with patch("embed.httpx.Client") as mock_cls:
        mock_client = _make_mock_client([_make_mock_response([[0.1] * 768])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"])

        call_args = mock_client.post.call_args
        input_field = call_args[1]["json"]["input"]
        assert input_field[0].startswith("search_document: ")


def test_embed_texts_sync_prefixes_search_query():
    with patch("embed.httpx.Client") as mock_cls:
        mock_client = _make_mock_client([_make_mock_response([[0.1] * 768])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"], prefix="search_query")

        call_args = mock_client.post.call_args
        input_field = call_args[1]["json"]["input"]
        assert input_field[0].startswith("search_query: ")


def test_embed_texts_sync_truncates_to_256():
    with patch("embed.httpx.Client") as mock_cls:
        mock_client = _make_mock_client([_make_mock_response([[0.1] * 768])])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["hello"])

        assert len(result) == 1
        assert len(result[0]) == EMBED_DIM


def test_embed_texts_sync_batching():
    resp = _make_mock_response([[0.1] * 768, [0.2] * 768])
    with patch("embed.httpx.Client") as mock_cls, patch("embed.BATCH_SIZE", 2):
        mock_client = _make_mock_client([resp, resp])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["a", "b", "c", "d"])

        assert len(result) == 4


def test_embed_texts_sync_retry_splits_batch():
    success_resp_single = _make_mock_response([[0.1] * 768])
    with patch("embed.httpx.Client") as mock_cls:
        mock_client = _make_mock_client([success_resp_single, success_resp_single])
        mock_cls.return_value = mock_client
        mock_client.post.side_effect = [Exception("fail"), success_resp_single, success_resp_single]

        result = embed_texts_sync(["hello", "world"])

        assert len(result) == 2
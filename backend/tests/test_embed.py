import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from embed import (
    _l2_normalize,
    EMBED_DIM,
    embed_texts_sync,
    embed_texts_bulk,
    embed_query_sync,
    _prefix_text,
)
from constants import EMBED_PREFIX_DOC, EMBED_PREFIX_QUERY
from unittest.mock import patch, MagicMock

import pytest
import httpx


@pytest.mark.unit
def test_l2_normalize_zero_vector():
    assert _l2_normalize([0, 0, 0]) == [0, 0, 0]


@pytest.mark.unit
def test_l2_normalize_unit_vector():
    result = _l2_normalize([1, 0, 0])
    assert result == [1, 0, 0]


@pytest.mark.unit
def test_l2_normalize_arbitrary():
    result = _l2_normalize([3, 4])
    assert abs(result[0] - 0.6) < 1e-10
    assert abs(result[1] - 0.8) < 1e-10


@pytest.mark.unit
def test_l2_normalize_result_has_norm_1():
    vec = [1.2, -3.4, 5.6, 7.8]
    result = _l2_normalize(vec)
    norm = math.sqrt(sum(x * x for x in result))
    assert abs(norm - 1.0) < 1e-10


@pytest.mark.unit
def test_embed_texts_sync_empty():
    result = embed_texts_sync([])
    assert result == []


def _make_ollama_response(embeddings):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"embeddings": embeddings}
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _make_openrouter_response(embeddings):
    mock_resp = MagicMock()
    data = [{"object": "embedding", "index": i, "embedding": emb} for i, emb in enumerate(embeddings)]
    mock_resp.json.return_value = {"data": data, "model": "google/gemini-embedding-2"}
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _make_mock_client(responses):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.side_effect = responses
    return mock_client


def _mock_settings(provider_ingest="ollama", provider_query="ollama"):
    mock = MagicMock()
    mock.embed_provider_ingest = provider_ingest
    mock.embed_provider_query = provider_query
    mock.ollama_embed_model = "qwen3-embedding"
    mock.openrouter_embed_model = "google/gemini-embedding-2"
    mock.openrouter_api_key = "test-key"
    return mock


@pytest.mark.unit
def test_ollama_provider_calls_ollama_endpoint():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * 1024])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"], provider="ollama")

        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://localhost:11434/api/embed"
        assert call_args[1]["json"]["model"] == "qwen3-embedding"


@pytest.mark.unit
def test_ollama_doc_prefix_is_empty():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * 1024])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"], provider="ollama")

        call_args = mock_client.post.call_args
        input_field = call_args[1]["json"]["input"]
        assert input_field[0] == "hello"


@pytest.mark.unit
def test_ollama_query_prefix_is_empty():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * 1024])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"], prefix=EMBED_PREFIX_QUERY, provider="ollama")

        call_args = mock_client.post.call_args
        input_field = call_args[1]["json"]["input"]
        assert input_field[0] == "hello"


@pytest.mark.unit
def test_prefix_text_empty_prefix():
    assert _prefix_text("hello", "") == "hello"


@pytest.mark.unit
def test_prefix_text_nonempty():
    assert _prefix_text("hello", "Instruct: test\nQuery: ") == "Instruct: test\nQuery: hello"


@pytest.mark.unit
def test_openrouter_provider_calls_openrouter_endpoint():
    mock_settings = _mock_settings()
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", mock_settings):
        mock_client = _make_mock_client([_make_openrouter_response([[0.1] * 256])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"], provider="openrouter")

        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "https://openrouter.ai/api/v1/embeddings"
        body = call_args[1]["json"]
        assert body["model"] == "google/gemini-embedding-2"
        assert body["dimensions"] == EMBED_DIM
        assert body["input_type"] == "search_document"
        headers = call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer test-key"


@pytest.mark.unit
def test_openrouter_query_uses_search_query_type():
    mock_settings = _mock_settings()
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", mock_settings):
        mock_client = _make_mock_client([_make_openrouter_response([[0.1] * 256])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"], prefix=EMBED_PREFIX_QUERY, provider="openrouter", is_query=True)

        body = mock_client.post.call_args[1]["json"]
        assert body["input_type"] == "search_query"


@pytest.mark.unit
def test_default_provider_uses_config_ingest():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings(provider_ingest="ollama")):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * 1024])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"])

        call_args = mock_client.post.call_args
        assert "localhost:11434" in call_args[0][0]


@pytest.mark.unit
def test_default_provider_uses_openrouter_when_configured():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings(provider_ingest="openrouter")):
        mock_client = _make_mock_client([_make_openrouter_response([[0.1] * 256])])
        mock_cls.return_value = mock_client

        embed_texts_sync(["hello"])

        call_args = mock_client.post.call_args
        assert "openrouter.ai" in call_args[0][0]


@pytest.mark.unit
def test_invalid_provider_raises():
    with pytest.raises(ValueError, match="provider must be"):
        embed_texts_sync(["hello"], provider="invalid")


@pytest.mark.unit
def test_embed_texts_sync_truncates_to_embed_dim():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * EMBED_DIM])])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["hello"], provider="ollama")

        assert len(result) == 1
        assert len(result[0]) == EMBED_DIM


@pytest.mark.unit
def test_openrouter_truncates_to_embed_dim():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([_make_openrouter_response([[0.1] * 4096])])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["hello"], provider="openrouter")

        assert len(result) == 1
        assert len(result[0]) == EMBED_DIM


@pytest.mark.unit
def test_embed_texts_sync_batching_ollama():
    resp = _make_ollama_response([[0.1] * 1024, [0.2] * 1024])
    with patch("embed.httpx.Client") as mock_cls, patch("embed.BATCH_SIZE", 2), patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([resp, resp])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["a", "b", "c", "d"], provider="ollama")

        assert len(result) == 4


@pytest.mark.unit
def test_embed_texts_sync_batching_openrouter():
    resp = _make_openrouter_response([[0.1] * 256, [0.2] * 256])
    with patch("embed.httpx.Client") as mock_cls, patch("embed.OPENROUTER_EMBED_BATCH_SIZE", 2), patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([resp, resp])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["a", "b", "c", "d"], provider="openrouter")

        assert len(result) == 4


@pytest.mark.unit
def test_embed_texts_sync_http_status_error_bisects_batch():
    mock_response = MagicMock()
    mock_response.status_code = 422
    http_error = httpx.HTTPStatusError(message="422", request=MagicMock(), response=mock_response)
    success_resp = _make_ollama_response([[0.1] * 1024])

    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([http_error, success_resp, success_resp])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["hello", "world"], provider="ollama")

        assert len(result) == 2
        assert mock_client.post.call_count == 3


@pytest.mark.unit
def test_embed_texts_sync_http_status_error_single_long_text_truncates():
    long_text = "a" * 2500
    mock_response = MagicMock()
    mock_response.status_code = 422
    http_error = httpx.HTTPStatusError(message="422", request=MagicMock(), response=mock_response)
    success_resp = _make_ollama_response([[0.1] * 1024])

    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([http_error, success_resp])
        mock_cls.return_value = mock_client

        result = embed_texts_sync([long_text], provider="ollama")

        assert len(result) == 1
        assert mock_client.post.call_count == 2
        second_call_input = mock_client.post.call_args_list[1][1]["json"]["input"][0]
        assert len(second_call_input) <= 1800


@pytest.mark.unit
def test_embed_texts_sync_depth_guard_returns_empty():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["hello"], _depth=51)

        assert result == []


@pytest.mark.unit
@pytest.mark.slow
def test_embed_texts_sync_connect_error_retries():
    from httpx import ConnectError
    success_resp = _make_ollama_response([[0.1] * 1024])

    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([ConnectError("connection refused"), success_resp])
        mock_cls.return_value = mock_client

        result = embed_texts_sync(["hello"], provider="ollama")

        assert len(result) == 1
        assert mock_client.post.call_count == 2


@pytest.mark.unit
def test_embed_query_sync_uses_query_provider():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings(provider_query="ollama")):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * 1024])])
        mock_cls.return_value = mock_client

        embed_query_sync("test query")

        call_args = mock_client.post.call_args
        input_field = call_args[1]["json"]["input"]
        assert input_field[0] == "test query"


@pytest.mark.unit
def test_embed_query_sync_uses_openrouter():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings(provider_query="openrouter")):
        mock_client = _make_mock_client([_make_openrouter_response([[0.1] * 256])])
        mock_cls.return_value = mock_client

        embed_query_sync("test query")

        call_args = mock_client.post.call_args
        assert "openrouter.ai" in call_args[0][0]
        body = call_args[1]["json"]
        assert body["input_type"] == "search_query"


@pytest.mark.unit
def test_embed_texts_bulk_empty():
    result = embed_texts_bulk([])
    assert result == []


@pytest.mark.unit
def test_embed_texts_bulk_single_batch():
    with patch("embed.httpx.Client") as mock_cls, patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([_make_ollama_response([[0.1] * EMBED_DIM])])
        mock_cls.return_value = mock_client

        result = embed_texts_bulk(["hello"], provider="ollama")

        assert len(result) == 1
        assert len(result[0]) == EMBED_DIM


@pytest.mark.unit
def test_embed_texts_bulk_concurrent_batches():
    resp = _make_ollama_response([[0.1] * 1024, [0.2] * 1024])
    with patch("embed.httpx.Client") as mock_cls, patch("embed.BATCH_SIZE", 2), patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([resp, resp, resp])
        mock_cls.return_value = mock_client

        result = embed_texts_bulk(["a", "b", "c", "d", "e", "f"], provider="ollama", max_workers=3)

        assert len(result) == 6
        assert mock_client.post.call_count == 3


@pytest.mark.unit
def test_embed_texts_bulk_calls_on_batch_done():
    called = []

    def on_done(idx, count):
        called.append((idx, count))

    with patch("embed.httpx.Client") as mock_cls, patch("embed.BATCH_SIZE", 1), patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([
            _make_ollama_response([[0.1] * 1024]),
            _make_ollama_response([[0.2] * 1024]),
        ])
        mock_cls.return_value = mock_client

        result = embed_texts_bulk(["a", "b"], provider="ollama", on_batch_done=on_done)

        assert len(result) == 2
        assert len(called) == 2


@pytest.mark.unit
def test_embed_texts_bulk_reassembles_order():
    # Use distinguishable vectors: first element differs, and shapes survive normalization
    resp_a = _make_ollama_response([[1.0] + [0.0] * 1023])
    resp_b = _make_ollama_response([[0.0] + [1.0] + [0.0] * 1022])
    with patch("embed.httpx.Client") as mock_cls, patch("embed.BATCH_SIZE", 1), patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([resp_a, resp_b])
        mock_cls.return_value = mock_client

        result = embed_texts_bulk(["first", "second"], provider="ollama", max_workers=2)

        assert len(result) == 2
        # After normalization [1,0,0...] stays [1,0,0...] (within floating point)
        assert result[0][0] == 1.0
        assert result[0][1] == 0.0
        assert result[1][0] == 0.0
        assert result[1][1] == 1.0


@pytest.mark.unit
def test_embed_texts_bulk_skips_failed_batches():
    success = _make_ollama_response([[0.1] * 1024])
    with patch("embed.httpx.Client") as mock_cls, patch("embed.BATCH_SIZE", 1), patch("embed.settings", _mock_settings()):
        mock_client = _make_mock_client([success, Exception("fail"), success])
        mock_cls.return_value = mock_client

        result = embed_texts_bulk(["a", "b", "c"], provider="ollama", max_workers=3)

        # Only 2 of 3 succeeded
        assert len(result) == 2

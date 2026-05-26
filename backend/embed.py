from __future__ import annotations

import os
import math
import logging
import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from constants import (
    EMBED_DIM,
    BATCH_SIZE,
    OPENROUTER_EMBED_BATCH_SIZE,
    OPENROUTER_BASE_URL,
    EMBED_PREFIX_DOC,
    EMBED_PREFIX_QUERY,
)
from config import settings

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


def _l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


def _prefix_text(text: str, prefix: str) -> str:
    if prefix:
        return f"{prefix}{text}"
    return text


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((httpx.ConnectError,)),
    reraise=True,
)
def _embed_batch_ollama(client: httpx.Client, full_batch: list[str], model: str) -> list[list[float]]:
    resp = client.post(
        f"{OLLAMA_BASE_URL}/api/embed",
        json={"model": model, "input": full_batch},
    )
    resp.raise_for_status()
    embeddings = resp.json()["embeddings"]
    return [_l2_normalize(emb[:EMBED_DIM]) for emb in embeddings]


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException)),
    reraise=True,
)
def _embed_batch_openrouter(
    client: httpx.Client,
    batch: list[str],
    model: str,
    api_key: str,
    input_type: str,
) -> list[list[float]]:
    resp = client.post(
        f"{OPENROUTER_BASE_URL}/embeddings",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "input": batch,
            "dimensions": EMBED_DIM,
            "input_type": input_type,
        },
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    embeddings = []
    for item in sorted(data, key=lambda d: d["index"]):
        vec = item["embedding"][:EMBED_DIM]
        embeddings.append(_l2_normalize(vec))
    return embeddings


MAX_CHARS = 1800


def _get_provider(provider: str | None) -> str:
    if provider is not None:
        if provider not in ("ollama", "openrouter"):
            raise ValueError(f"provider must be 'ollama' or 'openrouter', got '{provider}'")
        return provider
    return settings.embed_provider_ingest


def embed_texts_sync(
    texts: list[str],
    prefix: str = EMBED_PREFIX_DOC,
    _depth: int = 0,
    *,
    provider: str | None = None,
) -> list[list[float]]:
    """Embed texts synchronously, one batch at a time. Suitable for small lists."""
    if not texts:
        return []
    if _depth > 50:
        return []

    resolved_provider = _get_provider(provider)

    results: list[list[float]] = []
    timeout = 300.0 if resolved_provider == "ollama" else 120.0
    batch_size = BATCH_SIZE if resolved_provider == "ollama" else OPENROUTER_EMBED_BATCH_SIZE

    with httpx.Client(timeout=timeout) as client:
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            full_batch = [_prefix_text(t, prefix) for t in batch]
            try:
                if resolved_provider == "openrouter":
                    input_type = "search_document" if prefix == EMBED_PREFIX_DOC else "search_query"
                    results.extend(
                        _embed_batch_openrouter(
                            client,
                            full_batch,
                            settings.openrouter_embed_model,
                            settings.openrouter_api_key,
                            input_type,
                        )
                    )
                else:
                    results.extend(_embed_batch_ollama(client, full_batch, settings.ollama_embed_model))
            except httpx.HTTPStatusError as e:
                if len(batch) > 1:
                    logger.debug("Bisecting batch of %d texts due to HTTP error (depth=%d): %s", len(batch), _depth, e)
                    mid = (len(batch) + 1) // 2
                    results.extend(embed_texts_sync(batch[:mid], prefix, _depth + 1, provider=resolved_provider))
                    results.extend(embed_texts_sync(batch[mid:], prefix, _depth + 1, provider=resolved_provider))
                elif len(batch[0]) > MAX_CHARS:
                    results.extend(embed_texts_sync([batch[0][:MAX_CHARS]], prefix, _depth + 1, provider=resolved_provider))
                else:
                    short_text = batch[0][: max(len(batch[0]) // 2, 500)]
                    results.extend(embed_texts_sync([short_text], prefix, _depth + 1, provider=resolved_provider))
            except Exception as e:
                if len(batch) > 1:
                    logger.debug("Bisecting batch of %d texts due to error (depth=%d): %s", len(batch), _depth, e)
                    mid = (len(batch) + 1) // 2
                    results.extend(embed_texts_sync(batch[:mid], prefix, _depth + 1, provider=resolved_provider))
                    results.extend(embed_texts_sync(batch[mid:], prefix, _depth + 1, provider=resolved_provider))
                else:
                    raise
    return results


MAX_BULK_RETRIES = 3


def embed_texts_bulk(
    texts: list[str],
    prefix: str = EMBED_PREFIX_DOC,
    *,
    provider: str | None = None,
    max_workers: int | None = None,
    on_batch_done: Callable[[int, int], None] | None = None,
) -> list[list[float]]:
    """Embed large lists concurrently using connection reuse. Suitable for bulk ingest.

    - Creates a single httpx.Client with connection pooling.
    - Dispatches N batches in parallel via ThreadPoolExecutor.
    - Retries failed batches up to MAX_BULK_RETRIES times, splitting in half each retry.
    - Reports per-batch timing via optional on_batch_done(start, end, batch_idx, count, latency).
    """
    if not texts:
        return []

    resolved_provider = _get_provider(provider)
    batch_size = BATCH_SIZE if resolved_provider == "ollama" else OPENROUTER_EMBED_BATCH_SIZE
    timeout = 300.0 if resolved_provider == "ollama" else 120.0

    if max_workers is None:
        max_workers = 2 if resolved_provider == "ollama" else 10

    prefixed = [_prefix_text(t, prefix) for t in texts]

    total = len(texts)
    logger.info(
        "Embedding %d texts via %s in batches of %d (%d workers, timeout=%ds)...",
        total,
        resolved_provider,
        batch_size,
        max_workers,
        int(timeout),
    )

    results_dict: dict[int, list[list[float]]] = {}
    next_result_idx = [0]
    retry_count = 0

    def _make_batches(text_list: list[str], start_idx: int) -> list[tuple[int, list[str]]]:
        out = []
        for i in range(0, len(text_list), batch_size):
            out.append((start_idx + i, text_list[i : i + batch_size]))
        return out

    with httpx.Client(timeout=timeout, limits=httpx.Limits(max_connections=max_workers, max_keepalive_connections=max_workers)) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            pending = _make_batches(prefixed, 0)

            for attempt in range(MAX_BULK_RETRIES + 1):
                if not pending:
                    break

                futures = {}
                for orig_idx, batch in pending:
                    if resolved_provider == "openrouter":
                        input_type = "search_document" if prefix == EMBED_PREFIX_DOC else "search_query"
                        future = executor.submit(
                            _embed_batch_openrouter,
                            client,
                            batch,
                            settings.openrouter_embed_model,
                            settings.openrouter_api_key,
                            input_type,
                        )
                    else:
                        future = executor.submit(
                            _embed_batch_ollama,
                            client,
                            batch,
                            settings.ollama_embed_model,
                        )
                    futures[future] = (orig_idx, batch)

                next_pending = []
                for future in as_completed(futures):
                    orig_idx, batch = futures[future]
                    try:
                        embs = future.result()
                        for offset, emb in enumerate(embs):
                            results_dict[orig_idx + offset] = emb
                        if on_batch_done:
                            on_batch_done(orig_idx, len(embs))
                    except Exception as exc:
                        logger.warning(
                            "Batch at %d failed (attempt %d/%d, %d texts): %s", orig_idx, attempt + 1, MAX_BULK_RETRIES + 1, len(batch), exc
                        )
                        if attempt < MAX_BULK_RETRIES:
                            mid = (len(batch) + 1) // 2
                            if mid > 1 and len(batch) > 1:
                                next_pending.append((orig_idx, batch[:mid]))
                                next_pending.append((orig_idx + mid, batch[mid:]))
                            else:
                                next_pending.append((orig_idx, batch))
                            retry_count += 1
                        else:
                            logger.error("Batch at %d exhausted retries, skipping %d texts", orig_idx, len(batch))

                pending = next_pending

            if pending:
                logger.warning("%d batches still pending after all retries", len(pending))

    # Reassemble in original order
    all_embeddings: list[list[float]] = []
    for i in range(len(texts)):
        if i in results_dict:
            all_embeddings.append(results_dict[i])

    logger.info(
        "Bulk embed complete: %d/%d texts embedded (%d retries)",
        len(all_embeddings),
        total,
        retry_count,
    )
    return all_embeddings


def embed_query_sync(text: str) -> list[float]:
    provider = settings.embed_provider_query
    return embed_texts_sync([text], EMBED_PREFIX_QUERY, provider=provider)[0]

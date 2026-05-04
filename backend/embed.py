from __future__ import annotations

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

OLLAMA_BASE_URL = "http://localhost:11434"


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
    timeout = 120.0 if resolved_provider == "ollama" else 60.0
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
                    results.extend(
                        _embed_batch_ollama(client, full_batch, settings.ollama_embed_model)
                    )
            except httpx.HTTPStatusError:
                if len(batch) > 1:
                    mid = (len(batch) + 1) // 2
                    results.extend(embed_texts_sync(batch[:mid], prefix, _depth + 1, provider=resolved_provider))
                    results.extend(embed_texts_sync(batch[mid:], prefix, _depth + 1, provider=resolved_provider))
                elif len(batch[0]) > MAX_CHARS:
                    results.extend(embed_texts_sync([batch[0][:MAX_CHARS]], prefix, _depth + 1, provider=resolved_provider))
                else:
                    short_text = batch[0][:max(len(batch[0]) // 2, 500)]
                    results.extend(embed_texts_sync([short_text], prefix, _depth + 1, provider=resolved_provider))
            except Exception:
                if len(batch) > 1:
                    mid = (len(batch) + 1) // 2
                    results.extend(embed_texts_sync(batch[:mid], prefix, _depth + 1, provider=resolved_provider))
                    results.extend(embed_texts_sync(batch[mid:], prefix, _depth + 1, provider=resolved_provider))
                else:
                    raise
    return results


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
    - Reports per-batch timing via optional on_batch_done(start, end, batch_idx, count, latency).
    """
    if not texts:
        return []

    resolved_provider = _get_provider(provider)
    batch_size = BATCH_SIZE if resolved_provider == "ollama" else OPENROUTER_EMBED_BATCH_SIZE
    timeout = 120.0 if resolved_provider == "ollama" else 60.0

    # For OpenRouter: 10 connections in parallel is reasonable; for local Ollama, be conservative
    if max_workers is None:
        max_workers = 4 if resolved_provider == "ollama" else 10

    # Build batches
    batches: list[list[str]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batches.append([_prefix_text(t, prefix) for t in batch])

    total = len(texts)
    logger.info(
        "Embedding %d texts via %s in %d batches of %d (%d workers)...",
        total,
        resolved_provider,
        len(batches),
        batch_size,
        max_workers,
    )

    results: list[tuple[int, list[list[float]]]] = []
    errors: list[tuple[int, Exception]] = []

    with httpx.Client(timeout=timeout, limits=httpx.Limits(max_connections=max_workers, max_keepalive_connections=max_workers)) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {}
            for idx, batch in enumerate(batches):
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
                futures[future] = idx

            for future in as_completed(futures):
                idx = futures[future]
                try:
                    embs = future.result()
                    results.append((idx, embs))
                    if on_batch_done:
                        on_batch_done(idx, len(embs))
                except Exception as exc:
                    errors.append((idx, exc))
                    logger.warning("Batch %d failed: %s", idx, exc)

    if errors:
        logger.warning("%d of %d batches failed; results may be incomplete", len(errors), len(batches))

    # Reassemble in original order
    results.sort(key=lambda x: x[0])
    all_embeddings: list[list[float]] = []
    for _idx, embs in results:
        all_embeddings.extend(embs)

    logger.info(
        "Bulk embed complete: %d/%d texts embedded (%d failed batches)",
        len(all_embeddings),
        total,
        len(errors),
    )
    return all_embeddings


def embed_query_sync(text: str) -> list[float]:
    provider = settings.embed_provider_query
    return embed_texts_sync([text], EMBED_PREFIX_QUERY, provider=provider)[0]

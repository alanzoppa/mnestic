from __future__ import annotations

import math
import httpx

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from constants import EMBED_DIM, BATCH_SIZE, EMBED_PREFIX_DOC, EMBED_PREFIX_QUERY

OLLAMA_BASE_URL = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text-v2-moe"


def _l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((httpx.ConnectError,)),
    reraise=True,
)
def _embed_batch(client: httpx.Client, full_batch: list[str]) -> list[list[float]]:
    resp = client.post(
        f"{OLLAMA_BASE_URL}/api/embed",
        json={"model": EMBED_MODEL, "input": full_batch},
    )
    resp.raise_for_status()
    embeddings = resp.json()["embeddings"]
    return [_l2_normalize(emb[:EMBED_DIM]) for emb in embeddings]


MAX_CHARS = 1800

def embed_texts_sync(texts: list[str], prefix: str = "search_document", _depth: int = 0) -> list[list[float]]:
    if not texts:
        return []
    if _depth > 50:
        return []
    results: list[list[float]] = []
    with httpx.Client(timeout=120.0) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            full_batch = [f"{prefix}: {t}" for t in batch]
            try:
                results.extend(_embed_batch(client, full_batch))
            except httpx.HTTPStatusError:
                if len(batch) > 1:
                    mid = (len(batch) + 1) // 2
                    results.extend(embed_texts_sync(batch[:mid], prefix, _depth + 1))
                    results.extend(embed_texts_sync(batch[mid:], prefix, _depth + 1))
                elif len(batch[0]) > MAX_CHARS:
                    results.extend(embed_texts_sync([batch[0][:MAX_CHARS]], prefix, _depth + 1))
                else:
                    results.extend(embed_texts_sync([batch[0][:max(len(batch[0]) // 2, 500)]], prefix, _depth + 1))
            except Exception:
                if len(batch) > 1:
                    mid = (len(batch) + 1) // 2
                    results.extend(embed_texts_sync(batch[:mid], prefix, _depth + 1))
                    results.extend(embed_texts_sync(batch[mid:], prefix, _depth + 1))
                else:
                    raise
    return results


def embed_query_sync(text: str) -> list[float]:
    return embed_texts_sync([text], "search_query")[0]

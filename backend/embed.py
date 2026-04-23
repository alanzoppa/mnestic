from __future__ import annotations

import math
import httpx

OLLAMA_BASE_URL = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text-v2-moe"
EMBED_DIM = 256
BATCH_SIZE = 50


def _l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


def embed_texts_sync(texts: list[str], prefix: str = "search_document") -> list[list[float]]:
    if not texts:
        return []
    results: list[list[float]] = []
    with httpx.Client(timeout=120.0) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            full_batch = [f"{prefix}: {t}" for t in batch]
            for attempt in range(2):
                try:
                    resp = client.post(
                        f"{OLLAMA_BASE_URL}/api/embed",
                        json={"model": EMBED_MODEL, "input": full_batch},
                    )
                    resp.raise_for_status()
                    embeddings = resp.json()["embeddings"]
                    for emb in embeddings:
                        truncated = emb[:EMBED_DIM]
                        results.append(_l2_normalize(truncated))
                    break
                except Exception:
                    if attempt == 1:
                        raise
                    if len(batch) > 1:
                        mid = (len(batch) + 1) // 2
                        first_half = embed_texts_sync(batch[:mid], prefix)
                        second_half = embed_texts_sync(batch[mid:], prefix)
                        results.extend(first_half)
                        results.extend(second_half)
                        break
                    raise
    return results


def embed_query_sync(text: str) -> list[float]:
    return embed_texts_sync([text], "search_query")[0]
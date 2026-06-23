"""Cross-encoder reranking for note search results."""

from __future__ import annotations

import logging
from typing import Any

from constants import RERANKER_MODEL, RERANK_BATCH_SIZE

logger = logging.getLogger(__name__)


class Reranker:
    """Lazy-initialized cross-encoder reranker.

    torch and sentence_transformers are imported lazily inside _load()
    to avoid loading ~250 MB of libraries at startup when reranking
    is not needed.
    """

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or RERANKER_MODEL
        self._model: Any = None
        self._available = True
        self._import_attempted = False

    def _load(self) -> Any:
        if self._model is not None:
            return self._model
        if not self._available:
            return None

        # Lazy import: only load torch + sentence_transformers when reranking
        # is actually requested for the first time.
        if not self._import_attempted:
            self._import_attempted = True
            try:
                from sentence_transformers import CrossEncoder  # noqa: F811
            except Exception:
                logger.warning("sentence_transformers not available — reranking disabled")
                self._available = False
                return None

            self._CrossEncoder = CrossEncoder  # type: ignore

        if not hasattr(self, "_CrossEncoder") or self._CrossEncoder is None:
            return None

        try:
            logger.info("Loading reranker model %s", self.model_name)
            self._model = self._CrossEncoder(self.model_name)
            return self._model
        except Exception:
            logger.warning("Failed to load reranker model %s", self.model_name)
            self._available = False
            return None

    def available(self) -> bool:
        return self._load() is not None

    def rerank(self, query: str, candidates: list[dict]) -> list[dict]:
        """Rerank candidates by (query, candidate_text) relevance scores.

        Each candidate must have dict with keys: title, snippet, and optionally id.
        Returns candidates sorted by reranker score descending with the 'score' field updated.
        """
        if not candidates:
            return candidates

        model = self._load()
        if model is None:
            return candidates

        pairs = []
        for c in candidates:
            text = f"{c.get('title', '')}. {c.get('snippet', '')}".strip()
            if not text:
                text = c.get("document", "") or ""
            pairs.append((query, text))

        try:
            scores = model.predict(pairs, batch_size=RERANK_BATCH_SIZE, show_progress_bar=False)
        except Exception:
            logger.warning("Reranker inference failed, returning original order")
            return candidates

        for i, candidate in enumerate(candidates):
            if i < len(scores):
                candidate["score"] = float(scores[i])

        return sorted(candidates, key=lambda x: x.get("score", 0.0), reverse=True)

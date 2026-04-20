from __future__ import annotations

import os
from typing import Any

import chromadb
from chromadb.config import Settings

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_data")


def _flatten_tags(tags: Any) -> str:
    if tags is None:
        return ""
    if isinstance(tags, list):
        return ",".join(str(t) for t in tags)
    return str(tags)


def _flatten_participants(participants: Any) -> str:
    if participants is None:
        return ""
    if isinstance(participants, list):
        return ",".join(str(p) for p in participants)
    return str(participants)


def _serialize_metadata(meta: dict) -> dict:
    out: dict[str, Any] = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (list, tuple)):
            out[k] = _flatten_tags(v)
        elif isinstance(v, bool):
            out[k] = "true" if v else "false"
        elif isinstance(v, (int, float, str)):
            out[k] = v
        else:
            out[k] = str(v)
    return out


class NoteStore:
    def __init__(self, persist_dir: str = CHROMA_PERSIST_DIR) -> None:
        os.makedirs(persist_dir, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        self._notes = self._client.get_or_create_collection("notes")
        self._calendar = self._client.get_or_create_collection("calendar")

    def add_notes(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        metas = [_serialize_metadata(m) for m in metadatas]
        self._notes.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metas)

    def add_calendar_events(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        metas = [_serialize_metadata(m) for m in metadatas]
        self._calendar.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metas)

    def get_notes_by_tag(self, tag_str: str, n: int = 20, where: dict = None) -> list[dict]:
        tag_set = {t.strip().lower() for t in tag_str.split(",") if t.strip()}
        all_notes = self._notes.get(include=["metadatas", "documents"])
        results = []
        for i, meta in enumerate(all_notes.get("metadatas", [])):
            if not meta:
                continue
            if where:
                match = True
                clauses = [where] if "$and" not in where else where.get("$and", [where])
                for clause in clauses:
                    for key, cond in clause.items():
                        val = meta.get(key, "")
                        if isinstance(cond, dict):
                            op, cmp_val = next(iter(cond.items()))
                            if op == "$eq" and val != cmp_val:
                                match = False
                            elif op == "$gte" and val < cmp_val:
                                match = False
                            elif op == "$lte" and val > cmp_val:
                                match = False
                        elif val != cond:
                            match = False
                    if not match:
                        break
                if not match:
                    continue
            note_tags = {t.strip().lower() for t in meta.get("tags", "").split(",") if t.strip()}
            if tag_set & note_tags:
                doc = all_notes["documents"][i] if all_notes.get("documents") else ""
                results.append({
                    "id": all_notes["ids"][i],
                    "metadata": meta,
                    "document": doc,
                    "score": 0.0,
                })
                if len(results) >= n:
                    break
        return results

    def search_notes(
        self, query_embedding: list[float], n: int = 20, where: dict = None
    ) -> list[dict]:
        results = self._notes.query(
            query_embeddings=[query_embedding],
            n_results=n,
            where=where,
        )
        return self._format_results(results, limit=n)

    def search_calendar(
        self, query_embedding: list[float], n: int = 20, where: dict = None
    ) -> list[dict]:
        results = self._calendar.query(
            query_embeddings=[query_embedding],
            n_results=n,
            where=where,
        )
        return self._format_results(results, limit=n)

    def _format_results(self, results: dict, limit: int) -> list[dict]:
        items = []
        inner = results["ids"][0] if results["ids"] else []
        for i in range(min(len(inner), limit)):
            items.append(
                {
                    "id": inner[i],
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "document": results["documents"][0][i] if results["documents"] else "",
                    "distance": results["distances"][0][i] if results["distances"] else None,
                }
            )
        return items

    def get_note(self, note_id: str) -> dict | None:
        try:
            result = self._notes.get(ids=[note_id], include=["metadatas", "documents"])
        except Exception:
            return None
        if not result["ids"]:
            return None
        return {
            "id": result["ids"][0],
            "metadata": result["metadatas"][0] if result["metadatas"] else {},
            "document": result["documents"][0] if result["documents"] else "",
        }

    def get_note_by_note_id(self, logical_note_id: str) -> dict | None:
        """Look up a note by its logical note_id metadata field, preferring _chunk_0."""
        try:
            results = self._notes.get(
                where={"note_id": logical_note_id},
                include=["metadatas", "documents"],
            )
        except Exception:
            return None
        if not results["ids"]:
            return None
        for i, mid in enumerate(results["ids"]):
            if mid.endswith("_chunk_0"):
                return {
                    "id": mid,
                    "metadata": results["metadatas"][i] if results["metadatas"] else {},
                    "document": results["documents"][i] if results["documents"] else "",
                }
        return {
            "id": results["ids"][0],
            "metadata": results["metadatas"][0] if results["metadatas"] else {},
            "document": results["documents"][0] if results["documents"] else "",
        }

    def get_unique_notes(self, include: list[str] | None = None) -> dict:
        """Get all notes, deduplicated by note_id, keeping only _chunk_0."""
        if include is None:
            include = ["metadatas"]
        all_notes = self._notes.get(include=include)
        seen_note_ids = set()
        result = {"ids": [], "metadatas": []}
        for i, meta in enumerate(all_notes.get("metadatas", [])):
            if not meta:
                continue
            nid = meta.get("note_id", "")
            if nid and nid in seen_note_ids:
                continue
            if nid:
                seen_note_ids.add(nid)
            result["ids"].append(all_notes["ids"][i])
            result["metadatas"].append(meta)
            for field in include:
                if field != "metadatas" and field in all_notes:
                    if field not in result:
                        result[field] = []
                    result[field].append(all_notes[field][i] if i < len(all_notes[field]) else None)
        return result

    def get_similar(self, note_id: str, n: int = 10, threshold: float = 0.75) -> list[dict]:
        note = self.get_note(note_id)
        if not note:
            return []
        note_embedding = self._notes.get(ids=[note_id], include=["embeddings"])
        embeddings = note_embedding.get("embeddings", [])
        if embeddings is None or len(embeddings) == 0:
            return []
        return self.search_notes(embeddings[0], n=n)

    def get_tags(self) -> tuple[list[dict], list[dict]]:
        unique = self.get_unique_notes(include=["metadatas"])
        tag_counts: dict[str, int] = {}
        co_occur: dict[tuple[str, str], int] = {}

        for meta in unique.get("metadatas", []):
            if not meta:
                continue
            tags_str = meta.get("tags", "")
            if not tags_str:
                continue
            tags = [t.strip() for t in tags_str.split(",") if t.strip()]
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
            for i, t1 in enumerate(tags):
                for t2 in tags[i + 1 :]:
                    pair = (t1, t2) if t1 <= t2 else (t2, t1)
                    co_occur[pair] = co_occur.get(pair, 0) + 1

        tag_list = [{"name": k, "count": v} for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])]
        co_occur_list = [
            {"tag1": p[0], "tag2": p[1], "count": c} for p, c in sorted(co_occur.items(), key=lambda x: -x[1])
        ]
        return tag_list, co_occur_list

    def get_timeline(self, group_by: str = "month", tag: str | None = None) -> list[dict]:
        unique = self.get_unique_notes(include=["metadatas"])
        all_note_ids = unique["ids"]
        buckets: dict[str, dict] = {}
        for i, meta in enumerate(unique.get("metadatas", [])):
            if not meta:
                continue
            note_id = meta.get("note_id", all_note_ids[i]) if i < len(all_note_ids) else ""
            created = meta.get("created", "")
            if not created:
                continue
            if tag:
                tags_str = meta.get("tags", "")
                if tag not in tags_str:
                    continue
            try:
                dt = created[:10]
                if group_by == "year":
                    period = dt[:4]
                elif group_by == "day":
                    period = dt
                else:
                    period = dt[:7]
            except Exception:
                continue
            if period not in buckets:
                buckets[period] = {"count": 0, "sample_ids": []}
            buckets[period]["count"] += 1
            canonical_id = note_id or all_note_ids[i]
            if len(buckets[period]["sample_ids"]) < 5:
                buckets[period]["sample_ids"].append(canonical_id)

        return [
            {"period": k, "count": v["count"], "sample_ids": v["sample_ids"]}
            for k, v in sorted(buckets.items())
        ]

    def get_stats(self) -> dict:
        unique = self.get_unique_notes(include=["documents", "metadatas"])
        all_calendar = self._calendar.get(include=[])
        total_notes = len(unique["ids"])
        total_calendar_events = len(all_calendar["ids"])

        dates = []
        total_len = 0
        documents = unique.get("documents", [])
        for idx, meta in enumerate(unique.get("metadatas", [])):
            if meta and meta.get("created"):
                dates.append(meta["created"][:10])
            if idx < len(documents) and documents[idx]:
                total_len += len(documents[idx])

        tag_counts, _ = self.get_tags()
        date_range = [min(dates), max(dates)] if dates else [None, None]

        return {
            "total_notes": total_notes,
            "total_tags": len(tag_counts),
            "date_range": date_range,
            "avg_note_length": total_len // total_notes if total_notes > 0 else 0,
            "total_calendar_events": total_calendar_events,
        }

    def delete_notes(self, ids: list[str]) -> None:
        self._notes.delete(ids=ids)

    def delete_calendar_events(self, ids: list[str]) -> None:
        self._calendar.delete(ids=ids)

    def reset(self) -> None:
        self._client.delete_collection("notes")
        self._client.delete_collection("calendar")
        self._notes = self._client.get_or_create_collection("notes")
        self._calendar = self._client.get_or_create_collection("calendar")

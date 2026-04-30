from __future__ import annotations

import os
from typing import Any

import chromadb
from chromadb.config import Settings

from config import CHROMA_PERSIST_DIR
from models import (
    NoteMetadata,
    NoteResult,
    NoteListItem,
    TagInfo,
    CoOccurrence,
    TimelinePeriod,
    StatsResponse,
    IngestResult,
    CalendarIngestResult,
    SeriesInfo,
    PersonWithFrequency,
    GlossaryEntry,
)


def _to_chroma_scalar(tags: Any) -> str:
    if tags is None:
        return ""
    if isinstance(tags, list):
        return ",".join(str(t) for t in tags)
    return str(tags)


def _serialize_metadata(meta: dict) -> dict:
    out: dict[str, Any] = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (list, tuple)):
            out[k] = _to_chroma_scalar(v)
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

    def get_notes_by_tag(self, tag_str: str, n: int = 20, where: dict = None) -> list[NoteResult]:
        tag_set = {t.strip().lower() for t in tag_str.split(",") if t.strip()}
        all_notes = self._notes.get(where=where, include=["metadatas"])
        results: list[NoteResult] = []
        seen_note_ids: set[str] = set()
        for i, meta in enumerate(all_notes.get("metadatas", [])):
            if not meta:
                continue
            nid = meta.get("note_id", "")
            if nid and nid in seen_note_ids:
                continue
            note_tags = {t.strip().lower() for t in meta.get("tags", "").split(",") if t.strip()}
            if tag_set & note_tags:
                if nid:
                    seen_note_ids.add(nid)
                results.append(NoteResult(
                    id=all_notes["ids"][i],
                    metadata=NoteMetadata(**meta),
                ))
                if len(results) >= n:
                    break
        return results

    def search_notes(
        self, query_embedding: list[float], n: int = 20, where: dict = None
    ) -> list[NoteResult]:
        results = self._notes.query(
            query_embeddings=[query_embedding],
            n_results=n,
            where=where,
        )
        return self._format_results(results, limit=n)

    def search_calendar(
        self, query_embedding: list[float], n: int = 20, where: dict = None
    ) -> list[NoteResult]:
        results = self._calendar.query(
            query_embeddings=[query_embedding],
            n_results=n,
            where=where,
        )
        return self._format_results(results, limit=n)

    def _format_results(self, results: dict, limit: int) -> list[NoteResult]:
        items: list[NoteResult] = []
        inner = results["ids"][0] if results["ids"] else []
        for i in range(min(len(inner), limit)):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            items.append(NoteResult(
                id=inner[i],
                document=results["documents"][0][i] if results["documents"] else "",
                metadata=NoteMetadata(**meta) if meta else NoteMetadata(),
                distance=results["distances"][0][i] if results["distances"] else None,
            ))
        return items

    def get_note(self, note_id: str) -> NoteResult | None:
        try:
            result = self._notes.get(ids=[note_id], include=["metadatas", "documents"])
        except Exception:
            return None
        if not result["ids"]:
            return None
        meta = result["metadatas"][0] if result["metadatas"] else {}
        return NoteResult(
            id=result["ids"][0],
            document=result["documents"][0] if result["documents"] else "",
            metadata=NoteMetadata(**meta) if meta else NoteMetadata(),
        )

    def get_note_by_note_id(self, logical_note_id: str) -> NoteResult | None:
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
                meta = results["metadatas"][i] if results["metadatas"] else {}
                return NoteResult(
                    id=mid,
                    document=results["documents"][i] if results["documents"] else "",
                    metadata=NoteMetadata(**meta) if meta else NoteMetadata(),
                )
        meta = results["metadatas"][0] if results["metadatas"] else {}
        return NoteResult(
            id=results["ids"][0],
            document=results["documents"][0] if results["documents"] else "",
            metadata=NoteMetadata(**meta) if meta else NoteMetadata(),
        )

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

    def list_notes(self, where: dict = None, n: int = 500) -> list[NoteResult]:
        """List all notes, optionally filtered by where. Deduplicated by note_id."""
        raw = self._notes.get(where=where, include=["metadatas", "documents"])
        if not raw or not raw.get("ids"):
            return []
        seen_note_ids: set[str] = set()
        results: list[NoteResult] = []
        for i, note_id in enumerate(raw["ids"]):
            meta_dict = raw["metadatas"][i] if raw["metadatas"] else {}
            if not meta_dict:
                continue
            nm = NoteMetadata(**meta_dict)
            nid = nm.note_id or note_id
            if nid and nid in seen_note_ids:
                continue
            if nid:
                seen_note_ids.add(nid)
            results.append(NoteResult(
                id=note_id,
                document=raw["documents"][i] if raw["documents"] else "",
                metadata=nm,
                score=0.0,
                distance=None,
            ))
            if n and len(results) >= n:
                break
        return results

    def get_series_list(self) -> list[SeriesInfo]:
        unique = self.get_unique_notes(include=["metadatas"])
        series_counts: dict[str, int] = {}
        series_latest: dict[str, tuple[str, str]] = {}
        for i, meta in enumerate(unique.get("metadatas", [])):
            if not meta:
                continue
            series_val = meta.get("series", "")
            if not series_val:
                continue
            created = meta.get("created", "")
            nid = meta.get("note_id", unique["ids"][i]) if i < len(unique["ids"]) else ""
            series_counts[series_val] = series_counts.get(series_val, 0) + 1
            if series_val not in series_latest or created > series_latest[series_val][0]:
                series_latest[series_val] = (created, nid)
        result = []
        for name in sorted(series_counts, key=lambda n: -series_counts[n]):
            result.append(SeriesInfo(name=name, count=series_counts[name], latest_date=series_latest[name][0], latest_note_id=series_latest[name][1]))
        return result

    def get_notes_by_series(self, series_name: str, limit: int = 20) -> list[NoteListItem]:
        unique = self.get_unique_notes(include=["metadatas", "documents"])
        matching: list[dict] = []
        for i, meta in enumerate(unique.get("metadatas", [])):
            if not meta:
                continue
            if meta.get("series", "") != series_name:
                continue
            nid = meta.get("note_id", unique["ids"][i]) if i < len(unique["ids"]) else ""
            matching.append({"id": nid, "title": meta.get("title", ""), "meta": meta, "created": meta.get("created", "")})
        matching.sort(key=lambda x: x["created"], reverse=True)
        return [NoteListItem(id=m["id"], title=m["title"], metadata=NoteMetadata(**m["meta"])) for m in matching[:limit]]

    def get_people_by_query(self, q: str = "") -> list[PersonWithFrequency]:
        unique = self.get_unique_notes(include=["metadatas"])
        participant_freq: dict[str, int] = {}
        for meta in unique.get("metadatas", []):
            if not meta:
                continue
            parts_str = meta.get("participants", "")
            if not parts_str:
                continue
            for p in [s.strip() for s in parts_str.split(",") if s.strip()]:
                p_lower = p.lower()
                participant_freq[p_lower] = participant_freq.get(p_lower, 0) + 1
        q_lower = q.strip().lower() if q else ""
        result = []
        for name, count in participant_freq.items():
            if q_lower and q_lower not in name:
                continue
            result.append(PersonWithFrequency(name=name, frequency=count))
        result.sort(key=lambda p: -p.frequency)
        return result

    def get_glossary_entries(self, q: str = "") -> list[GlossaryEntry]:
        tag_list, _ = self.get_tags()
        q_lower = q.strip().lower() if q else ""
        entries = []
        for tag_info in tag_list:
            if q_lower and q_lower not in tag_info.name.lower():
                continue
            notes = self.get_notes_by_tag(tag_info.name, n=3)
            source_ids = [n.metadata.note_id or n.id for n in notes]
            definition = ""
            for n in notes:
                if n.document:
                    definition = n.document[:200]
                    break
            entries.append(GlossaryEntry(term=tag_info.name, definition=definition, source_note_ids=source_ids[:3], frequency=tag_info.count))
        return entries

    def get_notes_since(self, timestamp: str, limit: int = 500) -> list[NoteListItem]:
        from datetime import datetime, timezone
        try:
            dt = datetime.fromisoformat(timestamp)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return []
        cutoff = dt.isoformat()
        unique = self.get_unique_notes(include=["metadatas"])
        matching: list[dict] = []
        for i, meta in enumerate(unique.get("metadatas", [])):
            if not meta:
                continue
            created = meta.get("created", "")
            modified = meta.get("modified", "")
            if (created and created >= cutoff) or (modified and modified >= cutoff):
                nid = meta.get("note_id", unique["ids"][i]) if i < len(unique["ids"]) else ""
                matching.append({"id": nid, "title": meta.get("title", ""), "meta": meta, "created": created})
        matching.sort(key=lambda x: x["created"], reverse=True)
        return [NoteListItem(id=m["id"], title=m["title"], metadata=NoteMetadata(**m["meta"])) for m in matching[:limit]]

    def get_notes_by_date(self, date: str) -> list[NoteListItem]:
        """Query notes matching a specific date, deduplicated by note_id."""
        raw = self._notes.get(where={"date": date}, include=["metadatas"])
        if not raw or not raw.get("ids"):
            return []
        seen: set[str] = set()
        notes: list[NoteListItem] = []
        for i, meta_dict in enumerate(raw.get("metadatas", [])):
            if not meta_dict:
                continue
            nm = NoteMetadata(**meta_dict)
            nid = nm.note_id or raw["ids"][i]
            if nid and nid in seen:
                continue
            if nid:
                seen.add(nid)
            notes.append(NoteListItem(id=nid, title=nm.title, metadata=nm))
        return notes

    def get_note_embedding(self, note_id: str) -> list[float] | None:
        results = self._notes.get(
            where={"$and": [{"note_id": note_id}, {"chunk_index": 0}]},
            include=["embeddings"],
            limit=1,
        )
        embs = results.get("embeddings")
        if embs is None or len(embs) == 0:
            return None
        return list(embs[0])

    def get_embeddings_for_notes(self, note_ids: list[str]) -> dict[str, list[float]]:
        if not note_ids:
            return {}
        results = self._notes.get(
            where={"$and": [{"note_id": {"$in": note_ids}}, {"chunk_index": 0}]},
            include=["embeddings", "metadatas"],
        )
        out: dict[str, list[float]] = {}
        embs_raw = results.get("embeddings")
        if embs_raw is None:
            return {}
        for i, meta in enumerate(results.get("metadatas", []) or []):
            nid = meta.get("note_id") if meta else None
            emb = list(embs_raw[i]) if i < len(embs_raw) else None
            if nid and emb:
                out[nid] = emb
        return out

    def get_similar(self, note_id: str, n: int = 10) -> list[NoteResult]:
        result = self._notes.get(ids=[note_id], include=["metadatas", "embeddings"])
        if not result.get("ids"):
            return []
        embeddings = result.get("embeddings", [])
        if embeddings is None or len(embeddings) == 0:
            return []
        return self.search_notes(embeddings[0], n=n)

    def get_tags(self) -> tuple[list[TagInfo], list[CoOccurrence]]:
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

        tag_list = [TagInfo(name=k, count=v) for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])]
        co_occur_list = [
            CoOccurrence(tag1=p[0], tag2=p[1], count=c) for p, c in sorted(co_occur.items(), key=lambda x: -x[1])
        ]
        return tag_list, co_occur_list

    def get_folders(self) -> list[str]:
        """Get all unique folder names, sorted alphabetically."""
        all_notes = self._notes.get(include=["metadatas"])
        folders: set[str] = set()
        for meta in all_notes.get("metadatas", []):
            if not meta:
                continue
            folder_val = meta.get("folder", "")
            if folder_val:
                folders.add(folder_val)
        return sorted(folders)

    def get_timeline(self, group_by: str = "month", tag: str | None = None) -> list[TimelinePeriod]:
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
                tag_set = {t.strip() for t in tags_str.split(",") if t.strip()}
                if tag not in tag_set:
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
            TimelinePeriod(period=k, count=v["count"], sample_ids=v["sample_ids"])
            for k, v in sorted(buckets.items())
        ]

    def get_stats(self) -> StatsResponse:
        unique = self.get_unique_notes(include=["documents", "metadatas"])
        all_calendar = self._calendar.get(include=[])
        total_notes = len(unique["ids"])
        total_calendar_events = len(all_calendar["ids"])

        dates: list[str] = []
        total_len = 0
        documents = unique.get("documents", [])
        for idx, meta in enumerate(unique.get("metadatas", [])):
            if meta and meta.get("created"):
                dates.append(meta["created"][:10])
            if idx < len(documents) and documents[idx]:
                total_len += len(documents[idx])

        tag_counts, _ = self.get_tags()
        date_range = [min(dates), max(dates)] if dates else [None, None]

        return StatsResponse(
            total_notes=total_notes,
            total_tags=len(tag_counts),
            date_range=date_range,
            avg_note_length=total_len // total_notes if total_notes > 0 else 0,
            total_calendar_events=total_calendar_events,
        )

    def delete_note_chunks(self, note_id: str) -> int:
        existing = self._notes.get(
            where={"note_id": note_id},
            include=["metadatas"],
        )
        if existing["ids"]:
            self._notes.delete(ids=existing["ids"])
            return len(existing["ids"])
        return 0

    def delete_notes(self, ids: list[str]) -> None:
        self._notes.delete(ids=ids)

    def delete_calendar_events(self, ids: list[str]) -> None:
        self._calendar.delete(ids=ids)

    def reset(self) -> None:
        self._client.delete_collection("notes")
        self._client.delete_collection("calendar")
        self._notes = self._client.get_or_create_collection("notes")
        self._calendar = self._client.get_or_create_collection("calendar")

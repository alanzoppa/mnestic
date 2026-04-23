# CODE_REUSE.md

## Overview

Systematic cleanup of duplication, dead code, and anti-patterns across the notes-browser codebase. Organized into 9 commits across 3 batches. Each batch includes the exact files to edit and line-level changes.

---

## Batch 1: Backend — DRY + Dead Code

### Commit 1.1: `refactor: extract format_note_results helper`

**Scope:** `backend/utils.py`, `backend/main.py`, `backend/mcp_server.py`, `backend/tests/`

**New helper in `utils.py`:**

```python
def format_note_results(raw_results: list[dict], limit: int | None = None, threshold: float | None = None) -> list[dict]:
    """Normalize ChromaDB results into clean note dicts with dedup by note_id, highest score wins."""
    seen: dict[str, dict] = {}
    for meta, distance in ((r.get("metadata", r), r.get("distance", 0)) for r in raw_results):
        meta = _normalize_meta(meta)
        nid = meta.get("note_id", meta.get("id", ""))
        if not nid:
            continue
        score = 1.0 - (distance if distance is not None else 0)
        if threshold is not None and score < threshold:
            continue
        if nid not in seen or score > seen[nid]["score"]:
            seen[nid] = {
                "id": nid,
                "score": round(score, 4),
                "title": meta.get("title", ""),
                "folder": meta.get("folder", ""),
                "tags": _flatten_tags(meta.get("tags", "")),
                "participants": _flatten_tags(meta.get("participants", "")),
                "source": meta.get("source", ""),
                "date": meta.get("date", ""),
            }
    results = list(seen.values())
    if limit is not None:
        results.sort(key=lambda x: x["score"], reverse=True)
        results = results[:limit]
    return results
```

Use this in `main.py` at:
- `search()` lines 188-229
- `_reingest_note()` lines 260-277
- `get_similar()` lines 421-438

And in `mcp_server.py` at:
- `search_notes` lines 78-89
- `find_similar_notes` lines 127-144
- `get_notes_by_tag` lines 252-269

**Expected diff: `+25` in `utils.py`, `-60` across `main.py` + `mcp_server.py`**

---

### Commit 1.2: `refactor: encapsulate raw store access in NoteStore`

**Scope:** `backend/store.py`, `backend/main.py`

**Add two methods to `NoteStore`:**

```python
def get_notes_by_date(self, date: str) -> list[dict]:
    """Query notes with calendar matching date, return deduplicated metadatas."""
    where: dict = {"date": date} if date else {}
    raw = self._notes.get(where=where, include=["metadatas"])
    if not raw or not raw.get("ids"):
        return []
    seen: dict[str, dict] = {}
    for meta in raw["metadatas"]:
        nid = meta.get("note_id", meta.get("id", ""))
        if not nid:
            continue
        if nid not in seen:
            seen[nid] = meta
    return list(seen.values())

def get_graph_nodes(self, tag: str | None = None, folder: str | None = None, max_nodes: int = 500) -> list[dict]:
    """Fetch embeddings + metadatas for graph visualization with optional filters."""
    raw = self._notes.get(include=["metadatas", "embeddings"], limit=max_nodes)
    if not raw or not raw.get("ids"):
        return []

    nodes = []
    for i, meta in enumerate(raw["metadatas"]):
        if tag and tag not in (meta.get("tags") or ""):
            continue
        if folder and meta.get("folder") != folder:
            continue
        nodes.append({
            "id": meta.get("note_id", meta.get("id", "")),
            "meta": meta,
            "embedding": raw["embeddings"][i] if raw.get("embeddings") else None,
        })
    return nodes[:max_nodes]
```

**In `main.py`:**
- `/api/graph` (lines 473-524): replace raw `_notes.get(...)` with `store.get_graph_nodes(...)`
- `/api/calendar/{event_id}` (lines 629-644): replace raw `_notes.get(...)` with `store.get_notes_by_date(...)`
- `/api/calendar/date/{date}` (lines 663-680): same

**Expected diff: `+45` in `store.py`, `-30` in `main.py`**

---

### Commit 1.3: `refactor: resolve _flatten_tags collision, add parse_tags`

**Scope:** `backend/store.py`, `backend/mcp_server.py`, `backend/utils.py`

**Current state:**
- `store.py:12-18`: `_flatten_tags(tags: list) -> str` (list -> comma string)
- `mcp_server.py:18-23`: `_flatten_tags(tag_str: str) -> list` (string -> list)

**Changes:**

In `store.py`, rename -> `_to_chroma_scalar`:
```python
def _to_chroma_scalar(tags: list | None) -> str:
    if not tags:
        return ""
    return ",".join(str(t).strip().lower() for t in tags)
```

In `utils.py`, add:
```python
def parse_tags(tag_str: str | None) -> list[str]:
    if not tag_str:
        return []
    return [t.strip().lower() for t in tag_str.split(",") if t.strip()]

def parse_tag_set(tag_str: str | None) -> set[str]:
    return set(parse_tags(tag_str))
```

In `store.py:get_notes_by_tag()` (lines 74-112), replace inline `tags_str.split(",")` with `parse_tag_set`.

In `mcp_server.py`, replace `_flatten_tags` with `parse_tags` import from `utils`.

In `main.py`, replace any inline comma-splitting with `parse_tags`.

**Expected diff: `+15` in `utils.py`, `-8` in `store.py`, `-6` in `mcp_server.py`, `-4` in `main.py`**

---

### Commit 1.4: `chore: remove dead embed aliases and unused threshold param`

**Scope:** `backend/embed.py`, `backend/store.py`, `backend/main.py`, `backend/mcp_server.py`

**In `embed.py`:** delete `embed_texts_async` and `embed_texts` (lines 53-58). Only `embed_texts_sync` and `embed_query_sync` are used.

**In `store.py:get_similar()`:** currently accepts `threshold=0.75` but ignores it. Remove the `threshold` param: `def get_similar(self, note_id: str, n: int = 10)` and update callers.

Update `main.py` and `mcp_server.py` to remove `threshold=` kwarg from `get_similar` calls.

**Expected diff: `-15` across files**

---

### Commit 1.5: `chore: extract constants module`

**Scope:** `backend/constants.py` (new), `backend/ingest.py`, `backend/main.py`

**New file `backend/constants.py`:**

```python
# Chunking
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 400
SNIPPET_MAX_LEN = 200

# Graph
MAX_GRAPH_NODES = 500
MAX_WHERE_IDS = 100

# Similarity
DEFAULT_SIMILAR_N = 10
DEFAULT_SIMILAR_THRESHOLD = 0.75

# Embedding
EMBED_DIM = 256
MAX_INPUT_TOKENS = 512
EMBED_PREFIX_DOC = "search_document:"
EMBED_PREFIX_QUERY = "search_query:"
```

Replace magic numbers in:
- `ingest.py:15, 72, 95-96`
- `main.py:459-581` (graph endpoint)

**Expected diff: `+18` in new file, `-12` in `ingest.py`, `-8` in `main.py`**

---

## Batch 2: Frontend — Hooks + Constants

### Commit 2.1: `feat: add useAsyncData hook and roll out to pages`

**Scope:** `frontend/src/lib/hooks.ts` (new), 8 page files

**New file `frontend/src/lib/hooks.ts`:**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const cancelledRef = useRef(false);

  const execute = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    cancelledRef.current = false;
    try {
      const result = await fetcher();
      if (!cancelledRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
  }, [fetcher, ...deps]);

  useEffect(() => {
    execute();
    return () => { cancelledRef.current = true; };
  }, [execute]);

  return { ...state, refetch: execute };
}
```

**Roll out page by page:**

| Page | Current Pattern | Refactored |
|------|----------------|------------|
| `timeline/page.tsx` | `useCallback` + `cancelled` + `.then/.catch/.finally` | `useAsyncData` |
| `graph/page.tsx` | `useEffect` + `cancelled` + `.then/.catch` | `useAsyncData` |
| `calendar/page.tsx` | `useCallback` + `cancelled` | `useAsyncData` |
| `notes/[id]/page.tsx` | `useEffect` + `cancelled` | `useAsyncData` |
| `browse/page.tsx` | `Promise.all` with manual `setLoading` | `useAsyncData` |
| `tags/page.tsx` | `.then/.catch` | `useAsyncData` |
| `search/page.tsx` | `.then/.catch` with local loading | `useAsyncData` |

**Expected diff: `+55` in new file, `-~150` across 8 pages**

---

### Commit 2.2: `refactor: extract STRUCTURAL_TAGS, asArray, getNoteUrl`

**Scope:** `frontend/src/lib/constants.ts`, `frontend/src/lib/api.ts`, 5 files

**`lib/constants.ts`:**

```typescript
export const STRUCTURAL_TAGS = ["apple notes", "evernote", "meeting", "conversation", "travel", "event", "project"];
```

**Move `asArray` from `browse/page.tsx` and `notes/[id]/page.tsx`:**

```typescript
export const asArray = (val: unknown): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  return [String(val)];
};
```

**Add `getNoteUrl` to `lib/api.ts`:**

```typescript
export function getNoteUrl(result: { id: string; source_id?: string }): string {
  return `/notes/${encodeURIComponent(result.id)}`;
}
```

**Update callers:**
- `app/tags/page.tsx` — import `STRUCTURAL_TAGS` and `asArray` from `lib/constants`
- `app/search/page.tsx` — import `STRUCTURAL_TAGS` and `getNoteUrl` from `lib/api`
- `app/browse/page.tsx` — remove local `STRUCTURAL_TAGS` and `asArray`, import both
- `components/TagInput.tsx` — import `STRUCTURAL_TAGS` from `lib/constants`
- `app/page.tsx` — import `getNoteUrl` from `lib/api`

**Expected diff: `+25` in new files, `-35` across 5 files**

---

### Commit 2.3: `refactor: delete local CalendarEvent interfaces`

**Scope:** `app/calendar/page.tsx`, `app/calendar/[date]/page.tsx`

**In both files:** delete local `CalendarEvent` interface (lines 7-17), replace with:

```typescript
import { CalendarEvent } from "@/lib/api";
```

**Expected diff: `-22` across 2 files**

---

### Commit 2.4: `refactor: centralize Recharts dark theme styles`

**Scope:** `frontend/src/components/charts/theme.ts` (new), all chart files

**New file `components/charts/theme.ts`:**

```typescript
export const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#e2e8f0",
  borderRadius: "8px",
};

export const cartesianGridProps = {
  stroke: "rgba(255, 255, 255, 0.05)",
  vertical: false,
};

export const axisTickProps = {
  fill: "#94a3b8",
  fontSize: 12,
};

export const xAxisProps = {
  tick: axisTickProps,
  axisLine: false,
  tickLine: false,
};

export const yAxisProps = {
  tick: axisTickProps,
  axisLine: false,
  tickLine: false,
};
```

**Update all chart files to import from `theme.ts`:**

Files:
- `components/charts/PieCharts.tsx` (lines 64-70, 131-137)
- `components/charts/LineCharts.tsx` (lines 56-62, 133-139)
- `components/charts/RadarChart.tsx` (lines 61-68)
- `app/timeline/page.tsx` (lines 211-218, 243-249, 281-287)
- `app/search/page.tsx` (lines 339-345)
- `app/tags/page.tsx` (lines 209-215)

**Expected diff: `+20` in new file, `-60` across 6 files**

---

### Commit 2.5: `refactor: share CHART_BAR_HEIGHTS constant`

**Scope:** `components/ui/Skeleton.tsx`, `app/timeline/page.tsx`

**In `Skeleton.tsx`:** export the array:

```typescript
export const CHART_BAR_HEIGHTS = [65, 42, 78, 55, 90, 35, 72, 48, 85, 38, 60, 50];
```

**In `timeline/page.tsx`:** delete local copy, import from `Skeleton.tsx`.

**Expected diff: `-10` in timeline, `+1` in Skeleton export**

---

## Batch 3: Tests + Scripts — Fixtures + Config

### Commit 3.1: `test: merge app_client fixtures, extract DUMMY_EMBEDDING`

**Scope:** `backend/tests/conftest.py`, `test_api.py`, `test_update.py`

**Add to `conftest.py`:**

```python
import pytest
from unittest.mock import MagicMock, patch

DUMMY_EMBEDDING = [0.1] * 256

@pytest.fixture
def mock_store():
    store = MagicMock()
    store.get_stats.return_value = ...
    store.get_tags.return_value = ...
    store.get_timeline.return_value = ...
    store.search_notes.return_value = ...
    store.search_calendar.return_value = ...
    store.get_note.return_value = ...
    store.get_similar.return_value = ...
    return store

@pytest.fixture
def app_client(mock_store):
    with patch("main.NoteStore", return_value=mock_store), \
         patch("main.embed_query_sync", return_value=DUMMY_EMBEDDING), \
         patch("main.embed_texts_sync", return_value=[DUMMY_EMBEDDING]):
        from main import app
        from fastapi.testclient import TestClient
        client = TestClient(app)
        yield client
```

**In `test_api.py` and `test_update.py`:** remove local `app_client` fixtures, remove `DUMMY_EMBEDDING` constant, remove redundant `mock_store` patches.

**`test_update.py` extends** `app_client` by adding its filesystem-specific patches on top.

**Expected diff: `-80` across 2 files, `+35` in `conftest.py`**

---

### Commit 3.2: `test: extract loaded_calendar fixture`

**Scope:** `backend/tests/conftest.py`, `test_calendar.py`

**Add to `conftest.py`:**

```python
@pytest.fixture
def loaded_calendar(sample_calendar):
    calendar_path, registry_path = sample_calendar
    cal = CalendarProcessor(calendar_path, registry_path)
    cal.load()
    return cal
```

**In `test_calendar.py`:** replace all 13 instances of:
```python
calendar_path, registry_path = sample_calendar
cal = CalendarProcessor(calendar_path, registry_path)
cal.load()
```
with just `cal = loaded_calendar`.

**Expected diff: `-40` in `test_calendar.py`, `+8` in `conftest.py`**

---

### Commit 3.3: `test: deduplicate mockApiRoutes with delay wrapper`

**Scope:** `frontend/e2e/fixtures/mock-router.ts`

**Current state:** two nearly identical functions (`mockApiRoutes` and `mockApiRoutesWithDelay`).

**Refactor to a single parameterized function:**

```typescript
export async function mockApiRoutes(page: Page, options?: { delayMs?: number; debug?: boolean }) {
  const delayMs = options?.delayMs ?? 0;
  const debug = options?.debug ?? false;

  const createHandler = (body: unknown, status = 200) => async (route: any) => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    await route.fulfill({ status, body: JSON.stringify(body), contentType: "application/json" });
    if (debug) console.log("handled", route.request().url());
  };

  await page.route("**/api/stats", createHandler(mockStats));
  await page.route("**/api/tags", createHandler(mockTags));
  // ... etc for all routes ...
}

export async function mockApiRoutesWithDelay(page: Page) {
  return mockApiRoutes(page, { delayMs: 2000 }); // or whatever delay was used
}
```

**Expected diff: `-110`, only one set of route definitions remains**

---

### Commit 3.4: `test: extract gotoNoteDetail helper`

**Scope:** `frontend/e2e/note-detail.spec.ts`

**Add near top of file:**

```typescript
async function gotoNoteDetail(page: Page, noteId: string, overrides?: Record<string, unknown>) {
  await mockApiRoutes(page);
  if (overrides) {
    await page.route(`**/api/notes/${noteId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ ...mockNoteDetail, ...overrides }),
        contentType: "application/json",
      });
    });
  }
  await page.goto(`/notes/${encodeURIComponent(noteId)}`);
}
```

**Replace 7 repetitive blocks in spec with `gotoNoteDetail(page, "...")`.**

**Expected diff: `-70`, `+12`**

---

### Commit 3.5: `chore: create backend/config.py and centralize paths`

**Scope:** `backend/config.py` (new), `main.py`, `calendar_data.py`, `ingest.py`, `scripts/sync_notes.py`

**New file `backend/config.py`:**

```python
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()

NOTES_DIR = PROJECT_ROOT / "notes"
CHROMA_DATA_DIR = PROJECT_ROOT / "chroma_data"
DATA_DIR = PROJECT_ROOT / "data"

CALENDAR_EXPORT_PATH = PROJECT_ROOT / "data" / "calendar-export.json"
PEOPLE_REGISTRY_PATH = PROJECT_ROOT / "data" / "people_registry.json"

DEFAULT_EMBED_MODEL = "nomic-embed-text-v2-moe"
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
```

**Replace hardcoded paths in:**
- `main.py`: `NOTES_DIR`, `CALENDAR_EXPORT_PATH`, `PEOPLE_REGISTRY_PATH`
- `calendar_data.py`: same
- `ingest.py`: `CHROMA_DATA_DIR`, `NOTES_DIR`
- `scripts/sync_notes.py`: use `config.NOTES_DIR` if available, or compute same way

**Expected diff: `+20` in new file, `-20` across 4 files**

---

### Commit 3.6: `refactor: move date normalization to shared utility`

**Scope:** `backend/utils.py`, `scripts/sync_notes.py`

**Move these from `sync_notes.py` to `utils.py`:**

```python
import re
from datetime import datetime, timezone

def parse_apple_notes_date(raw: str | None) -> str:
    """Parse Apple Notes created/modified string to ISO format."""
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    # ... existing logic ...
    return raw

def parse_evernote_date(raw: str | None) -> str:
    """Parse Evernote date string to ISO format."""
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.strptime(raw, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        try:
            dt = datetime.strptime(raw, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            return raw

def normalize_date(raw: str | None) -> str:
    """Dispatch to the right parser."""
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    if raw.endswith("Z") and "T" in raw:
        return raw
    # Try apple first, then evernote
    return parse_apple_notes_date(raw)
```

**Update `sync_notes.py` to import from `backend.utils`.**

**Expected diff: `-35` in script, `+25` in `utils.py`**

---

## Rollout Plan

1. Run **backend tests** after each commit in Batch 1.
2. After Batch 2 commits, run **vitest + E2E mock** (frontend changes).
3. After each Batch 3 commit, run **all three suites**.
4. Total expected line reduction: **~650 lines**.
5. No behavior changes — all commits are refactor-only.

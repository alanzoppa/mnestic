# Notes Browser — Improvement Plan

## Overview

6 phases, 21 tasks. Each task is isolated and can be executed by a `@hurry` subagent. Tasks within a phase are parallelizable (no dependencies between them). Phases are sequential except 5/6 which can run in parallel.

---

## Phase 1: Bug Fixes

All three fixes are independent. Run `backend/.venv/bin/pytest backend/` after each to verify.

---

### T1.1 — Fix `import sys` in scripts/sync_notes.py

**Files:** `scripts/sync_notes.py`
**Severity:** HIGH — crashes when no explicit `source` arg is passed
**Effort:** 2 min

**What to do:**
Add `import sys` to the top of `scripts/sync_notes.py` on line 1 (before existing imports). Currently `sys.path.insert(...)` is called around line 163 but `sys` is never imported.

**Context:**
The file copies/renormalizes markdown notes from a source directory. The function `_resolve_source()` calls `sys.path.insert(0, ...)` to add the repo root to the Python path so it can import `config.py`. It works when `source` is provided explicitly as an argument, but crashes when falling back to import resolution of `config`.

**Verification:** `python scripts/sync_notes.py --help` should not raise `NameError`.

---

### T1.2 — Fix calendar embedding double-prefix

**Files:** `backend/calendar_data.py:136`, `backend/embed.py:49`
**Severity:** HIGH — silently doubles `search_document:` prefix, degrading calendar search quality
**Effort:** 5 min

**What to do:**
In `backend/calendar_data.py`, line 136, remove the `search_document: ` prefix from `get_embedding_text()`:

```python
# BEFORE:
    def get_embedding_text(self, event: CalendarEvent) -> str:
        return f"search_document: {event.summary}. {event.description}. Attendees: {event.attendees}. Location: {event.location}"

# AFTER:
    def get_embedding_text(self, event: CalendarEvent) -> str:
        return f"{event.summary}. {event.description}. Attendees: {event.attendees}. Location: {event.location}"
```

**Why:** `embed.py:embed_texts_sync()` at line 49 already prepends the prefix: `f"{prefix}: {t}"` when called with `prefix="search_document"`. The calendar processor's `get_embedding_text()` also prepended `search_document:`, so calendar events were embedded as `search_document: search_document: Meeting...`. Removing the prefix from `get_embedding_text()` lets `embed_texts_sync` handle it uniformly.

**Verification:** Re-ingest calendar events with `python ingest.py --calendar-only --force`, then search for a calendar event. No test changes needed — existing tests don't verify embedding text content. All existing tests must still pass.

---

### T1.3 — Fix `set.add(list)` crash in schema.py

**Files:** `backend/schema.py:42`
**Severity:** MEDIUM — crashes when processing notes with list-type frontmatter values (tags, participants)
**Effort:** 5 min

**What to do:**
In `backend/schema.py`, modify the `discover_schema` function to handle list values properly. The issue is at line 41-42:

```python
val = fm.get(field)
if val is not None:
    unique_values[field].add(val)        # CRASHES if val is a list (unhashable)
```

Change to:

```python
val = fm.get(field)
if val is not None:
    if isinstance(val, list):
        for item in val:
            unique_values[field].add(item)
    else:
        unique_values[field].add(val)
```

Also update the sample logic (lines 43-47) — currently it does `sample_values[field].append(val[:3])` for lists but the `val[:3]` approach is fine if you keep it.

**Context:**
- `EXPECTED_FIELDS` (lines 9-19) includes `tags` and `participants` which are YAML lists
- The current code has never been tested with real multi-tag data — it only works because test fixtures use string tags
- The existing test at `backend/tests/test_schema.py` will need updating — its fixtures likely don't include list-type tags

**Verification:** `backend/.venv/bin/pytest backend/tests/test_schema.py -v`

---

## Phase 2: Backend Cleanup & Deduplication

All tasks independent. Backend tests must stay green after each.

---

### T2.1 — Create backend/shared.py (extract duplicated helpers)

**Effort:** 15 min
**New file:** `backend/shared.py`

**What to do:**
Create `backend/shared.py` containing these three functions that are currently duplicated across files:

1. `_state_lock(state_file: Path) -> Path` — from `ingest.py:18-19` and `watcher.py:25-26` (identical)
2. `_read_state(state_file: Path) -> dict` — from `ingest.py:22-30` and `watcher.py:29-37` (identical)
3. `_write_state(state_file: Path, data: dict) -> None` — from `ingest.py:33-37` and `watcher.py:40-43` (identical)
4. `_is_safe_filename(name: str) -> bool` — from `main.py:118-122` and `mcp_server.py:41-45` (identical)

**Code for each:**

`_state_lock`:
```python
from filelock import FileLock

def _state_lock(state_file: Path) -> Path:
    return state_file.with_suffix(state_file.suffix + ".lock")
```

`_read_state`:
```python
import json
from filelock import FileLock

def _read_state(state_file: Path) -> dict:
    lock = FileLock(str(_state_lock(state_file)))
    with lock.acquire(timeout=10):
        if state_file.exists():
            try:
                return json.loads(state_file.read_text())
            except Exception:
                pass
        return {}
```

`_write_state`:
```python
def _write_state(state_file: Path, data: dict) -> None:
    lock = FileLock(str(_state_lock(state_file)))
    with lock.acquire(timeout=10):
        state_file.write_text(json.dumps(data, indent=2))
```

`_is_safe_filename`:
```python
def _is_safe_filename(name: str) -> bool:
    """Reject names with path traversal attempts."""
    if not name:
        return False
    return ".." not in name and "/" not in name and "\\" not in name and "\x00" not in name
```

**Imports needed:** `from pathlib import Path`, `import json`, `from filelock import FileLock`

**Files to update:**

| File | Replace | With |
|------|---------|------|
| `ingest.py` | `_state_lock`, `_read_state`, `_write_state` (lines 18-37) | `from shared import _read_state, _write_state, _state_lock` |
| `watcher.py` | `_state_lock`, `_read_state`, `_write_state` (lines 25-44) | `from shared import _read_state, _write_state, _state_lock` |
| `main.py` | `_is_safe_filename` (lines 118-122) | `from shared import _is_safe_filename` |
| `mcp_server.py` | `_is_safe_filename` (lines 41-45) | `from shared import _is_safe_filename` |

**Verification:** `backend/.venv/bin/pytest backend/` — all 12 test files must pass.

---

### T2.2 — Delete duplicate `_to_chroma_scalar_participants`

**Files:** `backend/store.py:20-25`
**Effort:** 3 min

**What to do:**
Delete the function `_to_chroma_scalar_participants` (lines 20-25). It is 100% identical to `_to_chroma_scalar` (lines 12-17). The caller in `_serialize_metadata` (line 34) already calls `_to_chroma_scalar(v)` for lists — this function was likely never called. Verify by searching for `_to_chroma_scalar_participants` across the codebase — it has zero callers.

**Verification:** `backend/.venv/bin/pytest backend/tests/test_store.py -v`

---

### T2.3 — Use config.py consistently (stop recomputing paths)

**Files:** `backend/main.py:48`, `backend/store.py:9`
**Effort:** 3 min

**What to do:**

In `backend/main.py`, line 48:
```python
# BEFORE:
NOTES_DIR = os.path.join(os.path.dirname(__file__), "..", "notes")

# AFTER:
from config import NOTES_DIR
```
(remove the local definition)

In `backend/store.py`, line 9:
```python
# BEFORE:
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_data")

# AFTER:
from config import CHROMA_PERSIST_DIR
```
(remove the local definition)

**Why:** `config.py` already computes these paths deterministically from the repo root (`config.py:40-49`). Having two different computations risks divergence.

**Verification:** `backend/.venv/bin/pytest backend/`

---

### T2.4 — Fix unused constants and hardcoded values

**Files:** `backend/constants.py`, `backend/ingest.py`, `backend/main.py`
**Effort:** 10 min

**What to do:**

1. **`CHUNK_OVERLAP = 400` defined in constants.py but ingest hardcodes 200.** In `ingest.py`, `chunk_text()` defaults to `overlap=200` (line 39) and `build_note_chunks()` hardcodes `200` at call sites. The AGENTS.md says "400 char overlap." Change `ingest.py` to use `constants.CHUNK_OVERLAP`:

```python
# ingest.py line 39:
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
```

Update call sites in `build_note_chunks` (~line 88) that hardcode `200` for overlap to use the constant.

2. **`MAX_GRAPH_WHERE_IDS = 100` defined but graph endpoint hardcodes 250 and 1000.** In `main.py` graph endpoint:
   - Line 526: `filtered_ids[:250]` — change to `MAX_GRAPH_WHERE_IDS` or add a new constant.
   - Line 533: `sample_ids[:1000]` — add `MAX_GRAPH_SAMPLE_IDS = 1000` to `constants.py`.
   - Line 567: `if len(all_meta) >= 1000: break` — use the same new constant.
   Add `MAX_GRAPH_SAMPLE_IDS = 1000` to `constants.py`.

**Verification:** `backend/.venv/bin/pytest backend/`

---

### T2.5 — Pin requirements, add .env.example, add pyproject.toml

**Files:** `backend/requirements.txt`, new `.env.example` at repo root, new `backend/pyproject.toml`
**Effort:** 10 min

**What to do:**

1. **Pin `backend/requirements.txt`.** Run `backend/.venv/bin/pip freeze` and update `requirements.txt` with exact versions for each package. Format: `package==X.Y.Z`.

2. **Create `.env.example` at repo root:**
```ini
# External data sources — adjust for your environment
CALENDAR_EXPORT_PATH=~/Downloads/calendar-export.json
PEOPLE_REGISTRY_PATH=~/Desktop/notes/people_registry.json
NOTES_SOURCE=~/Desktop/notes/Apple Notes
```

3. **Create `backend/pyproject.toml`:**
```toml
[project]
name = "notes-browser-backend"
version = "0.1.0"
description = "Private semantic search for personal markdown notes — FastAPI backend"
requires-python = ">=3.11"

[tool.pytest.ini_options]
testpaths = ["backend/tests"]

[tool.ruff]
line-length = 140
target-version = "py311"
```

**Verification:** `python -c "import tomllib; tomllib.load(open('backend/pyproject.toml', 'rb'))"` succeeds.

---

## Phase 3: Backend Architecture

---

### T3.1 — Extract graph_service.py from main.py

**Effort:** 30 min
**New file:** `backend/graph_service.py`

**What to do:**
Extract the entire graph construction logic from `main.py:502-623` into `backend/graph_service.py` as a single function `build_similarity_graph()`. The `/api/graph` endpoint becomes a thin 3-line wrapper.

**Export from graph_service.py:**
```python
def build_similarity_graph(
    store: NoteStore,
    tag: str | None = None,
    folder: str | None = None,
    threshold: float = 0.75,
) -> dict:
    """Build a similarity graph from note embeddings.
    
    Returns {'nodes': [...], 'edges': [...]} matching GraphResponse schema.
    """
```

**Move lines 504-622 from main.py into this function body.** The function:
1. Builds where clauses for tag/folder filtering (lines 504-513)
2. If tag filter only: fetches all note metadata, filters by tag, caps at 250 (lines 515-528)
3. Retrieves metadata for all candidate notes (lines 531-568), capping at 1000
4. Fetches embeddings from ChromaDB (lines 573-576)
5. Computes cosine similarity matrix using sklearn (line 578-584)
6. Builds edges for pairs above threshold, deduplicates via sorted tuple pairs (lines 590-603)
7. Builds node list from connected nodes (lines 605-621)

**In main.py:**
Replace lines 502-623 with:
```python
@app.get("/api/graph", response_model=GraphResponse)
async def get_graph(tag: Optional[str] = None, folder: Optional[str] = None, n_neighbors: int = 3, threshold: float = 0.75) -> dict:
    return build_similarity_graph(store, tag, folder, threshold)
```

**Imports needed in graph_service.py:** `from store import NoteStore`, `from models import NoteMetadata`, `from constants import MAX_GRAPH_WHERE_IDS, MAX_GRAPH_NODES`, `from sklearn.metrics.pairwise import cosine_similarity`

**Context:**
- The function uses `store._notes` (private ChromaDB attribute) directly at lines 516, 548, 574 — note this in the function docstring as a known leak
- `NoteMetadata(**meta).model_dump()` is used to deserialize ChromaDB metadata
- The `n_neighbors` parameter (line 503) is accepted but never used — keep it in the signature for future use but don't add logic

**Verification:** `backend/.venv/bin/pytest backend/`

---

### T3.2 — Move request models to models.py

**Files:** `backend/models.py`, `backend/main.py`
**Effort:** 10 min

**What to do:**
Move `SearchRequest`, `UpdateNoteRequest`, `SearchResult`, and `IngestRequest` from `main.py` (lines 160-186) to `models.py`. All response models already live there.

**Code to add to models.py:**

```python
class SearchRequest(BaseModel):
    query: str
    filters: dict = Field(default_factory=dict)
    n: int = 20
    include_calendar: bool = True
    rerank: bool = True


class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    participants: Optional[list[str]] = None


class IngestRequest(BaseModel):
    full: bool = False
```

`SearchResult` (lines 175-182) — check if still used. If `SearchResponse` in models.py uses `SearchResultItem` instead, `SearchResult` may be dead code. Delete rather than move if unused.

**In main.py:**
- Add to the existing import from models: `SearchRequest, UpdateNoteRequest, IngestRequest`
- Delete the local definitions (lines 160-186)

**In models.py:**
- Add the models near the top (after `CalendarEvent`/`NoteMetadata`, before response models)
- `Field` from pydantic and `Optional` from typing are already imported

**Verification:** `backend/.venv/bin/pytest backend/`

---

### T3.3 — Fix ChromaDB private `._notes` access in ingest.py

**Files:** `backend/ingest.py`, `backend/store.py`
**Effort:** 15 min

**What to do:**
`ingest.py:ingest_notes()` accesses `store._notes` (the private ChromaDB collection) directly to find and delete existing chunks for a note_id (lines ~240-249). This bypasses the public API.

Add a public method to `NoteStore` in `store.py`:

```python
def get_note_chunks(self, note_id: str) -> dict:
    """Return all chunk IDs and metadatas for a given note_id."""
    return self._notes.get(
        where={"note_id": {"$eq": note_id}},
        include=["metadatas"],
    )
```

Also add:
```python
def delete_chunks(self, ids: list[str]) -> None:
    """Delete chunks by their document IDs."""
    if not ids:
        return
    self._notes.delete(ids=ids)
```

Then in `ingest.py`, replace direct access with these methods.

**Context:**
- `store._notes` is the ChromaDB `chromadb.Collection` object created at `store.py:53`
- The deletion loop in `ingest.py` does: get all ids for a note_id, then `store._notes.delete(ids=...)`. Wrap both steps in the new public methods.
- The private access also occurs in the graph endpoint (lines 516, 548, 574) — T3.1 moved those to `graph_service.py`, but that new file will also need to access `._notes`. Either add more public methods as needed or live with it in `graph_service.py` (it's at least in one place now).

**Verification:** `backend/.venv/bin/pytest backend/tests/test_ingest.py backend/tests/test_store.py -v`

---

## Phase 4: Frontend Improvements

---

### T4.1 — Extract shared Recharts Tooltip config

**Effort:** 8 min
**New file:** `frontend/src/lib/chart-styles.ts`

**What to do:**
The identical Tooltip `contentStyle` object appears in 3 files:

- `frontend/src/app/search/page.tsx:345-351`
- `frontend/src/app/tags/page.tsx:205-211`
- `frontend/src/app/timeline/page.tsx` — lines 202-209, 234-239, 273-278 (3 chart types)

**Create `frontend/src/lib/chart-styles.ts`:**

```typescript
import type { CSSProperties } from 'react';

export const TOOLTIP_STYLE: { contentStyle: CSSProperties } = {
  contentStyle: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '0.5rem',
    color: '#fafafa',
  },
} as const;

export const CARTESIAN_GRID = { strokeDasharray: '3 3', stroke: '#27272a' } as const;

export const X_AXIS_DARK = {
  stroke: '#52525b',
  tick: { fill: '#a1a1aa', fontSize: 11 },
} as const;

export const Y_AXIS_DARK = {
  stroke: '#52525b',
  tick: { fill: '#a1a1aa', fontSize: 12 },
} as const;
```

Then in each page, import and replace:
```typescript
import { TOOLTIP_STYLE, CARTESIAN_GRID, X_AXIS_DARK, Y_AXIS_DARK } from '@/lib/chart-styles';

// Replace contentStyle={{...}} with:
<Tooltip {...TOOLTIP_STYLE} />

// Replace CartesianGrid strokeDasharray/stroke with:
<CartesianGrid {...CARTESIAN_GRID} />
```

**Verification:** `cd frontend && npm run test`. Visual check: charts look identical.

---

### T4.2 — Extract EmptyState component

**Effort:** 10 min
**New file:** `frontend/src/components/ui/EmptyState.tsx`

**What to do:**
The same empty-state pattern (icon + title + subtitle + optional clear action button) appears across pages:
- `search/page.tsx:420-435`
- `browse/page.tsx:405-422`
- `tags/page.tsx:225-227` (simpler variant inside chart card)

**Create `frontend/src/components/ui/EmptyState.tsx`:**

```typescript
import { Search } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = <Search className="w-16 h-16 mx-auto mb-4 text-zinc-600" />, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="text-xl font-medium text-zinc-300">{title}</p>
      {subtitle && <p className="text-sm text-zinc-500 mt-2">{subtitle}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

In each page, replace the inline empty-state JSX with:
```typescript
import { EmptyState } from '@/components/ui/EmptyState';

// search page:
<EmptyState
  title="No results found"
  subtitle="Try adjusting your search query or filters"
  action={activeFiltersCount > 0 ? { label: 'Clear Filters', onClick: clearFilters } : undefined}
/>

// browse page:
<EmptyState
  title="No notes found"
  subtitle="Try adjusting your filters"
  action={activeFiltersCount > 0 ? { label: 'Clear Filters', onClick: clearFilters } : undefined}
/>

// tags page chart card (inside CardContent):
<EmptyState title="No tags match your filters" />
```

**Verification:** `cd frontend && npm run test`

---

### T4.3 — Consolidate inline SVGs → lucide-react

**Effort:** 40 min
**Files:** Every page.tsx with inline SVGs — `page.tsx`, `search/page.tsx`, `notes/[id]/page.tsx`, `browse/page.tsx`, `tags/page.tsx`

**What to do:**
Replace all inline SVG elements with lucide-react equivalents. `lucide-react` is already a dependency (used in `Nav.tsx` and `SearchAutocomplete.tsx`).

**Mapping table:**

| File | Lines | Inline SVG | lucide-react replacement |
|------|-------|------------|--------------------------|
| `page.tsx:20-24` | `DocumentIcon` component | Document outline | `FileText` |
| `page.tsx:26-29` | `TagIcon` component | Tag outline | `Tag` |
| `page.tsx:32-35` | `CalendarIcon` component | Calendar outline | `Calendar` |
| `page.tsx:38-41` | `ClockIcon` component | Clock outline | `Clock` |
| `page.tsx:170-172` | Search SVG in Explore | Search magnifier | `Search` |
| `page.tsx:178-180` | Browse SVG in Explore | Folder | `FolderOpen` |
| `page.tsx:186-188` | Tag SVG in Explore | Tag | `Tag` |
| `page.tsx:194-196` | Graph bolt SVG | Lightning bolt | `Zap` |
| `search/page.tsx:192-193` | Filter icon | Sliders/filter | `Filter` |
| `search/page.tsx:407-408` | Chevron right | Arrow right | `ChevronRight` |
| `search/page.tsx:423` | Empty state search | Large search | `Search` |
| `notes/[id]/page.tsx:239-240` | Back arrow | Left arrow | `ArrowLeft` |
| `notes/[id]/page.tsx:278-279` | Calendar icon | Calendar | `Calendar` |
| `notes/[id]/page.tsx:286-287` | Clock icon | Clock | `Clock` |
| `notes/[id]/page.tsx:327-328` | Spinner | Loading spinner | `Loader2` with `animate-spin` |
| `notes/[id]/page.tsx:332-333` | Checkmark | Check | `Check` |
| `notes/[id]/page.tsx:351-352` | Edit pencil | Pencil | `Pencil` |
| `notes/[id]/page.tsx:402-404` | Paperclip | Attachment | `Paperclip` |
| `notes/[id]/page.tsx:485-486` | Calendar (sidebar) | Calendar | `Calendar` |
| `notes/[id]/page.tsx:516-517` | Bolt (similar) | Lightning bolt | `Zap` |
| `browse/page.tsx:176-178` | Search icon | Search magnifier | `Search` |
| `browse/page.tsx:187-189` | Filter icon | Sliders/filter | `Filter` |
| `browse/page.tsx:197-199` | Star (favorites) | Star | `Star` |
| `browse/page.tsx:346-347` | Chevron right | Arrow right | `ChevronRight` |
| `browse/page.tsx:409` | Empty state icon | Frown | `Frown` |
| `tags/page.tsx:161-162` | Search icon | Search magnifier | `Search` |

**Replacement pattern:**
```tsx
// BEFORE:
<button className="...">
  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
  </svg>
  Search
</button>

// AFTER:
import { Search } from 'lucide-react';
<button className="...">
  <Search className="w-4 h-4 mr-2" />
  Search
</button>
```

Note: lucide-react components default to `strokeWidth={2}` and use `currentColor`, matching current behavior.

**After replacing all inline SVGs:**
- In `page.tsx`: delete the `DocumentIcon`, `TagIcon`, `CalendarIcon`, `ClockIcon` component definitions (lines 20-42)
- Import all needed lucide components in each file

**Verification:** `cd frontend && npm run test && npm run build` — no import errors, visual check of key pages

---

### T4.4 — Push `asArray` normalization to query wrappers

**Effort:** 15 min
**Files:** `frontend/src/lib/queries.ts`, `frontend/src/lib/constants.ts`, `frontend/src/app/browse/page.tsx`, `frontend/src/app/notes/[id]/page.tsx`, `frontend/src/components/NoteResult.tsx`

**What to do:**
Pages currently call `asArray(meta.tags)` to normalize the API response (which may return tags as comma-joined string or array). Instead, normalize at the query layer in `queries.ts` so pages always receive arrays.

In `frontend/src/lib/queries.ts`, add normalization to `searchApi.all()` (lines 140-148):

```typescript
import { asArray } from './constants';

// In searchApi.all, before returning:
return res.results.map(r => ({
  ...r,
  metadata: {
    ...r.metadata,
    tags: asArray(r.metadata?.tags),
    participants: asArray(r.metadata?.participants),
  },
}));
```

Then remove `asArray` calls from pages where data comes from `searchApi.all()`:
- `browse/page.tsx:73` — inside `facets` useMemo: `asArray(meta.tags)` → `meta.tags` (already array)
- `browse/page.tsx:99-101` — tag filter: `asArray(meta.tags)` → `meta.tags`
- `browse/page.tsx:342` — in card rendering: `asArray(meta.tags)` → `meta.tags`
- `NoteResult.tsx:34` — `tags` prop already receives array from caller

Keep `asArray` in `notes/[id]/page.tsx:230` since notes come from `notesApi.detail()` (different endpoint, not normalized).

**Update `frontend/src/lib/queries.ts` import**: `asArray` from `./constants` is already available.

**Verification:** `cd frontend && npm run test`

---

### T4.5 — Remove dead code from favorites.ts

**Files:** `frontend/src/lib/favorites.ts`
**Effort:** 2 min

**What to do:**
Delete lines 1-41 from `favorites.ts` — the module-level standalone functions (`getFavoritesSet()`, `saveFavorites()`, `getFavorites()`, `isFavorite()`, `toggleFavorite()`). These are never imported or called anywhere in the codebase. Only `useFavorites()` (lines 42-57) is used across the app (by `page.tsx`, `browse/page.tsx`, `notes/[id]/page.tsx`).

Resulting file (keep only the hook):
```typescript
'use client'
import { useLocalStorage } from '@/lib/hooks'

const STORAGE_KEY = 'notes-browser-favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEY, [])
  const isFav = (noteId: string) => favorites.includes(noteId)
  const toggle = (noteId: string) => {
    setFavorites(prev => {
      if (prev.includes(noteId)) return prev.filter(id => id !== noteId)
      return [...prev, noteId]
    })
  }
  return { favorites, isFav, toggle }
}
```

**Verification:** `cd frontend && npm run test && npm run build` — no import errors

---

## Phase 5: Test Coverage

---

### T5.1 — Add reranker unit tests

**Effort:** 25 min
**New file:** `backend/tests/test_reranker.py`

**Test scenarios to implement:**

1. **`Reranker.__init__` accepts custom model_name**
   ```python
   r = Reranker("custom/model")
   assert r.model_name == "custom/model"
   ```

2. **`Reranker.__init__` defaults to RERANKER_MODEL**
   ```python
   r = Reranker()
   assert r.model_name == RERANKER_MODEL
   ```

3. **`Reranker.available()` returns False when `sentence_transformers` not available**
   Mock by patching `rerank.CrossEncoder = None` before instantiation.
   ```python
   with patch("rerank.CrossEncoder", None):
       r = Reranker()
       assert not r.available()
   ```

4. **`Reranker.rerank()` returns original order when model unavailable**
   ```python
   candidates = [{"title": "B", "score": 0.5}, {"title": "A", "score": 0.9}]
   with patch("rerank.CrossEncoder", None):
       r = Reranker()
       result = r.rerank("test", candidates)
   assert result == candidates
   ```

5. **`Reranker.rerank()` returns empty list when empty candidates**
   ```python
   r = Reranker()
   assert r.rerank("test", []) == []
   ```

6. **`Reranker.rerank()` builds correct (query, text) pairs for prediction**
   Mock `CrossEncoder.__init__` to return a mock instance, then assert `model.predict()` was called with `[("test", "title. snippet")]`.

7. **`Reranker.rerank()` sorts by score descending**
   Mock `model.predict` to return scores in reverse order, verify candidates are sorted descending by score.

8. **`Reranker.rerank()` uses `RERANK_BATCH_SIZE`**
   Mock `model.predict` and check `batch_size=RERANK_BATCH_SIZE` was passed.

**Imports needed in test file:**
```python
from unittest.mock import MagicMock, patch, PropertyMock
from rerank import Reranker
from constants import RERANKER_MODEL, RERANK_BATCH_SIZE
```

**Verification:** `backend/.venv/bin/pytest backend/tests/test_reranker.py -v`

---

### T5.2 — Add graph endpoint tests

**Effort:** 25 min
**New file:** `backend/tests/test_graph.py` (or add to `test_api.py`)

**Test scenarios to implement (use `app_client` and `tmp_store` fixtures from conftest):**

1. **Empty graph** — store with no embeddings → returns `{"nodes": [], "edges": []}`
   ```python
   def test_graph_empty(app_client):
       res = app_client.get("/api/graph")
       assert res.status_code == 200
       assert res.json() == {"nodes": [], "edges": []}
   ```

2. **Single note** — store has one note → no edges, empty nodes
   Populate `tmp_store` with one note chunk, then call endpoint.

3. **Two similar notes** — add two note chunks with known embeddings (e.g., `[[1.0, 0.0], [0.9, 0.1]]`) with threshold 0.75. Expect one edge with weight ≈ 0.9.

4. **Same note_id skip** — two chunks with same note_id should NOT produce an edge.

5. **Tag filter** — only nodes matching tag appear. Add 3 notes, 2 with tag "work", 1 with tag "personal". Call `?tag=work` and verify only 2 nodes.

6. **Threshold behavior** — lower threshold returns more edges. Same 3 notes, test with threshold 0.5 vs 0.95.

7. **Response model validation** — output matches schema: each node has `id`, `title`, `folder`, `tags`, `source`, `created`.

**Fixture pattern for test data:**
```python
def test_graph_two_notes(app_client, tmp_store):
    # Add two note chunks with mock embeddings
    tmp_store._notes.add(
        ids=["note_1_chunk_0", "note_2_chunk_0"],
        embeddings=[[1.0, 0.0], [0.9, 0.1]],
        metadatas=[
            {"note_id": "note_1", "title": "Alpha", "tags": "work,important"},
            {"note_id": "note_2", "title": "Beta", "tags": "work"},
        ],
    )
    res = app_client.get("/api/graph?threshold=0.75")
    data = res.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) == 1
    assert data["edges"][0]["weight"] >= 0.75
```

**Verification:** `backend/.venv/bin/pytest backend/tests/test_graph.py -v`

---

### T5.3 — Add component unit tests for search page

**Effort:** 35 min
**New file:** `frontend/src/components/__tests__/search-page.test.tsx`

**Testing approach:** vitest + @testing-library/react. Mock react-query hooks and the API layer.

**Test wrapper:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

**API mocks:**
```typescript
vi.mock('@/lib/queries', () => ({
  searchApi: {
    all: vi.fn().mockResolvedValue([]),
  },
  tagsApi: {
    all: vi.fn().mockResolvedValue({
      tags: [
        { name: 'work', count: 50 },
        { name: 'personal', count: 30 },
      ],
      co_occurrence: [],
    }),
  },
  schemaApi: {
    get: vi.fn().mockResolvedValue({ sources: ['Apple Notes', 'Evernote'], fields: [] }),
  },
}));
```

**Test scenarios to implement:**

1. **Initial render** — search input present, popular tags visible, no results section
2. **Search submitted** — triggers API call, results appear
3. **Filter toggle** — clicking shows/hides filter panel by `data-testid="filter-panel"`
4. **Source filter** — clicking "Apple Notes" sets `data-active="true"` on that button
5. **Tag filter** — clicking a tag badge toggles selected state
6. **Date range picker** — component renders
7. **Clear all filters** — resets filters to defaults
8. **Empty results** — empty state renders with appropriate message
9. **Calendar result click** — navigates to `/calendar/{date}`
10. **Note result click** — navigates to `/notes/{note_id}`

**Verification:** `cd frontend && npm run test`

---

### T5.4 — Add component unit tests for browse page

**Effort:** 35 min
**New file:** `frontend/src/components/__tests__/browse-page.test.tsx`

**Test wrapper:** Same as T5.3.

**API mocks:**
```typescript
vi.mock('@/lib/queries', () => ({
  searchApi: {
    all: vi.fn().mockResolvedValue(/* array of 60 mock search results */),
  },
  schemaApi: {
    get: vi.fn().mockResolvedValue({ sources: ['Apple Notes', 'Evernote'], fields: [] }),
  },
}));
vi.mock('@/lib/favorites', () => ({
  useFavorites: vi.fn().mockReturnValue({
    favorites: [],
    isFav: vi.fn().mockReturnValue(false),
    toggle: vi.fn(),
  }),
}));
```

**Test scenarios (10+):**

1. **Initial render** — page title "Browse Notes", search input, filter button
2. **Loading state** — SkeletonNoteCards appear while loading
3. **Results display** — notes appear as cards with title/source/folder/tags
4. **Source facet filter** — clicking a source filters results
5. **Folder facet filter** — clicking a folder filters results
6. **Tag filter** — clicking tag badge filters notes
7. **Favorites toggle** — clicking favorites button toggles between all/favorites
8. **Search query** — typing filters results by title (debounced)
9. **Pagination** — Previous/Next buttons navigate pages, disabled at edges
10. **Empty state** — when no notes match search/filters, EmptyState renders
11. **Note click** — clicking a note navigates to `/notes/{note_id}`

**Verification:** `cd frontend && npm run test`

---

## Phase 6: Documentation

---

### T6.1 — Add backend code conventions to AGENTS.md

**Files:** `/AGENTS.md`
**Effort:** 15 min

**Add a new section after "Architecture" (after the ASCII diagram, around line 21):**

```markdown
## Code Conventions — Backend

### Imports
- Always import from `config.py` for path constants (`NOTES_DIR`, `CHROMA_PERSIST_DIR`, `IMAGES_DIR`)
  — never recompute with `os.path.join(os.path.dirname(__file__), "..")`
- Use `from __future__ import annotations` at the top of every file

### Shared utilities
- `backend/shared.py` contains `_read_state`, `_write_state`, `_state_lock`, `_is_safe_filename`
  — if you need these, import them; do not copy-paste
- `backend/models.py` contains ALL Pydantic models (request + response)
  — never define models in route handlers

### State files
- State files use `filelock.FileLock` with `.lock` suffix (via `_state_lock`)
- State format is JSON dict read/written via `_read_state`/`_write_state`

### Store access
- Never access `store._notes` or `store._calendar` directly from outside `store.py`
  — add a public method to `NoteStore` if you need something not yet exposed
- Embedding prefix is handled by `embed_texts_sync()` in `embed.py`
  — do NOT prepend `search_document:` yourself

### File organization
Each file has one clear responsibility:

| File | Responsibility |
|------|---------------|
| `config.py` | Environment + paths |
| `constants.py` | Numerical/config constants |
| `models.py` | All Pydantic models |
| `store.py` | ChromaDB operations |
| `embed.py` | Ollama embedding client |
| `rerank.py` | Cross-encoder reranker |
| `ingest.py` | Ingestion pipeline |
| `watcher.py` | File watcher (watchdog) |
| `calendar_data.py` | Calendar event processing |
| `schema.py` | Frontmatter schema discovery |
| `graph_service.py` | Similarity graph construction |
| `shared.py` | Shared helpers (state, safety) |
| `main.py` | FastAPI endpoint definitions ONLY (thin wrappers) |

### Error handling
- Ingestion errors are collected and returned (not thrown)
- API endpoints rely on FastAPI's default 500 handler — add explicit try/except only if you need custom error messages
- Embedding failures trigger bisect fallback in `embed_texts_sync`
```

---

### T6.2 — Add frontend lib/ catalog to AGENTS.md

**Files:** `/AGENTS.md`
**Effort:** 10 min

**Add after the "Directory structure" section (after line 70):**

```markdown
## Frontend `lib/` catalog

All shared utilities live in `frontend/src/lib/`. Import from here instead of copying patterns.

| File | Purpose |
|------|---------|
| `api.ts` | FastAPI client — all API call functions + TypeScript interfaces for every data type |
| `queries.ts` | React Query wrappers — query keys + query functions + mutation wrappers. Pages import from here, not from `api.ts` directly |
| `constants.ts` | `STRUCTURAL_TAGS` (folder/source tags), `asArray()` (tags/participants normalization) |
| `chart-styles.ts` | Shared Recharts config (Tooltip style, axis styles, grid config) |
| `dates.ts` | date-fns wrappers (`toISODate`, `parseISODate`, `getMonthDays`, date presets, etc.) |
| `hooks.ts` | `useDebouncedValue`, `useLocalStorage` (generic) |
| `favorites.ts` | `useFavorites()` hook — localStorage-backed favorites tracking. Returns `{ favorites, isFav, toggle }` |

### API wrapper pattern
- `api.ts` is raw — returns what the backend sends
- `queries.ts` wraps and normalizes (e.g., extracting `.events` from calendar response, normalizing tags to arrays)
- Pages call **query functions** (e.g., `searchApi.all(...)`) — never import `api.ts` functions directly

### Icons
- Use `lucide-react` for ALL icons. Available: `FileText`, `Tag`, `Calendar`, `Clock`, `Search`, `Filter`, `ChevronRight`, `ArrowLeft`, `Star`, `Frown`, `Paperclip`, `Pencil`, `Zap`, `Check`, `Loader2`, `FolderOpen`, `ArrowLeft`
- Never add inline SVG path elements — import the lucide wrapper component
```

---

### T6.3 — Add graph algorithm + reranker documentation to AGENTS.md

**Files:** `/AGENTS.md`
**Effort:** 15 min

**Add two new sections after "ChromaDB collections" (after line 128):**

```markdown
## Graph construction algorithm

The similarity graph (`/api/graph`) shows note relationships based on embedding cosine similarity.

### Pipeline
1. **Filter candidates** — optional `tag`/`folder` filter selects candidate notes (capped at 1000)
2. **Fetch embeddings** — retrieve embeddings from ChromaDB for all candidate note_ids
3. **Similarity matrix** — compute pairwise cosine similarity via `sklearn.metrics.pairwise.cosine_similarity`
4. **Edge construction** — for each pair (i, j) where `i < j`: if `sim[i][j] >= threshold` (default 0.75), create an edge. Skip pairs with the same note_id (chunk deduplication)
5. **Deduplication** — edges use sorted tuple `(source_nid, target_nid)` with a Set to prevent duplicates
6. **Node list** — only include nodes that have at least one edge

### Key parameters
| Parameter | Default | Meaning |
|-----------|---------|---------|
| `tag` | None | Filter to notes containing this tag (case-insensitive, ChromaDB `$contains`) |
| `folder` | None | Filter to notes in this folder |
| `threshold` | 0.75 | Minimum cosine similarity for an edge |

### Frontend rendering
- `react-force-graph-3d` renders the 3D force-directed graph
- Nodes are colored by primary tag (first tag) via `hashString()` + `COLOR_PALETTE`
- Clicking a node moves camera and shows the detail pane

---

## Reranker

Second-stage ranking for note search results using `BAAI/bge-reranker-v2-m3`.

### How it works
1. **First stage** — ChromaDB semantic search returns candidates (up to `RERANK_MAX_CANDIDATES = 100`)
2. **Second stage** — cross-encoder scores each `(query, candidate_text)` pair, where `candidate_text = "{title}. {snippet}"`
3. **Results** — candidates sorted by reranker score descending; original `score` field is overwritten
4. **Fallback** — if model fails to load or inference errors, candidates returned in original order

### Graceful degradation
- If `sentence_transformers` import fails, `CrossEncoder = None` and `reranker.available()` returns `False`
- Search endpoint checks `reranker.available()` — if unavailable, returns raw embedding scores
- `rerank=false` query param skips reranking entirely (used by Browse page)
- Empty query (`"*"`) never triggers reranker
```

---

## Execution Order

```
Phase 1 (Bug Fixes)        T1.1, T1.2, T1.3         Parallel
       ↓
Phase 2 (Cleanup)          T2.1, T2.2, T2.3, T2.4, T2.5   Parallel
       ↓
Phase 3 (Architecture)     T3.1 → T3.2 → T3.3       Sequential
       ↓
Phase 4 (Frontend)         T4.1, T4.2, T4.3, T4.4, T4.5  Parallel
       ↓
                  ┌──────────────────────┐
                  ↓                      ↓
Phase 5 (Tests)           Phase 6 (Docs)
5.1, 5.2, 5.3, 5.4       6.1, 6.2, 6.3
(parallel within phase)   (parallel within phase)
```

## Test Gate

After each phase, run the full test suite:

```bash
cd .
backend/.venv/bin/pytest backend/
cd frontend && npm run test && cd ..
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/ --project=mock
```

All tests must be green before moving to the next phase. No exceptions.

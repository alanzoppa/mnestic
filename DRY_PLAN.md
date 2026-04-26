# DRY Plan: Replacing Custom Code with Third-Party Libraries

> **Project:** notes-browser  
> **Scope:** Both FastAPI backend and Next.js 16 frontend  
> **Goal:** Replace fragile or duplicated custom code with well-maintained, production-grade libraries.  
> **Status:** This is a planning document — implementation is tracked below.

---

## Backend (Python)

---

### 1. Configuration → `pydantic-settings`

**Status:** ✅ **Completed.**

`backend/config.py` uses `pydantic_settings.BaseSettings` with `field_validator` for `~` expansion. `backend/config_env.py` was deleted. All imports migrated from `from config_env import X` to `from config import settings`.

**Checklist**
- [x] Add `pydantic-settings>=2.0` to `backend/requirements.txt`.
- [x] Write `backend/config.py`.
- [x] Search-and-replace all imports across backend files.
- [x] Delete `backend/config_env.py`.
- [x] Run backend tests.
- [x] Run full test suite.
- [x] Commit.

---

### 2. Text Chunking → `langchain-text-splitters`

**Status:** ✅ **Completed.**

`backend/ingest.py` imports `MarkdownTextSplitter` from `langchain_text_splitters` (standalone package, no full LangChain). The old `chunk_text()` helper now delegates to `MarkdownTextSplitter`, which respects markdown headers instead of slicing mid-character.

**Checklist**
- [x] Install `langchain-text-splitters` in the venv.
- [x] Add to `requirements.txt`.
- [x] Replace `chunk_text()` calls in `ingest.py`; delete manual slicing.
- [x] Run backend tests.
- [x] Run full test suite.
- [x] Commit.

---

### 3. Ad-hoc Retry Logic → `tenacity`

**Status:** ✅ **Completed.**

`backend/embed.py` uses `@retry` from `tenacity` with exponential backoff on `httpx.HTTPStatusError` and `httpx.ConnectError`. `scripts/caption_images.py` also wraps its Ollama `httpx.post` with `@retry`.

**Checklist**
- [x] Add `tenacity` to `backend/requirements.txt`.
- [x] Refactor `embed_texts_sync` in `backend/embed.py`.
- [x] Add `tenacity` retry decorator to `caption_images.py` `httpx.post`.
- [x] Run backend tests.
- [x] Run full test suite.
- [x] Commit.

---

### 4. Raw Dicts / String-sliced Dates → `pydantic` models

**Status:** ✅ **Completed.**

`backend/models.py` defines `CalendarEvent` and `NoteMetadata` pydantic models. Calendar events are no longer plain dicts — `CalendarProcessor` returns typed models. `NoteMetadata` coerces comma-separated strings back to lists via `@field_validator`, replacing the manual `_normalize_meta` mutation hack. FastAPI endpoints return models directly (auto-serialized).

**Checklist**
- [x] Create `backend/models.py` with `CalendarEvent` and `NoteMetadata`.
- [x] Update `CalendarProcessor.process_events()` to return typed models.
- [x] Update all calendar event callers (`main.py`, `ingest.py`, `mcp_server.py`).
- [x] Replace `_normalize_meta(meta)` with `NoteMetadata(**meta).model_dump()` at call sites.
- [x] Delete `_normalize_meta` from `utils.py` and remove imports.
- [x] Run backend tests.
- [x] Run full test suite.
- [x] Commit.

---

#### Phase A – CalendarEvent (isolated, low-risk)

`CalendarProcessor` refactor in `backend/calendar_data.py`:

| Method | Change |
|--------|--------|
| `process_events()` | Returns `list[CalendarEvent]` instead of `list[dict]` |
| `get_events_for_date()` | Returns `list[CalendarEvent]` |
| `get_events_for_participant()` | Returns `list[CalendarEvent]` |
| `get_embedding_text()` | Duck-typed: accepts `dict` or `CalendarEvent` (no change needed unless explicitly typed) |

Downstream callers (update access from `event["..."]` to `event.summary`, `event.date`, etc.):

| File | Scope |
|------|-------|
| `backend/main.py` | Calendar endpoints return validated models; FastAPI auto-serializes Pydantic models |
| `backend/ingest.py` | `get_calendar_context()` reads from `CalendarEvent` objects |
| `backend/mcp_server.py` | Calendar tools return models directly |

Test impact:

| File | Change |
|------|--------|
| `backend/tests/test_calendar.py` | Dict accessors → model `.model_dump()` or dot accessors |

---

#### Phase B – NoteMetadata (broader, medium-risk)

**Strategy:** Keep public API responses as `dict` initially: `meta = NoteMetadata(**raw_meta).model_dump()`. This lets us eliminate `_normalize_meta` without changing endpoint return types. After all call sites are proven, migrate to passing models natively.

Replace `_normalize_meta(meta)` with `meta = NoteMetadata(**meta).model_dump()` at the following call sites:

| File | Line(s) |
|------|---------|
| `backend/main.py` | search (`222`), get_note (`281`), update_note (`347`, `398`), graph (`527`, `546`, `692`), get_similar (`301`, `453`) |
| `backend/mcp_server.py` | tools returning notes (`99`, `191`) and similar results (`78`, `122`, `234`) |
| `backend/utils.py` | `normalize_and_dedup_results` currently calls `_normalize_meta` directly; replace that call |

Once all call sites are migrated, delete `_normalize_meta` and its imports from `main.py`, `mcp_server.py`, and `utils.py`.

ChromaDB serialization path (unchanged):
```
ingest → metadata dict with lists → _serialize_metadata() → comma-joined strings → ChromaDB
```

ChromaDB deserialization path (improved):
```
Current: ChromaDB → raw dicts with strings → _normalize_meta (mutation hack) → dicts with lists
New:     ChromaDB → raw dicts with strings → NoteMetadata(**raw) (validator coerces) → model dict
```

Test impact:

| File | Risk |
|------|------|
| `backend/tests/test_calendar.py` | Low – Phase A covers this |
| `backend/tests/test_api.py` | Low – keep `model_dump()` to preserve dict output |
| `backend/tests/test_mcp_server.py` | Low – same pattern |
| `backend/tests/test_store.py` | Low – `_format_results` metadata kept as dict for now |

---

#### Phase C – FastAPI Response Models (optional, higher value)

Define response schemas for every API endpoint and annotate them with `response_model`.

```python
class SearchResultItem(BaseModel):
    id: str
    title: str
    snippet: str
    metadata: NoteMetadata
    score: float
    type: str

class SearchResponse(BaseModel):
    results: list[SearchResultItem]

class NoteDetailResponse(BaseModel):
    id: str
    metadata: NoteMetadata
    content: str
    calendar_events: list[CalendarEvent]
    similar_notes: list[dict]  # upgrade later to NoteReference

class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent]

class CalendarEventDetailResponse(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    location: str
    attendees: list[str]
    description: str
    linked_notes: list[dict]
```

Benefits:
- Automatic OpenAPI schema generation with correct types.
- Request/response validation at the HTTP boundary.
- IDE autocomplete on response data in tests.

Risks:
- `NoteMetadata` in response models means every endpoint using it must return the model directly (not a wrapped dict). This cascades through all handler code.
- Frontend tests may fail if property names shift or lists vs strings differ.

Recommended approach:
1. Add `response_model` to **read-only** endpoints first: `/api/notes/{id}`, `/api/tags`, `/api/calendar`, `/api/timeline`, `/api/search`.
2. Skip write endpoints (`PATCH /api/notes/{id}`, `POST /api/ingest`) until read-only is stable.
3. Keep `NoteMetadata.model_dump_json()` in ChromaDB storage path separate from response path.

---

**Checklist**
- [ ] **Phase A:** Create `backend/models.py` with `CalendarEvent`.
- [ ] Update `CalendarProcessor.process_events()` to return `list[CalendarEvent]`.
- [ ] Update all calendar event callers (main.py, ingest.py, mcp_server.py).
- [ ] Update `backend/tests/test_calendar.py`.
- [ ] Run backend tests.
- [ ] Run full test suite.
- [ ] Commit.
- [ ] **Phase B:** Add `NoteMetadata` to `backend/models.py`.
- [ ] Replace `_normalize_meta(meta)` with `NoteMetadata(**meta).model_dump()` at every call site.
- [ ] Update `store.py` `_format_results` to apply `NoteMetadata` coercion.
- [ ] Update `backend/tests/test_api.py`, `test_mcp_server.py`, `test_store.py` as needed.
- [ ] Delete `_normalize_meta` from `utils.py` and remove imports from `main.py`, `mcp_server.py`.
- [ ] Run backend tests.
- [ ] Run full test suite.
- [ ] Commit.
- [ ] **Phase C** (optional): Define `SearchResultItem`, `NoteDetailResponse`, `CalendarEventsResponse`, `CalendarEventDetailResponse` in `backend/models.py`.
- [ ] Add `response_model=...` to read-only FastAPI endpoints one by one.
- [ ] Verify frontend E2E tests still pass.
- [ ] Commit.

---

### 5. Manual NumPy Similarity Matrix → `scikit-learn`

**Current:** `backend/main.py` (`/api/graph`, lines 564–591)  
**Library:** `scikit-learn` (`sklearn.metrics.pairwise.cosine_similarity`)  
**Files:** `backend/main.py`.

**What it's doing now**
```python
emb_array = np.array([e for e in embeddings if e is not None])
norms = np.linalg.norm(emb_array, axis=1, keepdims=True)
norma[norms == 0] = 1
emb_normed = emb_array / norms
sim_matrix = emb_normed @ emb_normed.T
```

**Why replace**
- `cosine_similarity` from `scikit-learn` is a single well-tested call that handles edge cases (zero vectors, dtypes) and is more readable.
- Drop-in replacement; no algorithmic change.

**Planned refactor**
```python
from sklearn.metrics.pairwise import cosine_similarity

# replace lines 564-572
sim_matrix = cosine_similarity(emb_array)
```

**Checklist**
- [x] Add `scikit-learn` to `backend/requirements.txt`.
- [x] Replace manual L2 normalization + dot product with `cosine_similarity`.
- [x] Verify graph output is unchanged on a known dataset.
- [x] Run backend tests.
- [x] Run full test suite.
- [x] Commit.

---

### 6. Manual Caches & JSON State File → `cachetools` + `filelock`

**Current:** `backend/calendar_data.py` (plain dict caches), `backend/main.py` (`_source_id_to_file` dict), `backend/watcher.py` & `ingest.py` (`.ingest_state.json`)  
**Libraries:** `cachetools`, `filelock`  
**Files:** `backend/calendar_data.py`, `backend/main.py`, `backend/watcher.py`, `backend/ingest.py`.

**What it's doing now**
- `_cached_events`, `_events_by_date`, `_events_by_participant` are plain dicts with no TTL or size limit.
- `_source_id_to_file` is a module-level dict that grows unbounded.
- `.ingest_state.json` is read/written by both the CLI (`ingest.py`) and the filesystem watcher (`watcher.py`) with zero file locking — race conditions are possible.

**Why replace**
- `cachetools.TTLCache` provides thread-safe eviction by time or by count.
- `filelock` ensures the state file is never corrupted by concurrent writes from the watcher and the CLI.

**Planned refactor**
```python
from cachetools import TTLCache
from filelock import FileLock

# calendar_data.py
self._event_cache = TTLCache(maxsize=1, ttl=300)  # events rarely change
# Instead of plain dicts, cache the full processed list.

# watcher.py / ingest.py
STATE_LOCK = REPO_ROOT / ".ingest_state.json.lock"
with FileLock(str(STATE_LOCK), timeout=10):
    state_file.write_text(...)
```

**Checklist**
- [x] Add `cachetools` and `filelock` to `requirements.txt`.
- [x] Replace calendar dict caches with `TTLCache`.
- [x] Add `FileLock` around all `.ingest_state.json` read/write paths.
- [x] Run backend tests.
- [x] Run full test suite.
- [x] Commit.

---

### 7. CLI Entry Points → `typer`

**Current:** `scripts/sync_notes.py`, `scripts/caption_images.py`, `backend/ingest.py` (all `argparse`)  
**Library:** `typer`  
**Files:** `scripts/sync_notes.py`, `scripts/caption_images.py`, `backend/ingest.py`.

**What it's doing now**
- Manual `argparse.ArgumentParser` setup with help strings and `type=int`/`type=float` validation.
- `if __name__ == "__main__"` blocks.

**Why replace**
- `typer` auto-generates help, validation, and shell completion from type-hinted function signatures.
- Much more readable, less boilerplate.

**Planned refactor**
```python
import typer

app = typer.Typer()

@app.command()
def main(
    notes_dir: str = typer.Option(os.path.join(os.path.dirname(__file__), "..", "notes"), "--notes-dir"),
    force: bool = typer.Option(False, "--force"),
    calendar_only: bool = typer.Option(False, "--calendar-only"),
):
    ...
```
- Same pattern for `sync_notes.py` and `caption_images.py`.

**Checklist**
- [x] Add `typer` to `requirements.txt`.
- [x] Convert each CLI entry point to `typer` command.
- [x] Update `AGENTS.md` CLI examples.
- [x] Run each script with `--help` to verify output.
- [x] Run full test suite.
- [x] Commit.

---

## Frontend (TypeScript / React)

---

### 8. Data Fetching → `@tanstack/react-query`

**Status:** ✅ **Already installed and mostly applied.**

`frontend/src/lib/queries.ts` wraps all API calls with query keys. Migrated pages:
- ✅ `dashboard/page.tsx` — cleaned up (search removed), uses `useQuery` for stats/tags
- ✅ `browse/page.tsx` — uses `useQuery` for notes list and schema
- ✅ `search/page.tsx` — **recently migrated search results from manual `useState` to `useMutation`**; autocomplete still local state
- ✅ `notes/[id]/page.tsx` — uses `useQuery` for note detail, tags, people; `useMutation` for updates
- ✅ `graph/page.tsx` — uses `useQuery` for graph data and tags
- ✅ `tags/page.tsx`, `tags/[tag]/page.tsx` — uses `useQuery`
- ✅ `timeline/page.tsx` — uses `useQuery`
- ✅ `calendar/page.tsx`, `calendar/[date]/page.tsx` — uses `useQuery`

**No longer using raw `useEffect` fetch anywhere.** `lib/hooks.ts` never had `useAsyncData`; it only has `useDebouncedValue`, `useDebouncedCallback`, and `useLocalStorage`, all of which are still used.

**Checklist**
- [x] All pages migrated to `useQuery` / `useMutation`.
- [x] Run frontend tests.
- [x] Run E2E mock suite.
- [x] Run full test suite.
- [x] Commit.

---

### 9. Date Math & Calendar Grid → `date-fns`

**Status:** ✅ **Completed.**

**Libraries:** `date-fns` + `react-day-picker` installed.  
**Note:** Kept custom calendar grid instead of migrating to `react-day-picker` — the custom grid is fine, and `react-day-picker` would require a custom day renderer to preserve our event badges and `data-testid` attributes. May revisit later if we need keyboard nav/accessibility on the calendar grid.

**What was done**
- ✅ Created `frontend/src/lib/dates.ts` — centralized date utilities (not re-exporting any named exports that conflict with React hooks).
- ✅ `DateRangePicker.tsx`: All presets (`Last 30 days`, `Last 90 days`, etc.) now use correct `date-fns` math (e.g., `subDays(now, 30)`, `subMonths(now, 6)`), fixing month-boundary bugs.
- ✅ `calendar/page.tsx`: Replaced custom `getDaysInMonth` with `getMonthDays` from `lib/dates.ts`, using `date-fns` `eachDayOfInterval`, `startOfMonth`, `endOfMonth`, `getDay`.
- ✅ `CalendarHeatmap.tsx`: Replaced all `toISOString().slice(0, 10)` string-slicing with `toISODate()` utility, replaced manual week math with `date-fns` `differenceInCalendarWeeks`, used `setYear` (aliased to avoid hook name conflict), `startOfYear`, `endOfYear`, `eachDayOfInterval`, `getDay`. Tooltip `toLocaleDateString` replaced with `format(parseISO(date), 'EEE, MMM d')`.
- ✅ `calendar/[date]/page.tsx`: Replaced manual `new Date(year, month - 1, day)` parsing with `parseISO` + `format`. Time formatting with `toLocaleTimeString` replaced with `format(d, 'h:mm a')`.
- ✅ `timeline/page.tsx`: Replaced `toLocaleDateString('en-US', { month: 'short', year: '2-digit' })` with `format(parseISO(period), "MMM ''yy")`.
- ✅ `NoteResult.tsx`: Replaced `toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })` with `format(parseISO(created), 'MMMM d, yyyy')`.
- ✅ `graph/page.tsx`: Replaced `toLocaleDateString()` with `format(parseISO(created), 'MMM d, yyyy')`.

**Checklist**
- [x] Install `date-fns` + `react-day-picker`.
- [x] Refactor `DateRangePicker.tsx` presets with `date-fns`.
- [x] Replace inline `toLocaleDateString` calls with `date-fns`.
- [x] Refactor `CalendarHeatmap.tsx` with `date-fns`.
- [x] Migrate `calendar/page.tsx` grid math to `date-fns`.
- [x] Run frontend tests. (21 passed)
- [x] Run E2E mock suite. (105 passed)
- [x] Run full test suite. (backend: 173 passed)
- [x] Commit.

---

### 10. Combobox / Autocomplete → `downshift`

**Status:** ✅ **Completed.**

**What was done**
- Installed `downshift` and migrated all three combobox components to `useCombobox`.
- `SearchAutocomplete.tsx`: single-select with semantic search fallback on Enter (no selection).
- `TagInput.tsx`: multi-select tag input with structural tag display, max 8 limit, Backspace-to-remove last pill.
- `PersonInput.tsx`: multi-select participant input with alias matching, context display, max 10 limit.
- Preserved all E2E selectors (`data-search-input`, `data-testid="tag-add-input"`, `data-testid="person-add-input"`).
- Each component uses `useCombobox` for ARIA keyboard nav, dropdown open/close, and highlighted index.

**Checklist**
- [x] Install `downshift`.
- [x] Refactor `SearchAutocomplete.tsx`.
- [x] Refactor `TagInput.tsx`.
- [x] Refactor `PersonInput.tsx`.
- [x] Run frontend tests (21 passed).
- [x] Run E2E mock suite (105 passed).
- [x] Run full test suite (backend 173 passed).
- [x] Commit.

---

### 11. Inline SVG Icons → `lucide-react`

**Status:** ✅ **Completed.**

Replaced ~100 inline SVG blocks across 12 components. `Nav.tsx`, `DateRangePicker.tsx`, `ImageGallery.tsx`, `TagInput.tsx`, `PersonInput.tsx`, `SearchAutocomplete.tsx`, `EditableTitle.tsx`, `FavoriteButton.tsx`, `ErrorBoundary.tsx`, `StatCard.tsx`, `Button.tsx`, and `Input.tsx` (select arrow) now use `lucide-react`.

**Checklist**
- [x] Install `lucide-react`.
- [x] Replace all inline SVGs in `Nav.tsx`, `Skeleton.tsx`, and page components.
- [x] Run frontend tests.
- [x] Run E2E mock suite.
- [x] Run full test suite.
- [x] Commit.

---

### 12. Debounce Hooks → `use-debounce`

**Status:** ✅ **Completed.**

`lib/hooks.ts` now wraps `useDebounce` / `useDebouncedCallback` from `use-debounce` (re-exported for backward compatibility). Call sites (`SearchAutocomplete.tsx`, `browse/page.tsx`) use the library implementations.

**Checklist**
- [x] Install `use-debounce`.
- [x] Replace `useDebouncedValue` + `useDebouncedCallback` in `lib/hooks.ts`.
- [x] Run frontend tests.
- [x] Run full test suite.
- [x] Commit.

---

### 13. UI Variant Management → `tailwind-variants`

**Status:** ✅ **Completed.**

`Button.tsx` and `Badge.tsx` migrated from manual variant string objects to `tv({ base, variants, defaultVariants })` from `tailwind-variants`. `Input.tsx` select arrow replaced with `ChevronDown` from `lucide-react`.

**Checklist**
- [x] Install `tailwind-variants`.
- [x] Refactor `Button.tsx`.
- [x] Refactor `Badge.tsx`.
- [x] Refactor `Input.tsx` (select arrow).
- [x] Run frontend tests.
- [x] Run full test suite.
- [x] Commit.

---

## Recent Changes (Session Notes)

### Extracted `NoteResult` component (frontend/src/components/NoteResult.tsx)
- Shared note card rendering across **Browse** and **Search** (both note + calendar results).
- Properties: badges (source/folder/handwritten), title with highlight, date, snippet, tags (filtered), score.
- Supports `type='calendar'` with purple "Calendar" badge and `date` prop for event dates.
- Used with `href` (rendered as `Link`) or without (rendered as plain content, useful when parent `Card` has its own click handler).

### Removed dashboard search
- Deleted `SearchAutocomplete`, Quick Results, and all search state from `frontend/src/app/page.tsx`.
- Dashboard is now a pure overview page: hero, stats, charts, navigation buttons.
- Updated `e2e/dashboard.spec.ts` — removed 2 search-related tests, 6 tests remain passing.
- Removed imports: `searchApi`, `SearchResult`, `SectionHeader`, `SkeletonChart`, `useState` (except `ingestResult`), `SearchAutocomplete`.

### Bug fixes alongside extraction
- Fixed duplicate React keys in dashboard search results: `${r.id}-${r.type}-${i}`.
- Fixed autocomplete dropdown rendering underneath stat cards: added `z-10` to hero wrapper.
- Filtered `type === 'calendar'` out of autocomplete `noteTitles` on dashboard and search to prevent broken `/notes/cal_...` 404 links.
- Removed `overflow: hidden` from `.card` / `.card-hover` in globals.css to fix dropdown clipping.

### All tests green
- 105 E2E (mock) passing
- 21 frontend unit tests passing
- 173 backend tests passing

### Phase 3 completed (lucide-react, use-debounce, tailwind-variants)
- Replaced ~100 inline SVG blocks with `lucide-react` icons across Nav, DateRangePicker, ImageGallery, TagInput, PersonInput, SearchAutocomplete, EditableTitle, FavoriteButton, ErrorBoundary, StatCard, Button, and Input components.
- Migrated `Button.tsx` and `Badge.tsx` from manual variant string objects to type-safe `tv()` from `tailwind-variants`.
- Replaced `useDebouncedValue` and `useDebouncedCallback` in `lib/hooks.ts` with `use-debounce` library exports.
- Added missing `tailwind-merge` dependency (required by `tailwind-variants`).
- All 105 E2E + 21 unit + 173 backend tests pass.

---

## Summary & Prioritized Roadmap

| Phase | Items | Est. Impact | Est. Effort |
|-------|-------|-------------|-------------|
| **Phase 1** (Foundation) | 1. `pydantic-settings`, 2. `langchain-text-splitters`, 3. `tenacity`, 4. `pydantic` models | ✅ **Complete** | Medium |
| **Phase 2** (Frontend Core) | 8. `@tanstack/react-query`, 9. `date-fns` + `react-day-picker` | ✅ **Complete** | High |
| **Phase 3** (Polish) | 11. `lucide-react`, 12. `use-debounce`, 13. `tailwind-variants` | ✅ **Complete** | Medium |
| **Phase 4** (Backend Utilities) | 5. `scikit-learn`, 6. `cachetools` + `filelock`, 7. `typer` | ✅ **Complete** | Low |
| **Phase 5** (Frontend Advanced) | 10. `downshift` comboboxes | ✅ **Complete** | High |

---

## Cross-Cutting Concerns

### Testing Strategy
- **Every PR must run the full suite**: backend pytest → frontend vitest → E2E mock.
- `AGENTS.md` explicitly says: *Green means green. Period.* This applies to every item in this plan.
- Refactoring to third-party libs can be done incrementally — each item above can be its own PR.

### Documentation Updates
- After each backend change, update `AGENTS.md` CLI examples if commands change.
- After each frontend change, update the `data-testid` table if component structure changes.

### Dependency Discipline
- Before adding any library, verify:
  1. It is actively maintained (last commit < 6 months, open issues manageable).
  2. It supports the current runtime (Python 3.11+, Node 18+, Next.js 16, React 19).
  3. Its license is permissive (MIT, BSD, Apache-2.0).

---

*End of DRY_PLAN.md*

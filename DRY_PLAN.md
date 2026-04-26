# DRY Plan: Replacing Custom Code with Third-Party Libraries

> **Project:** notes-browser  
> **Scope:** Both FastAPI backend and Next.js 16 frontend  
> **Goal:** Replace fragile or duplicated custom code with well-maintained, production-grade libraries.  
> **Status:** This is a planning document — implementation is tracked below.

---

## Backend (Python)

---

### 1. Configuration → `pydantic-settings`

**Current:** `backend/config_env.py` (~75 lines)  
**Library:** `pydantic-settings` (add to `requirements.txt`)  
**Files:** Replace `config_env.py` entirely; update all `from config_env import X` imports.

**What it's doing now**
- Auto-creates a `.env` file with defaults if missing.
- Loads via `python-dotenv` or falls back to `os.getenv`.
- Manually expands `~` via `os.path.expanduser`.
- Exports module-level constants (`CALENDAR_EXPORT_PATH`, `PEOPLE_REGISTRY_PATH`, etc.).

**Why replace**
- `pydantic-settings` auto-loads `.env`, validates types, handles defaults, and supports custom parsers (for `~` expansion) through `field_validator`.
- Eliminates hand-written env parsing and the brittle auto-write fallback.

**Planned refactor**
```python
# backend/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    calendar_export_path: str = "~/Downloads/calendar-export.json"
    people_registry_path: str = "~/Desktop/notes/people_registry.json"
    notes_source: str = "~/Desktop/notes/Apple Notes"

    @field_validator('calendar_export_path', 'people_registry_path', 'notes_source', mode='before')
    @classmethod
    def expand_user(cls, v: str) -> str:
        return Path(v).expanduser().as_posix()

    repo_root: Path = Path(__file__).resolve().parent.parent

    @property
    def notes_dir(self) -> str: return str(self.repo_root / "notes")
    # ... other derived paths

settings = Settings()
```
- Create `backend/config.py` with the class above.
- Replace all `from config_env import X` with `from config import settings`.
- Delete `backend/config_env.py`.

**Checklist**
- [ ] Add `pydantic-settings>=2.0` to `backend/requirements.txt`.
- [ ] Write `backend/config.py`.
- [ ] Search-and-replace all imports across backend files.
- [ ] Delete `backend/config_env.py`.
- [ ] Run backend tests (`backend/.venv/bin/pytest backend/`).
- [ ] Run full test suite.
- [ ] Commit.

---

### 2. Text Chunking → `langchain-text-splitters`

**Current:** `backend/ingest.py` (`chunk_text`, lines 15–23)  
**Library:** `langchain-text-splitters` (standalone, no full LangChain needed)  
**Files:** `backend/ingest.py`; possibly `backend/constants.py` for new chunk params.

**What it's doing now**
- Naively slices text at exactly 2000 characters with 400-character overlap via `text[start:start+chunk_size]`.
- Can split mid-sentence, mid-word, or inside markdown headers/lists, degrading embedding and retrieval quality.

**Why replace**
- `RecursiveCharacterTextSplitter` respects semantic boundaries (paragraph breaks → sentence breaks → words).
- `MarkdownTextSplitter` is even better for markdown notes, respecting headers.
- Directly improves the core search/embedding quality of the product.

**Planned refactor**
```python
from langchain_text_splitters import MarkdownTextSplitter

def build_note_chunks(...):
    # ... tier1 setup ...
    remainder = body[1600:]
    if remainder.strip():
        splitter = MarkdownTextSplitter(
            chunk_size=2000,
            chunk_overlap=400,
            length_function=len,
        )
        body_chunks = splitter.split_text(remainder)
        for i, chunk in enumerate(body_chunks):
            # ... build metadata as before ...
```
- Import `MarkdownTextSplitter` from `langchain_text_splitters` (the standalone package).
- Remove the old `chunk_text()` helper entirely.
- Note: `MarkdownTextSplitter` chunks by headers if possible, then by other markdown boundaries.
- Ensure chunk IDs are still deterministic and stable. The splitting logic changes, so full re-ingest (`--force`) is required after deployment.

**Checklist**
- [ ] Install `langchain-text-splitters` in the venv: `backend/.venv/bin/pip install langchain-text-splitters`.
- [ ] Add to `requirements.txt`.
- [ ] Replace `chunk_text()` calls in `ingest.py`; delete `chunk_text()`.
- [ ] Update `make_doc_id` / indexing logic if chunk count changes.
- [ ] Run a forced re-ingest locally to verify embedding counts change as expected.
- [ ] Run backend tests.
- [ ] Run full test suite.
- [ ] Commit.

---

### 3. Ad-hoc Retry Logic → `tenacity`

**Current:** `backend/embed.py` (lines 27–48) and `scripts/caption_images.py` (no retry on its `httpx.post`)  
**Library:** `tenacity`  
**Files:** `backend/embed.py`, `scripts/caption_images.py`.

**What it's doing now**
- `for attempt in range(2)` with a manual `if attempt == 1: raise`.
- No backoff, no jitter, no exception filtering.
- On a failed batch, recursively bisects into smaller batches inline.
- `caption_images.py` has zero retry logic on its Ollama `httpx.post` call.

**Why replace**
- `tenacity` provides declarative, robust retry with exponential backoff, wait jitter, and fine-grained exception filtering.
- Makes transient Ollama failures much more forgiving.
- Reduces brittle nesting.

**Planned refactor**
```python
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
def _embed_batch(client, full_batch: list[str]) -> list[list[float]]:
    resp = client.post(f"{OLLAMA_BASE_URL}/api/embed", json={...})
    resp.raise_for_status()
    return [_l2_normalize(emb[:EMBED_DIM]) for emb in resp.json()["embeddings"]]

def embed_texts_sync(texts, prefix="search_document"):
    ...
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        full_batch = [f"{prefix}: {t}" for t in batch]
        try:
            results.extend(_embed_batch(client, full_batch))
        except Exception:
            # fallback to recursive smaller batch split
            mid = (len(batch) + 1) // 2
            results.extend(embed_texts_sync(batch[:mid], prefix))
            results.extend(embed_texts_sync(batch[mid:], prefix))
```
- Keep the recursive batch-split fallback (it is a valid resilience strategy for payload-too-large), but wrap the actual API call in `tenacity`.
- Add identical `retry` to the `httpx.post` in `caption_images.py`.

**Checklist**
- [ ] Add `tenacity` to `backend/requirements.txt`.
- [ ] Refactor `embed_texts_sync` in `backend/embed.py`.
- [ ] Add `tenacity` retry decorator to `caption_images.py` `httpx.post`.
- [ ] Run backend tests.
- [ ] Run full test suite.
- [ ] Commit.

---

### 4. Raw Dicts / String-sliced Dates → `pydantic` models

**Current:** `backend/calendar_data.py`, `backend/main.py` (calendar endpoints), `backend/store.py` (metadata)  
**Library:** `pydantic` (already in `requirements.txt`, underutilized)  
**Files:** `backend/models.py` (new), `backend/calendar_data.py`, `backend/main.py`, `backend/store.py`, `backend/utils.py`, `backend/mcp_server.py`, `backend/ingest.py`.

**What it's doing now**
- Calendar events are plain `dict`s built by manual string concatenation (`start_dt[:10]`).
- The `/api/calendar` endpoint accepts `Optional[str]` dates with zero format validation.
- ChromaDB metadata is serialized manually in `_serialize_metadata`.
- `_normalize_meta` mutates a dict in place to convert comma-separated strings back to lists.

**Why replace**
- Pydantic validators enforce `YYYY-MM-DD` format, coerce lists automatically, and make the data contract explicit.
- Eliminates the `_normalize_meta` mutation hack if metadata is modeled correctly.

**New file: `backend/models.py`**

```python
from pydantic import BaseModel, field_validator
from datetime import date as date_type

class CalendarEvent(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    location: str = ""
    description: str = ""
    attendees: str = ""          # comma-joined for Chroma constraints
    attendee_names: list[str] = []  # normalized list for Python logic
    event_type: str = "default"
    date: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        if v:
            date_type.fromisoformat(v)  # raises ValueError on bad format
        return v

class NoteMetadata(BaseModel):
    note_id: str
    title: str = ""
    folder: str = ""
    tags: list[str] = []
    participants: list[str] = []
    created: str = ""
    modified: str = ""
    source: str = ""
    source_id: str = ""
    date: str = ""

    @field_validator("tags", "participants", mode="before")
    @classmethod
    def split_csv(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v or []
```

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
- [ ] Add `scikit-learn` to `backend/requirements.txt` (it pulls in `numpy` already).
- [ ] Replace manual L2 normalization + dot product with `cosine_similarity`.
- [ ] Verify graph output is unchanged on a known dataset.
- [ ] Run backend tests.
- [ ] Run full test suite.
- [ ] Commit.

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
- [ ] Add `cachetools` and `filelock` to `requirements.txt`.
- [ ] Replace calendar dict caches with `TTLCache`.
- [ ] Add `FileLock` around all `.ingest_state.json` read/write paths.
- [ ] Run backend tests.
- [ ] Run full test suite.
- [ ] Commit.

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
- [ ] Add `typer` to `requirements.txt`.
- [ ] Convert each CLI entry point to `typer` command.
- [ ] Update `AGENTS.md` CLI examples.
- [ ] Run each script with `--help` to verify output.
- [ ] Run full test suite.
- [ ] Commit.

---

## Frontend (TypeScript / React)

---

### 8. Data Fetching → `@tanstack/react-query`

**Status:** ✅ **Already installed and partially applied.**

`frontend/src/lib/queries.ts` wraps all API calls with query keys. `search/page.tsx`, `browse/page.tsx`, and `browse/page.tsx` use it, but `graph/page.tsx` still uses raw state for graph data, and `notes/[id]/page.tsx` has a mix of legacy fetch logic. `dashboard/page.tsx` was cleaned up: search was removed entirely.

**Checklist**
- [ ] Migrate `graph/page.tsx` to use `useQuery` / `useMutation` for graph data and node updates.
- [ ] Migrate `notes/[id]/page.tsx` fully: sidebar fetch, similar notes fetch.
- [ ] Migrate `timeline/page.tsx` and `calendar/[date]/page.tsx` if still using raw state.
- [ ] Delete `frontend/src/lib/hooks.ts` (`useAsyncData`) entirely.
- [ ] Run frontend tests.
- [ ] Run E2E mock suite.
- [ ] Run full test suite.
- [ ] Commit.

---

### 9. Date Math & Calendar Grid → `date-fns` + `react-day-picker`

**Current:** `frontend/src/app/calendar/page.tsx` (custom `getDaysInMonth`, 55 lines), `components/DateRangePicker.tsx` (preset calculations), `components/CalendarHeatmap.tsx` (week/day math), all inline `toLocaleDateString`  
**Libraries:** `date-fns`, `react-day-picker`  
**Files:** `app/calendar/page.tsx`, `components/DateRangePicker.tsx`, `components/CalendarHeatmap.tsx`, `app/browse/page.tsx`, etc.

**What it's doing now**
- Custom `getDaysInMonth` with manual day-of-week alignment math.
- Date presets: `new Date(y, m, d - 30)` which is wrong for month boundaries.
- `new Date().toISOString().slice(0, 10)` repeated everywhere.
- `new Date(meta.created).toLocaleDateString(...)` inline with no centralized format.

**Why replace**
- `date-fns` is the standard for immutable, locale-aware date manipulation.
- `react-day-picker` replaces the entire custom calendar grid with accessibility, keyboard nav, and range selection built in.

**Planned refactor**
```bash
npm install date-fns react-day-picker
```
- **Calendar page**: Replace custom grid with `<DayPicker>` from `react-day-picker`.
- **DateRangePicker**: Use `date-fns` for correct preset math:
```ts
import { subDays, subMonths, startOfYear, subYears, formatISO } from 'date-fns'
const presets = [
  { label: 'Last 30 days', from: subDays(new Date(), 30), to: new Date() },
  // ...
]
```
- **Browse / Note detail**: Replace inline `toLocaleDateString` with `date-fns/format`.
- **CalendarHeatmap**: Use `date-fns` for week/day math.

**Checklist**
- [ ] Install `date-fns` + `react-day-picker`.
- [ ] Replace `calendar/page.tsx` grid with `react-day-picker`.
- [ ] Refactor `DateRangePicker.tsx` presets with `date-fns`.
- [ ] Replace inline `toLocaleDateString` calls with `date-fns`.
- [ ] Refactor `CalendarHeatmap.tsx` with `date-fns`.
- [ ] Run frontend tests.
- [ ] Run E2E mock suite.
- [ ] Run full test suite.
- [ ] Commit.

---

### 10. Combobox / Autocomplete → `downshift`

**Current:** `components/SearchAutocomplete.tsx` (219 lines), `components/TagInput.tsx` (159 lines), `components/PersonInput.tsx` (159 lines)  
**Library:** `downshift`  
**Files:** The three files above.

**What it's doing now**
- Three components independently re-implement the exact same ARIA combobox pattern:
  - Keyboard navigation (arrows, Enter, Escape)
  - Suggestion filtering / dropdown
  - Click-outside to close
  - Tag / person add/remove interaction

**Why replace**
- `downshift` is the standard primitive for comboboxes. Handles ARIA, focus management, screen-reader announcements, and keyboard nav out of the box.
- Consolidates ~300+ lines of duplicated custom dropdown logic into ~60 lines using `useCombobox`.

**Planned refactor**
```tsx
import { useCombobox } from 'downshift'

const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex, selectedItem } =
  useCombobox({
    items: filteredSuggestions,
    onInputValueChange: ({ inputValue }) => setInput(inputValue || ''),
    onSelectedItemChange: ({ selectedItem }) => addItem(selectedItem),
  })
```
- Extract a shared `<ComboboxInput options={...} onSelect={...} />` wrapper component.
- Replace three custom implementations with the shared wrapper.

**Checklist**
- [ ] Install `downshift`.
- [ ] Build shared `ComboboxInput` wrapper component.
- [ ] Refactor `SearchAutocomplete.tsx`.
- [ ] Refactor `TagInput.tsx`.
- [ ] Refactor `PersonInput.tsx`.
- [ ] Run frontend tests (these components are heavily stateful).
- [ ] Run E2E mock suite.
- [ ] Run full test suite.
- [ ] Commit.

---

### 11. Inline SVG Icons → `lucide-react`

**Current:** `components/Nav.tsx` (7 inline SVGs), `components/ui/Skeleton.tsx`, scattered icons across pages  
**Library:** `lucide-react`  
**Files:** `components/Nav.tsx`, `components/Skeleton.tsx`, and others.

**What it's doing now**
- ~50+ inline SVG `<path>` blocks.
- Inconsistent `strokeWidth` values (2 vs 1.5), size variations.
- Adding a new icon requires copy-pasting SVG path data.
- `components/Skeleton.tsx` defines inline icon SVGs (`DocumentIcon`, `TagIcon`, `CalendarIcon`, `ClockIcon`).

**Why replace**
- `lucide-react` is a consistent, tree-shakeable icon set.
- One line per icon: `<Search className="w-5 h-5" />`.

**Planned refactor**
```bash
npm install lucide-react
```
- Replace every inline SVG with the corresponding `lucide-react` import:
  - `SearchIcon` → `<Search />`
  - `FolderOpen` / `BookOpen` for Browse
  - `Tag` for Tags
  - `BarChart3` for Timeline
  - `Calendar` for Calendar
  - `Network` for Graph
  - `Document` for notes
  - `Clock` for date range

**Checklist**
- [ ] Install `lucide-react`.
- [ ] Replace all inline SVGs in `Nav.tsx`, `Skeleton.tsx`, and page components.
- [ ] Run frontend tests.
- [ ] Run E2E mock suite.
- [ ] Run full test suite.
- [ ] Commit.

---

### 12. Debounce Hooks → `use-debounce`

**Current:** `frontend/src/lib/hooks.ts` (`useDebouncedValue`, `useDebouncedCallback`, ~38 lines)  
**Library:** `use-debounce`  
**Files:** `lib/hooks.ts`.

**What it's doing now**
- Basic `setTimeout` / `clearTimeout` wrapping.
- No leading/trailing edge options.
- Manual `useRef` for callback stability.

**Why replace**
- `use-debounce` is 1 KB, purpose-built for React.
- Supports `leading`, `trailing`, `maxWait`, and cancellation out of the box.

**Planned refactor**
```bash
npm install use-debounce
```
```tsx
import { useDebounce, useDebouncedCallback } from 'use-debounce'

// replaces useDebouncedValue
const debouncedQuery = useDebounce(query, 300)

// replaces useDebouncedCallback
const debouncedSearch = useDebouncedCallback((q) => doSearch(q), 300)
```

**Checklist**
- [ ] Install `use-debounce`.
- [ ] Replace `useDebouncedValue` + `useDebouncedCallback` in `lib/hooks.ts`.
- [ ] Run frontend tests.
- [ ] Run full test suite.
- [ ] Commit.

---

### 13. UI Variant Management → `tailwind-variants`

**Current:** `components/ui/Button.tsx`, `components/ui/Badge.tsx`, `components/ui/Input.tsx`  
**Library:** `tailwind-variants` (recommended by Tailwind v4) or `class-variance-authority` (CVA)  
**Files:** `components/ui/Button.tsx`, `Badge.tsx`, `Input.tsx`.

**What it's doing now**
- Manual objects mapping variant names to Tailwind class strings:
```tsx
const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600',
  ...
}
```
- Brittle string concatenation with template literals.

**Why replace**
- `tailwind-variants` / CVA are the standard way to manage Tailwind component variants.
- Type-safe variant props, compound variants, and default variants.
- Cleaner and less error-prone than raw string objects.

**Planned refactor**
```tsx
import { tv } from 'tailwind-variants'

const button = tv({
  base: 'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
  variants: {
    variant: {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600',
      ghost: 'bg-transparent text-zinc-400 hover:bg-zinc-800',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    },
    size: {
      sm: 'px-2 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    },
  },
  defaultVariants: { variant: 'secondary', size: 'md' },
})

// Usage
<button className={button({ variant: 'primary', size: 'lg' })} />
```

**Checklist**
- [ ] Install `tailwind-variants`.
- [ ] Refactor `Button.tsx`.
- [ ] Refactor `Badge.tsx`.
- [ ] Refactor `Input.tsx` (select/input variants).
- [ ] Run frontend tests.
- [ ] Run full test suite.
- [ ] Commit.

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

---

## Summary & Prioritized Roadmap

| Phase | Items | Est. Impact | Est. Effort |
|-------|-------|-------------|-------------|
| **Phase 1** (Foundation) | 1. `pydantic-settings`, 2. `langchain-text-splitters`, 3. `tenacity`, 4. `pydantic` models | 🔴 High | Medium |
| **Phase 2** (Frontend Core) | 8. Finish `@tanstack/react-query` migration (graph, notes/[id], timeline), 9. `date-fns` + `react-day-picker` | 🔴 High | High |
| **Phase 3** (Polish) | 10. `downshift`, 11. `lucide-react`, 12. `use-debounce`, 13. `tailwind-variants` | 🟡 Medium | Medium |
| **Phase 4** (Backend Utilities) | 5. `scikit-learn`, 6. `cachetools` + `filelock`, 7. `typer` | 🟢 Quick | Low |

**Current recommendation:** Phase 2A — finish migrating remaining pages to `@tanstack/react-query`, then move to `date-fns` + `react-day-picker`.

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

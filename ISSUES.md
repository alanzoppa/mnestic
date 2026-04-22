# Notes Browser — Known Issues & Improvement Plan

## How this doc works

- Each issue is numbered and organized by **priority phase**
- Phases should generally be tackled in order
- Each entry links to the relevant file/line and describes the fix
- Items in the **Changelog** at the bottom of AGENTS.md should be updated when items here are resolved

## Phase 1: Security & Functional Bugs

### [x] 1. Path Traversal in `find_note_file`
- **Files:** `backend/main.py:78-82`, `backend/mcp_server.py:45-54`
- **Severity:** Critical
- **Problem:** `os.path.join(NOTES_DIR, source_id + ext)` accepts any string including `../` sequences. An attacker with API access can read files outside `notes/`.
- **Fix:** Sanitize both `source_id` and `note_id` before joining — reject any string containing `..`, `/`, or `\`. Consider using `pathlib.Path.resolve()` and verifying the result is under `NOTES_DIR`.

### [x] 2. Graph endpoint returns empty node metadata
- **File:** `backend/main.py:607-621`
- **Severity:** High
- **Problem:** `all_meta` dict is keyed by **chunk IDs** (e.g. `note123_chunk_0`), but `connected` set contains **logical note_ids** (e.g. `meeting-20251104...`). Every lookup `all_meta.get(nid, {})` returns `{}`, so graph nodes have empty `title`, `folder`, `tags`, and `source` in the response.
- **Fix:** Build `nid_to_meta` mapping keyed by `note_id` from the metadata entries instead of `mid` (chunk ID).

### [x] 3. Calendar crashes on missing files
- **File:** `backend/calendar_data.py:25-45`, `backend/main.py:31-37`
- **Severity:** High
- **Problem:** `CalendarProcessor.load()` opens both `calendar-export.json` and `people_registry.json` without existence checks. `main.py`'s `get_calendar()` catches nothing. Any missing file causes a 500 on first calendar access. Also, the global `calendar_processor` instance is created before `load()` succeeds, leaving it in a partially broken state on failure.
- **Fix:** Wrap file opens in `try/except (FileNotFoundError, json.JSONDecodeError)` and gracefully degrade to empty events/registry. Make `get_calendar()` handle initialization failure gracefully.

### [x] 4. Full metadata scan on calendar endpoints
- **File:** `backend/main.py:670-724`
- **Severity:** High
- **Problem:** `get_calendar_event` and `get_calendar_by_date` fetch **all note metadatas** from ChromaDB (`store._notes.get(include=["metadatas"])`) just to correlate a few notes by date. For 2260 notes, this is a massive unnecessary DB round-trip made on every calendar request.
- **Fix:** Added `date` field to note metadata during ingestion and query `where={"date": date}` in calendar endpoints. ChromaDB filters server-side.

### [x] 5. `get_notes_by_tag` does full collection scan
- **File:** `backend/store.py:74-112`
- **Severity:** High
- **Problem:** Loads the entire notes collection with `self._notes.get(include=["metadatas", "documents"])`, then filters in Python. With 2260 notes this is wasteful. Also reimplements `$and`, `$eq`, `$gte`, `$lte` semantics manually in Python instead of using ChromaDB's native `where` filters.
- **Fix:** Changed to `self._notes.get(where=where, include=["metadatas"])` — passes `where` to ChromaDB, avoids loading `documents`.

## Phase 2: Frontend Stability

### 6. Hydration mismatch in Timeline skeleton
- **File:** `frontend/src/app/timeline/page.tsx:168-175`
- **Severity:** Critical
- **Problem:** Inline styles use `Math.random()` for skeleton bar heights. AGENTS.md already documents this as causing infinite re-mount loops. Same issue may exist in other pages.
- **Fix:** Replace with deterministic height array (like `CHART_BAR_HEIGHTS` in `Skeleton.tsx`).

### 7. Race conditions across async effects
- **Files:** `frontend/src/app/notes/[id]/page.tsx`, `search/page.tsx`, `graph/page.tsx`, `calendar/page.tsx`
- **Severity:** High
- **Problem:** Async `useEffect` hooks call `setData()` and `setLoading(false)` without cleanup guards. Rapid navigation away from a page causes state updates on unmounted components. Most effects also lack `try/finally`, so `setLoading(false)` is never reached on error.
- **Fix:** Add `AbortController` or boolean cancelled guard in every async effect. Wrap all API calls in `try/finally` to ensure loading state resets. For search, prevent stale results by tracking a request counter or aborting previous fetch.

### 8. `AreaChartComponent` renders `<LineChart>`
- **File:** `frontend/src/components/charts/LineCharts.tsx:98-160`
- **Severity:** High
- **Problem:** Component is named `AreaChartComponent` but uses `<LineChart>` and `<Line>`. The `fill` prop on `<Line>` does not render a filled area.
- **Fix:** Replace with `<AreaChart>` and `<Area>`.

## Phase 3: Performance

### 9. Duplicate embedding computation in search
- **File:** `backend/main.py:161-192`
- **Severity:** Medium
- **Problem:** When `body.query.strip()` and `body.include_calendar` are both true, `embed_query_sync(body.query)` is called twice — once for notes search, once for calendar subset search. Each call hits Ollama's embedding API.
- **Fix:** Compute the embedding once at the top of the function and reuse it.

### 10. Unbounded `n_results` multiplication
- **File:** `backend/main.py:162-163`
- **Severity:** Medium
- **Problem:** `note_results = store.search_notes(note_embedding, n=body.n * 5)` with no upper bound. If client sends `n=1000`, server fetches 5000 results into memory.
- **Fix:** Cap `n_results` to a reasonable maximum (e.g. `min(n * 5, 200)`).

### 11. Calendar rebuilds on every request
- **Files:** `backend/main.py:641-724`, `backend/calendar_data.py:56-94`
- **Severity:** Medium
- **Problem:** Every calendar endpoint call triggers `cal.process_events()` which re-normalizes all 2324 events into a list with no caching. Also `main.py` redundantly calls `get_calendar()` which returns a processor but does not cache its processed output.
- **Fix:** Cache processed events inside `CalendarProcessor` after first `process_events()` call; invalidate cache in `load()`.

### 12. O(n×m) event filtering in calendar render
- **File:** `frontend/src/app/calendar/page.tsx:71-82`
- **Severity:** Medium
- **Problem:** `getEventsForDay(day)` re-filters all 2324 events for every day cell on every render. With 31–42 cells this is ~80K string comparisons per render.
- **Fix:** Pre-index events by date into a `Map<string, CalendarEvent[]>` via `useMemo` keyed on `[events, attendeeFilter]`.

### 13. Tag cloud redundant max scans
- **File:** `frontend/src/app/tags/page.tsx:255-264`
- **Severity:** Medium
- **Problem:** `Math.max(...tags.map(t => t.count))` is computed inside `.map()`, so for 60 tags it does 60 full-array scans.
- **Fix:** Precompute `maxCount` once before rendering.

### 14. `get_similar` double DB round-trip
- **File:** `backend/store.py:209-217`
- **Severity:** Medium
- **Problem:** Calls `self.get_note(note_id)` to validate existence, then `self._notes.get(ids=[note_id], include=["embeddings"])` to fetch embeddings. Two sequential DB calls.
- **Fix:** Single `self._notes.get(ids=[note_id], include=["metadatas", "embeddings"])` call.

## Phase 4: Refactoring & DRY

### 15. `_normalize_meta` duplicated between files
- **Files:** `backend/main.py`, `backend/mcp_server.py`
- **Severity:** Medium
- **Problem:** Same function exists in both files. Keeping them in sync is error-prone.
- **Fix:** Extract to `backend/utils.py` and import from both.

### 16. `_reingest_note` reimplements `ingest.py` chunking
- **File:** `backend/main.py:277-339`
- **Severity:** Medium
- **Problem:** Chunking logic, metadata construction, and tiered text building are duplicated from `ingest.py`. Any change to the ingest pipeline must be manually mirrored.
- **Fix:** Extract a shared `build_chunks(note_id, title, body, ...)` in `ingest.py` and call it from both `ingest_notes` and `_reingest_note`.

### 17. Calendar O(N) lookups by date/participant
- **File:** `backend/calendar_data.py:96-101`
- **Severity:** Medium
- **Problem:** `get_events_for_date` and `get_events_for_participant` linear-scan all processed events.
- **Fix:** Build `defaultdict(list)` indexes keyed by date and normalized participant name during `process_events()`.

### 18. Substring tag matching in `get_timeline`
- **File:** `backend/store.py:255-258`
- **Severity:** Medium
- **Problem:** `if tag not in tags_str:` does substring matching, so `"work"` incorrectly matches `"workshop"`.
- **Fix:** Split `tags_str` by commas and check exact set membership.

## Phase 5: Testing

### 19. Shared mutable mock state in E2E
- **File:** `frontend/e2e/fixtures/mock-router.ts:60`
- **Severity:** High
- **Problem:** `let currentNote = { ...mockNoteDetail };` is module-level mutable state shared across all Playwright workers. Parallel tests that PATCH the note cause cross-test contamination.
- **Fix:** Reset the state in a `test.beforeEach` hook, or scope per test via fixture factory.

### 20. Vacuous E2E assertion
- **File:** `frontend/e2e/browse.spec.ts:65`
- **Severity:** High
- **Problem:** `expect(paginationExists || true).toBe(true)` always passes regardless of pagination DOM state.
- **Fix:** Remove the `|| true` and assert on actual element visibility.

### 21. Flaky `waitForLoadState("networkidle")`
- **File:** `frontend/e2e/nav.spec.ts`
- **Severity:** Medium
- **Problem:** AGENTS.md explicitly warns against this — Next.js dev server never reaches idle due to HMR/WebSocket connections.
- **Fix:** Replace with `waitForSelector` or `expect(...).toBeVisible()`.

### 22. Unrealistic `embed_texts_sync` mock
- **File:** `backend/tests/test_update.py:136-144`
- **Severity:** Low
- **Problem:** Mocks `embed_texts_sync` to `return_value=None`, but real function raises on failure. Test gives false confidence.
- **Fix:** Use `side_effect=Exception("fail")` and verify old chunks are preserved while endpoint returns 500.

## Phase 6: Cleanup & Config

### 23. Stale test count in README
- **File:** `README.md:204`
- **Severity:** Low
- **Problem:** Claims "86 tests across 7 files" — actual count is 128+ across 9+ files.
- **Fix:** Update to current counts.

### 24. Wrong paths in deploy configs and scripts
- **Files:** `deploy/notes-browser-*.service`, `scripts/sync_notes.py`
- **Severity:** Low
- **Problem:** References `/Users/alanzoppa/Code/notes-browser` but actual paths are `/Users/alan.zoppa/dev/notes-browser` and user is `alan.zoppa`, not `alanzoppa`.
- **Fix:** Update to match the actual filesystem.

### 25. Pydantic mutable default
- **File:** `backend/main.py:115`
- **Severity:** Low
- **Problem:** `filters: dict = {}` — Pydantic v2 copies this but it's still an anti-pattern.
- **Fix:** `filters: dict = Field(default_factory=dict)`.

### 26. Silent cache build errors
- **File:** `backend/main.py:63-69`
- **Severity:** Low
- **Problem:** `except Exception: continue` during `_build_source_id_cache` silently skips unreadable or corrupted files with no trace.
- **Fix:** Log the exception with the filename.

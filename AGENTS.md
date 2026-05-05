# Notes Browser — AGENTS.md

## What this is

A private web application to browse ~2,000 markdown notes with YAML frontmatter. Features: semantic search via local embeddings, visualization of tags/time/relationships, rich markdown rendering, and calendar integration.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Next.js   │────▶│   FastAPI    │────▶│ ChromaDB │
│  UI / Viz   │     │   sidecar    │     │ + meta   │
└─────────────┘     └──────┬───────┘     └──────────┘
                           │
                    ┌──────▼──────┐
                  ┌──────▼──────┐
                  │   Ollama /  │
                  │ OpenRouter   │
                  │ qwen3-embed │
                  └─────────────┘
```

## Directory structure

```
notes-browser/
├── AGENTS.md                    This file
├── frontend/                    Next.js app (App Router, Tailwind v4)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         Dashboard (hero, stats, charts)
│   │   │   ├── search/page.tsx  Search with filters + visualizations
│   │   │   ├── notes/[id]/      Note detail (markdown + sidebar)
│   │   │   ├── browse/page.tsx  Paginated note list with facet filters
│   │   │   ├── tags/page.tsx    Tag explorer with charts
│   │   │   ├── tags/[tag]/      Notes by tag
│   │   │   ├── timeline/        Activity timeline with chart toggle
│   │   │   ├── calendar/        Calendar grid view
│   │   │   ├── calendar/[date]/ Day detail (events + notes)
│   │   │   └── graph/           Interactive similarity graph (force-graph)
│   │   ├── components/
│   │   │   ├── ui/              Glass-morphism UI components (Card, Button, Badge, etc.)
│   │   │   ├── charts/          Recharts wrappers (Pie, Line, Area, Radar, Donut)
│   │   │   ├── Nav.tsx          Sidebar navigation
│   │   │   └── ErrorBoundary.tsx React error boundary
│   │   └── lib/
│   │       └── api.ts           FastAPI client
│   └── package.json
├── backend/                     FastAPI sidecar
│   ├── .venv/                   Python virtualenv
│   ├── main.py                  FastAPI app (12 endpoints)
│   ├── mcp_server.py             MCP server (stdio transport)
│   ├── utils.py                 Shared helpers (_normalize_meta, etc.)
│   ├── ingest.py                Ingestion pipeline (notes + calendar)
│   ├── embed.py                 Dual-provider embedding (Ollama + OpenRouter)
│   ├── store.py                 ChromaDB operations (2 collections)
│   ├── schema.py                Frontmatter schema discovery
│   ├── calendar_data.py         Calendar event processor
│   └── requirements.txt
├── notes/                       Flat .md files (2260)
├── images/                      Note images/PDFs (565)
├── data/                         Processed data (calendar.json etc.)
├── chroma_data/                 ChromaDB persistent storage
├── scripts/
│   ├── sync_notes.py            Copy + normalize notes from source
│   └── caption_images.py        AI captioning for image-only notes (Kimi k2.5:cloud)
└── deploy/
    ├── nginx.conf               NGINX reverse proxy config
    ├── notes-browser-backend.service
    └── notes-browser-frontend.service
```

## Code Conventions — Backend

### Imports
- Always import from `config.py` for path constants (`NOTES_DIR`, `CHROMA_PERSIST_DIR`, `IMAGES_DIR`)
  — never recompute with `os.path.join(os.path.dirname(__file__), "..")`
- Use `from __future__ import annotations` at the top of every file

### Shared utilities
- `backend/shared.py` contains `_read_state`, `_write_state`, `_state_lock`, `_is_safe_filename`
  — if you need these, import them; do not copy-paste
- `backend/models.py` contains ALL Pydantic models (request + response + result types)
  — never define models in route handlers
  — result models (`NoteResult`, `NoteListItem`, `TagInfo`, etc.) are returned by `NoteStore` methods

### State files
- State files use `filelock.FileLock` with `.lock` suffix (via `_state_lock` in `shared.py`)
- State format is JSON dict read/written via `_read_state`/`_write_state` (in `shared.py`)
- `_is_safe_filename` (used for path traversal prevention) lives in `shared.py`, not duplicated in `main.py` or `mcp_server.py`

### Store access
- Never access `store._notes` or `store._calendar` directly from outside `store.py`
  — add a public method to `NoteStore` if you need something not yet exposed
- `NoteStore` methods return **typed Pydantic models** (`NoteResult`, `NoteListItem`, `TagInfo`, `CoOccurrence`, `TimelinePeriod`, `StatsResponse`), not raw dicts
  — use `.metadata.title`, `.id`, etc. (attribute access) instead of `["metadata"]["title"]`, `["id"]`, etc. (dict access)
  — call `.model_dump()` on models when you need a plain dict (e.g., for JSON serialization)
- Embedding prefix is handled by `embed_texts_sync()` in `embed.py`
  — documents: no prefix (raw text); queries: `Instruct: Retrieve personal notes about people, projects, and meetings by semantic similarity\nQuery: ` prefix
  — do NOT prepend prefixes yourself; the function handles it

### File organization
Each file has one clear responsibility:

| File | Responsibility |
|------|---------------|
| `config.py` | Environment + paths + embedding settings |
| `constants.py` | Numerical/config constants |
| `models.py` | All Pydantic models |
| `store.py` | ChromaDB operations |
| `embed.py` | Dual-provider embedding (Ollama + OpenRouter) |
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

### Type safety
- `NoteStore` returns typed models, not raw dicts — always use attribute access (`.metadata.title`) instead of dict access (`["metadata"]["title"]`)
- `utils.normalize_and_dedup_results()` accepts both `NoteResult` objects and raw dicts, always returns `list[dict]`
- `SearchRequest.filters` is a `SearchFilters` model (`filters.source`, `filters.tags`), not a bare `dict`
- `IngestResponse.notes_result` is `IngestResult | None`, `calendar_result` is `CalendarIngestResult | None` — not `Any`
- Shared helpers (`_is_safe_filename`, `_read_state`, `_write_state`, `_state_lock`) live in `backend/shared.py` — import from there, don't copy-paste

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

## .env Configuration (machine-specific paths)

Create a `.env` file in the repo root on first startup (pydantic-settings reads it automatically if present; defaults match former auto-generated content):

```ini
# External data sources — adjust for your environment
CALENDAR_EXPORT_PATH=~/Downloads/calendar-export.json
PEOPLE_REGISTRY_PATH=~/Desktop/notes/people_registry.json
NOTES_SOURCE=~/Desktop/notes/Apple Notes

# Embedding providers
OPENROUTER_API_KEY=             # Required for EMBED_PROVIDER=openrouter
OPENROUTER_EMBED_MODEL=qwen/qwen3-embedding-8b
OLLAMA_EMBED_MODEL=qwen3-embedding
EMBED_PROVIDER_INGEST=ollama    # ollama or openrouter
EMBED_PROVIDER_QUERY=ollama     # ollama or openrouter
```

| Variable | Default | What it points to |
|----------|---------|-------------------|
| `CALENDAR_EXPORT_PATH` | `~/Downloads/calendar-export.json` | Exported Google Calendar JSON |
| `PEOPLE_REGISTRY_PATH` | `~/Desktop/notes/people_registry.json` | People aliases registry |
| `NOTES_SOURCE` | `~/Desktop/notes/Apple Notes` | Source notes for `scripts/sync_notes.py` |
| `OPENROUTER_API_KEY` | _(empty)_ | API key for OpenRouter embedding provider |
| `OPENROUTER_EMBED_MODEL` | `qwen/qwen3-embedding-8b` | OpenRouter model slug |
| `OLLAMA_EMBED_MODEL` | `qwen3-embedding` | Ollama model name |
| `EMBED_PROVIDER_INGEST` | `openrouter` | Provider for bulk ingest embedding |
| `EMBED_PROVIDER_QUERY` | `openrouter` | Provider for search query embedding |

All path variables support `~` (home dir) expansion. Internal paths (`notes/`, `chroma_data/`, `images/`) are derived deterministically from the repo root — no configuration needed.

## Data sources

- **Notes**: `$NOTES_SOURCE` → flattened into `notes/` with date normalization (2260 notes, ~215 image-only notes now AI-captioned)
- **Calendar**: `$CALENDAR_EXPORT_PATH` (2324 events, 2005–2026)
- **People registry**: `$PEOPLE_REGISTRY_PATH` (118+ people with aliases)

## Embedding model

- **Model**: `qwen3-embedding` (8B) via Ollama (local) or OpenRouter (cloud)
- **Dimensions**: 4096 → truncated to 256 (Matryoshka)
- **Prefix convention**:
  - Documents: no prefix (raw text)
  - Queries: `Instruct: Retrieve personal notes about people, projects, and meetings by semantic similarity\nQuery: ` prefix
- **Dual provider**:
- `EMBED_PROVIDER_INGEST` (default `openrouter`): provider for bulk embedding during ingest
- `EMBED_PROVIDER_QUERY` (default `openrouter`): provider for search-time single-query embedding
  - Ingest stores the provider name in `.ingest_state.json` and rejects incremental ingest if the provider changes (requires `--force`)
  - Startup warning logged if query provider differs from last ingest provider
- **ChromaDB**: local persistent at `chroma_data/`
- **Breaking change**: switching from nomic-embed-text-v2-moe requires `--force` re-ingest

## Vision model (image captioning)

- **Model**: `kimi-k2.5:cloud` via Ollama Cloud
- **Purpose**: Generate text descriptions for image-only notes
- **Process**: `scripts/caption_images.py` sends images to API, receives captions, prepends to note body as `[AI caption]: <description>`
- **Coverage**: 215 image-only notes now have searchable text descriptions
- **Format**: Captions are inserted before each image reference: `[AI caption]: <generated description>` followed by `\n\n![image](...)`

## Chunking strategy

**Tiered embedding**:
- Tier 1: `Title + Folder + Tags + Participants + first ~2000 chars` → primary representation
- Tier 2: Body chunks at ~2000 chars with 400 char overlap → linked to same note_id
- Calendar context appended to Tier 1 when same-day events with participant overlap exist

## ChromaDB collections

### `notes` collection
- ID format: `{sanitized_source_id}_chunk_{index}`
- Metadata: note_id, chunk_index, title, folder, tags (comma-joined), participants (comma-joined), created, modified, source, source_id

### `calendar` collection
- ID format: `cal_{event_id}`
- Metadata: date, summary, location, attendees (comma-joined), event_type

## How to run

### Prerequisites
- Ollama running with `qwen3-embedding` pulled (`ollama pull qwen3-embedding`)
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd backend
source .venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd frontend
npm run dev
```

### Ingest (first run or after updates)
```bash
cd backend
source .venv/bin/activate
python ingest.py --force          # Full re-ingest
python ingest.py                  # Incremental (mtime-based)
python ingest.py --calendar-only  # Calendar only
```

### Sync notes from source
```bash
python scripts/sync_notes.py           # Incremental
python scripts/sync_notes.py --force    # Full re-copy
```

### Caption image-only notes
```bash
cd backend
source .venv/bin/activate
pip install Pillow  # Required for image resizing

python scripts/caption_images.py              # Caption all image-only notes
python scripts/caption_images.py --dry-run    # Preview what would be captioned
python scripts/caption_images.py --force      # Re-caption notes with existing captions
```

## API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Hybrid semantic + metadata search |
| `/api/notes/{id}` | GET | Note detail with content + calendar + similar |
| `/api/tags` | GET | Tag counts + co-occurrence |
| `/api/timeline` | GET | Notes by time period |
| `/api/similar/{id}` | GET | Similar notes by embedding |
| `/api/ingest` | POST | Trigger re-indexing |
| `/api/schema` | GET | Frontmatter schema |
| `/api/stats` | GET | Collection statistics |
| `/api/calendar` | GET | Events with date/attendee filters |
| `/api/calendar/{id}` | GET | Event detail + linked notes |
| `/api/calendar/date/{date}` | GET | Events + notes for a date |
| `/api/graph` | GET | Similarity graph nodes + edges (optional tag filter) |

## MCP Server

The notes browser exposes an MCP (Model Context Protocol) server for LLM tool access. It runs on **stdio transport** (launched by the MCP client, not as an HTTP endpoint).

### Running

```bash
cd backend
source .venv/bin/activate
python mcp_server.py
```

Or via `fastmcp` CLI:

```bash
cd backend
source .venv/bin/activate
fastmcp dev mcp_server.py   # Inspector UI
fastmcp run mcp_server.py   # Stdio transport
```

### MCP config (e.g. for Claude Desktop)

Adjust the `cwd` path to your repo location:

```json
{
  "mcpServers": {
    "notes-browser": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "/path/to/notes-browser/backend"
    }
  }
}
```

### Tools

| Tool | Description |
|------|-------------|
| `search_notes(query, limit=10)` | Semantic search via embeddings |
| `get_note(note_id)` | Full note + content + calendar + similar |
| `get_recent_notes(days)` | Notes created in last N days |
| `list_tags()` | All tags with counts + co-occurrence |
| `get_notes_by_tag(tag, limit=20)` | Notes filtered by tag |
| `get_stats()` | Collection statistics |
| `get_calendar_events(date=None)` | Calendar events by date |
| `find_similar_notes(note_id, limit=5)` | Semantically similar notes |

### Resources

| URI | Description |
|-----|-------------|
| `notes://stats` | Collection stats summary |
| `notes://recent` | Notes from last 7 days |
| `notes://recent/{days}` | Notes from last N days |
| `notes://note/{note_id}` | Full note content |
| `notes://search/{query}` | Semantic search results |
| `notes://tags` | Tag list by frequency |

### Prompts

| Prompt | Description |
|--------|-------------|
| `summarize_recent(days=7)` | Summarize notes from last N days |
| `find_connections(person)` | Find notes about a person and their connections |

## Auth

None at the app level. Designed to run behind NGINX on a Tailscale tailnet. Tailscale ACLs handle access control.

## Testing

Three test suites: backend (pytest), frontend unit (vitest), and E2E (Playwright). The backend suite runs in under 2 seconds. Always run all suites together before committing to catch cross-layer regressions — frontend mock tests may break from shared fixture changes even when backend tests pass.

### IMPORTANT: Working Directory

**Always run tests from the project root**, not from `frontend/`:

```bash
# CORRECT - Run from project root
cd .
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/

# WRONG - Running from frontend/ breaks project detection
cd frontend
npx playwright test --project=mock  # Fails: "Project(s) 'mock' not found"
```

Playwright's config lookup is sensitive to working directory. The config file path must be explicit when running from the project root.

### Test Projects

- `mock` — Runs against mocked API responses (fast, no backend required)
- `live` — Runs against live backend at `127.0.0.1:8000` (tagged with `@smoke`)

### Running Tests

**Green means green. Period.** Do not commit or push if any test fails. Do not rationalize, explain away, or dismiss test failures. Fix the failure first, then re-run the full suite until it is completely green. No exceptions.

Always run all suites together before committing. Frontend-only or backend-only runs give false confidence.

```bash
cd .

# Backend (fast — run after any backend change)
backend/.venv/bin/pytest backend/

# Frontend unit (vitest)
cd frontend && npm run test

# E2E — all projects
cd ..  # back to project root
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/

# E2E — mock only (fast, no backend required)
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/ --project=mock

# E2E — live backend only (tagged with @smoke)
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/ --project=live

# Specific E2E test file
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/search.spec.ts
```

### Test Patterns Learned

**Prefer data-testid over text selectors**: Text changes break tests. Use `data-testid` for stable selectors:

```tsx
// Component
<button data-testid="filter-toggle">Filters</button>
<button data-testid="filter-source-all" data-active={isActive}>All</button>

// Test
await page.locator('[data-testid="filter-toggle"]').click();
await expect(page.locator('[data-testid="filter-source-all"]')).toHaveAttribute("data-active", "true");
```

**Scope selectors to avoid false matches**: The Graph page legend test was finding "Work" in a `<select>` option instead of the legend:

```typescript
// Bad - finds any "Work" text on page
await expect(page.locator("text=Work").first()).toBeVisible();

// Good - scoped to legend only
const legend = page.locator('[data-testid="graph-legend"]');
await expect(legend.locator("text=Work")).toBeVisible();
```

**Wait for async data**: Graph data loads asynchronously. Wait for it before asserting:

```typescript
await page.waitForSelector('[data-testid="graph-stats"]');
await expect(page.locator('[data-testid="graph-legend"]')).toBeVisible();
```

**Avoid brittle class assertions**: Don't check Tailwind classes for state:

```typescript
// Bad - breaks if styling changes
await expect(button).toHaveClass(/bg-blue-600/);

// Good - use data attributes
await expect(button).toHaveAttribute("data-active", "true");
```

**Fresh state for filter tests**: Search page hides "Popular:" tags after a search. Start fresh:

```typescript
await page.goto("/search"); // Resets searched=false
await page.locator('[data-testid="filter-toggle"]').click();
await expect(page.locator('[data-testid="popular-tags-label"]')).toBeVisible();
```

**Date picker uses lowercase**: "Date range" not "Date Range":

```typescript
await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible();
```

**Never use Math.random() in SSR components**: `Math.random()` (and `Date.now()`) produce different values on server vs client, causing React hydration mismatches. This triggers infinite re-mount loops where `useEffect` fires repeatedly and APIs get called in an endless loop. Use deterministic values instead:

```tsx
// BAD - hydration mismatch, infinite re-mounts
style={{ height: `${20 + Math.random() * 80}%` }}

// GOOD - deterministic, SSR-safe
const CHART_BAR_HEIGHTS = [65, 42, 78, 55, 90, 35, 72, 48, 85, 38, 60, 50];
style={{ height: `${CHART_BAR_HEIGHTS[i]}%` }}
```

**Playwright route matching for API paths**: Playwright glob patterns (`**`) match broadly and can shadow more specific routes. Never register overlapping calendar/date/event routes separately — use a single handler with URL inspection:

```typescript
// BAD - glob patterns shadow each other, /api/calendar/date/ matches the generic route
await page.route("**/api/calendar/date/*", dateHandler);   // never fires!
await page.route("**/api/calendar**", genericHandler);     // catches everything

// GOOD - single handler dispatches by URL
await page.route("**/api/calendar/**", async (route) => {
  const url = route.request().url();
  if (url.includes("/api/calendar/date/")) {
    await route.fulfill({ body: JSON.stringify(mockCalendarDate) });
  } else if (url.includes("/api/calendar?") || url.endsWith("/api/calendar")) {
    await route.fulfill({ body: JSON.stringify(mockCalendarEvents) });
  } else {
    await route.fulfill({ body: JSON.stringify(mockCalendarEvents.events[0]) });
  }
});
```

**Don't use waitForLoadState("networkidle") with Next.js dev**: The dev server never fully idles due to HMR/WebSocket connections. Prefer `waitForSelector` or `expect().toBeVisible()` instead.

**Avoid fragile DOM selectors for calendar-day cells**: Calendar state resets on navigation, making text selectors unreliable. Use data-testid on day cells:

```tsx
// Component
<div data-testid={`calendar-day-${dateStr}`} onClick={() => router.push(`/calendar/${dateStr}`)}>

// Test
await page.locator('[data-testid^="calendar-day-"]').first().click();
```

### Current data-testid attributes

| Component | data-testid |
|-----------|-------------|
| Calendar prev month | `month-nav-prev` |
| Calendar next month | `month-nav-next` |
| Calendar month display | `current-month` |
| Calendar day cell | `calendar-day-{YYYY-MM-DD}` |
| Calendar day loading | `loading` |
| Calendar day title | `date-title` |
| Calendar back button | `back-to-calendar` |
| Calendar grid | `calendar-grid` |
| Calendar events container | `calendar-events-{YYYY-MM-DD}` |
| Calendar event item | `calendar-event-{event-id}` |
| Graph container | `graph-container` |
| Graph stats | `graph-stats` |
| Graph filter panel | `filter-panel` |
| Graph Sources section | `filter-sources`, heading `filter-sources-heading` |
| Graph source filter chip | `source-filter-{source}` |
| Graph Structural Tags section | `filter-structural-tags`, heading `filter-structural-tags-heading` |
| Graph structural tag filter chip | `structural-tag-filter-{tag}` |
| Graph Tags section | `filter-tags`, heading `filter-tags-heading` |
| Graph content tag filter chip | `content-tag-filter-{tag}` |
| Tag autocomplete menu | `tag-autocomplete-menu` |
| Tag autocomplete item | `tag-autocomplete-item` |
| Clear tag filter button | `clear-tag-filter` |
| Search filter toggle | `filter-toggle` |
| Search filter panel | `filter-panel` |
| Search popular tags label | `popular-tags-label` |
| Search source filter buttons | `filter-source-all`, `filter-source-Apple Notes`, `filter-source-Evernote` |
| Date range picker | `date-range-picker` |
| Search autocomplete input | `data-search-input` (attribute, not testid) |

## Component Conventions

**StatCard** uses `.card-hover` class (not `[class*='StatCard']`). Test with:

```typescript
const pageText = await page.locator('.card-hover').allTextContents();
```

**Active filter buttons** have `data-active` attribute set to `"true"` when selected.

**ImageGallery** is a controlled component:
- Props: `externalOpen`, `externalIndex`, `onOpenChange`, `onIndexChange`
- Thumbnail clicks open lightbox at correct index via parent state

## Note format

Notes are flat `.md` files in `notes/` with YAML frontmatter. See `example-note.md` in the project root for a complete example with all fields. Quick reference:

| Field | Required | Example |
|-------|----------|---------|
| `title` | Yes | `"Lunar regolith composting experiment — batch 47"` |
| `folder` | Yes | `"Offworld Agriculture"` |
| `created` | Yes | `2025-11-03T09:17:22-08:00` (Apple Notes) or `2017-02-25T21:33:55Z` (Evernote) |
| `modified` | Yes | Same format as `created` |
| `source` | Yes | `"Apple Notes"` or `"Evernote"` |
| `source_id` | Yes | `x-coredata://...` (Apple Notes) or `evernote:note:<hex>` (Evernote) |
| `tags` | Yes | YAML list of strings |
| `participants` | Yes | YAML list of strings (can be empty `[]`) |
| `source_url` | No | External URL (rare, mostly Evernote) |

Duplicate filenames get `__2`, `__3`, etc. suffixes.

## Changelog

- [x] Dual-provider embedding (`qwen3-embedding-8b` via Ollama + OpenRouter) — configurable `EMBED_PROVIDER_INGEST`/`EMBED_PROVIDER_QUERY`, provider consistency guard on ingest, qwen3 prefix convention
- [x] Cross-encoder reranker (`BAAI/bge-reranker-v2-m3`) — second-stage note ranking via `/search` with `?rerank=true` toggle

- [x] Similarity graph page (`/graph`) — force-directed graph with react-force-graph or D3
- [x] Image captioning for 215 image-only notes using `kimi-k2.5:cloud`
- [x] All E2E tests passing
- [x] Incremental re-ingest on file change (watchdog)
- [ ] Incremental Evernote sync once that agent finishes
- [ ] Re-tag notes with only structural tags (82 notes)
- [ ] Merge duplicate people in registry (e.g., Damen / Damen Turnbull)
- [ ] Full-text search fallback (for exact token matches that embeddings miss)
- [x] MCP server (stdio transport) with tools, resources, and prompts
- [x] Concurrent bulk embedding with connection reuse — `embed_texts_bulk()` uses pooled `httpx.Client` via `ThreadPoolExecutor` (10 workers OpenRouter / 4 workers Ollama); single `embed_texts_sync()` preserved for small-query use
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
                    │   Ollama    │
                    │ nomic-embed │
                    │  -text-v2   │
                    └─────────────┘
```

## Directory structure

```
notes-browser/
├── AGENTS.md                    This file
├── frontend/                    Next.js app (App Router, Tailwind v4)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         Dashboard
│   │   │   ├── search/page.tsx  Search with filters
│   │   │   ├── notes/[id]/      Note detail (markdown + sidebar)
│   │   │   ├── browse/page.tsx  Paginated note list
│   │   │   ├── tags/page.tsx    Tag cloud + co-occurrence
│   │   │   ├── tags/[tag]/      Notes by tag
│   │   │   ├── timeline/        Timeline chart (recharts)
│   │   │   ├── calendar/        Calendar grid view
│   │   │   ├── calendar/[date]/ Day detail (events + notes)
│   │   │   └── graph/           Interactive similarity graph (force-graph)
│   │   ├── components/
│   │   │   └── Nav.tsx          Sidebar navigation
│   │   └── lib/
│   │       └── api.ts           FastAPI client
│   └── package.json
├── backend/                     FastAPI sidecar
│   ├── .venv/                   Python virtualenv
│   ├── main.py                  FastAPI app (11 endpoints)
│   ├── ingest.py                Ingestion pipeline (notes + calendar)
│   ├── embed.py                 Ollama embedding client
│   ├── store.py                 ChromaDB operations (2 collections)
│   ├── schema.py                Frontmatter schema discovery
│   ├── calendar_data.py         Calendar event processor
│   └── requirements.txt
├── notes/                       Flat .md files (2260)
├── images/                      Note images/PDFs (565)
├── data/                         Processed data (calendar.json etc.)
├── chroma_data/                 ChromaDB persistent storage
├── scripts/
│   └── sync_notes.py            Copy + normalize notes from source
└── deploy/
    ├── nginx.conf               NGINX reverse proxy config
    ├── notes-browser-backend.service
    └── notes-browser-frontend.service
```

## Data sources

- **Notes**: `~/Desktop/notes/Apple Notes/` → flattened into `notes/` with date normalization
- **Calendar**: `~/Downloads/calendar-export.json` (2324 events, 2005–2026)
- **People registry**: `~/Desktop/notes/people_registry.json` (118+ people with aliases)

## Embedding model

- **Model**: `nomic-embed-text-v2-moe` via Ollama
- **Dimensions**: 768 → truncated to 256 (Matryoshka)
- **Max input**: 512 tokens (~2000 chars approximation)
- **Prefix convention**: `search_document:` for docs, `search_query:` for queries
- **ChromaDB**: local persistent at `chroma_data/`

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
- Ollama running with `nomic-embed-text-v2-moe` pulled
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd ~/Codes/notes-browser/backend
source .venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd ~/Codes/notes-browser/frontend
npm run dev
```

### Ingest (first run or after updates)
```bash
cd ~/Codes/notes-browser/backend
source .venv/bin/activate
python ingest.py --force          # Full re-ingest
python ingest.py                  # Incremental (mtime-based)
python ingest.py --calendar-only  # Calendar only
```

### Sync notes from source
```bash
python ~/Codes/notes-browser/scripts/sync_notes.py           # Incremental
python ~/Codes/notes-browser/scripts/sync_notes.py --force    # Full re-copy
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

## Auth

None at the app level. Designed to run behind NGINX on a Tailscale tailnet. Tailscale ACLs handle access control.

## TODO

- [ ] Similarity graph page (`/graph`) — force-directed graph with react-force-graph or D3
- [ ] Incremental re-ingest on file change (watchdog)
- [ ] Incremental Evernote sync once that agent finishes
- [ ] Re-tag notes with only structural tags (82 notes)
- [ ] Merge duplicate people in registry (e.g., Damen / Damen Turnbull)
- [ ] Full-text search fallback (for exact token matches that embeddings miss)
- [ ] Image serving in note detail (currently `../images/` relative links)
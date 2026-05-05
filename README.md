# Mnestic

Private knowledge browser with semantic search for ~2,200 markdown notes with YAML frontmatter (215+ image-only notes AI-captioned).

## Features

- **Semantic search** via local embeddings (Ollama + nomic-embed-text-v2-moe)
- **AI image captioning** for image-only notes using Kimi k2.5:cloud
- **Tag filtering** with cloud visualization
- **Timeline view** for exploring notes chronologically
- **Calendar integration** with note correlation
- **Similarity graph** for visual note relationships
- **Markdown rendering** with image support and sidebar attachments

## Installation

### Prerequisites

- **Python 3.10+** — `python3 --version`
- **Node.js 20+** — `node --version`
- **Ollama** — install from [ollama.com](https://ollama.com), then `ollama serve` in a terminal

### Step 1 — Install dependencies

```bash
git clone git@github.com:alanzoppa/mnestic.git
cd mnestic

# Backend
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### Step 2 — Pull the embedding model

```bash
ollama pull nomic-embed-text-v2-moe
```

This downloads ~900 MB. Only needed once. Make sure `ollama serve` is running first.

### Step 3 — Add your notes

Place markdown files directly in the `notes/` directory (flat — no subdirectories).

Each note must have YAML frontmatter with these fields:

```yaml
---
title: "Note title"
folder: "Folder Name"       # used for filtering/grouping
created: 2025-11-03T09:17:22-08:00
modified: 2025-11-05T14:33:01-08:00
source: "Apple Notes"       # or "Evernote", "Meeting Summaries", etc.
source_id: "unique-id"      # any unique string per note
tags:
  - tag1
  - tag2
participants:               # optional, for meeting notes
  - "Person Name"
---
```

See `example-note.md` for a complete example.

To migrate notes from a different format, see `scripts/migrate_meetings.py` for an example migration script.

### Step 4 — Index your notes

With Ollama running and the embedding model pulled:

```bash
cd backend
source .venv/bin/activate
python3 -c "from ingest import reindex_all; reindex_all()"
cd ..
```

This embeds all notes in `notes/` into ChromaDB. Takes ~1–5 minutes depending on note count. Progress prints to stdout.

### Step 5 — Start the services

Open **two terminals**:

**Terminal 1 — Backend (FastAPI on port 8000):**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend (Next.js on port 3000):**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

> **Note:** Ollama must also be running (`ollama serve` in a third terminal, or as a background service).

### Caption Image-Only Notes (Optional)

Generate AI descriptions for notes that contain only images:

```bash
cd backend
source .venv/bin/activate
pip install Pillow

python3 scripts/caption_images.py          # caption all image-only notes
python3 scripts/caption_images.py --dry-run   # preview without modifying
python3 scripts/caption_images.py --force     # re-caption existing captions
```

Uses Ollama Cloud's `kimi-k2.5:cloud` model. Re-run the Step 4 ingest after captioning to update embeddings.

## Development

### Backend API

The FastAPI backend exposes these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Note and chunk counts |
| `POST /api/search` | Semantic search with filters |
| `GET /api/notes/{id}` | Get note by ID |
| `GET /api/tags` | All tags with counts |
| `GET /api/timeline` | Notes grouped by date |
| `GET /api/similar/{id}` | Similar notes |
| `POST /api/ingest` | Trigger re-index |
| `GET /api/schema` | Schema discovery |
| `GET /api/calendar` | Calendar events |
| `GET /api/calendar/{id}` | Event by ID |
| `GET /api/calendar/date/{date}` | Events for date |
| `GET /api/graph` | Similarity graph data |

### Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with stats + ingest controls |
| `/search` | Semantic search |
| `/browse` | Paginated note list |
| `/tags` | Tag cloud |
| `/tags/{tag}` | Filtered by tag |
| `/timeline` | Chronological bar chart |
| `/calendar` | Calendar grid |
| `/calendar/{date}` | Day detail |
| `/notes/{id}` | Note detail |
| `/graph` | Similarity visualization |

### Useful Commands

```bash
# Reset ChromaDB (delete all indexed data)
rm -rf chroma_data/

# Sync just the notes (no re-index)
python3 scripts/sync_notes.py

# Check index status
curl http://localhost:8000/api/stats

# Run backend with auto-reload
uvicorn main:app --reload

# Build frontend for production
cd frontend && npm run build
```

### Project Structure

```
mnestic/
├── backend/           # FastAPI + ChromaDB
│   ├── main.py        # API endpoints
│   ├── ingest.py      # Indexing pipeline
│   ├── embed.py       # Ollama client
│   ├── store.py       # ChromaDB wrapper
│   ├── schema.py      # Schema discovery
│   ├── calendar_data.py # Calendar processor
│   └── tests/         # Pytest test suite
├── frontend/          # Next.js + Tailwind
│   ├── src/app/       # App router pages
│   ├── src/components/# React components
│   └── src/lib/       # API client
├── scripts/           # Utility scripts
│   ├── sync_notes.py  # Note normalization
│   └── caption_images.py  # AI captioning for image-only notes
├── notes/             # Synced markdown files (gitignored)
├── images/            # Image assets (gitignored)
├── chroma_data/       # Vector DB storage (gitignored)
└── deploy/            # NGINX + systemd configs
```

## Testing

Run tests from the project root:

```bash
cd .

# Backend
backend/.venv/bin/pytest backend/

# Frontend unit
frontend/node_modules/.bin/vitest --config=frontend/vitest.config.ts run

# E2E (mocked API — fast, no backend required)
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/ --project=mock

# E2E (live backend — requires both services running)
frontend/node_modules/.bin/playwright test --config=frontend/playwright.config.ts e2e/ --project=live
```

Always run all suites together before committing — frontend mock fixtures may break from shared data changes even when backend tests pass.

## Troubleshooting

### ChromaDB Errors

**Error: "ValueError: Include parameter must not contain 'ids'"**
- Fixed in current code: ChromaDB 1.5+ returns IDs by default
- If you see this, upgrade ChromaDB: `pip install -U chromadb`

**Error: "duplicate IDs" during ingest**
- This should not happen with current chunk ID generation
- If it does, clear the DB: `rm -rf chroma_data/`

### Ollama Connection

**Error: "Connection refused"**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
ollama serve
```

### Frontend Build

**Error: "usePathname must be used within a client component"**
- Already fixed: Nav component is in `src/components/Nav.tsx` (client component)
- If you see this, ensure you're not importing hooks in server components

## Deployment

See `deploy/` directory for NGINX and systemd configurations.

```bash
# Copy configs
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mnestic
sudo cp deploy/mnestic-*.service /etc/systemd/system/

# Enable services
sudo systemctl enable mnestic-backend
sudo systemctl enable mnestic-frontend
sudo systemctl start mnestic-backend
sudo systemctl start mnestic-frontend
```

## License

Private project - not open source.

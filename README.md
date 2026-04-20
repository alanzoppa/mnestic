# Notes Browser

Private notes browser with semantic search for ~2,200 markdown notes with YAML frontmatter (215+ image-only notes AI-captioned).

## Features

- **Semantic search** via local embeddings (Ollama + nomic-embed-text-v2-moe)
- **AI image captioning** for image-only notes using Kimi k2.5:cloud
- **Tag filtering** with cloud visualization
- **Timeline view** for exploring notes chronologically
- **Calendar integration** with note correlation
- **Similarity graph** for visual note relationships
- **Markdown rendering** with image support and sidebar attachments

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- Ollama (for embeddings)
- Git

### 1. Clone and Setup

```bash
git clone git@github.com:alanzoppa/notes-browser.git
cd notes-browser

# Backend setup
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# Frontend setup
cd frontend
npm install
cd ..
```

### 2. Configure Data Sources

Copy your notes and calendar export to the project:

```bash
# Notes should be in the Apple Notes format (see AGENTS.md for format details)
# Place markdown files in: notes/
# Place images in: images/

# Calendar export (optional, for calendar integration)
# Place at: data/calendar-export.json
```

### 3. Sync Notes

Normalize dates and copy notes/images to the project:

```bash
# Update SOURCE_DIR and DEST_DIR in scripts/sync_notes.py
python3 scripts/sync_notes.py
```

### 4. Start Ollama

```bash
# Pull the embedding model
ollama pull nomic-embed-text-v2-moe

# Ensure Ollama is running
ollama serve
```

### 5. Index Notes

```bash
cd backend

# Full re-index (clears existing data)
python3 -c "from ingest import reindex_all; reindex_all()"

# Or via API once server is running
curl -X POST http://localhost:8000/api/ingest
```

### 6. Caption Image-Only Notes (Optional)

Generate AI descriptions for notes containing only images (no text):

```bash
# Install Pillow for image resizing
pip install Pillow

# Caption all image-only notes
python3 scripts/caption_images.py

# Preview without modifying files
python3 scripts/caption_images.py --dry-run

# Re-caption notes with existing captions
python3 scripts/caption_images.py --force
```

This sends images to Ollama Cloud's `kimi-k2.5:cloud` model and prepends captions as `[AI caption]: <description>` before each image. After captioning, re-run the ingest step to update embeddings.

### 7. Run Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Run specific test file
pytest tests/test_api.py -v
pytest tests/test_ingest.py -v

# With coverage
pytest tests/ --cov=. --cov-report=html
```

### 8. Start Services

In separate terminals:

```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Open http://localhost:3000

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
notes-browser/
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

All backend tests pass (86 tests across 7 files):

```bash
cd backend
pytest tests/ -v

# Test output summary:
# test_sync.py     - 12 tests (note syncing)
# test_embed.py    - 10 tests (Ollama embedding)
# test_store.py    - 11 tests (ChromaDB operations)
# test_schema.py   - 6 tests  (schema discovery)
# test_calendar.py - 9 tests  (calendar processing)
# test_ingest.py   - 9 tests  (chunking/ingestion)
# test_api.py      - 12 tests (API endpoints)
```

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
sudo cp deploy/nginx.conf /etc/nginx/sites-available/notes-browser
sudo cp deploy/notes-browser-*.service /etc/systemd/system/

# Enable services
sudo systemctl enable notes-browser-backend
sudo systemctl enable notes-browser-frontend
sudo systemctl start notes-browser-backend
sudo systemctl start notes-browser-frontend
```

## License

Private project - not open source.

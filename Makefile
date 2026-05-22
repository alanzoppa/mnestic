# Mnestic — Developer Makefile
# Requires: Python 3.11+, uv, npm, node 22+

.PHONY: help install dev dev-backend dev-frontend test test-quick test-integration seed

# Default: show targets
help:
	@echo "Mnestic dev commands:"
	@echo "  make install        Install Python deps (backend/.venv) + npm install (frontend)"
	@echo "  make dev            Start backend + frontend in background (ctrl-C kills both)"
	@echo "  make dev-backend    Start FastAPI backend with auto-reload"
	@echo "  make dev-frontend   Start Next.js frontend dev server"
	@echo "  make test           Run backend pytest + frontend vitest"
	@echo "  make test-quick     Run backend unit tests only (no integration)"
	@echo "  make test-integration Run full backend test suite (including integration tests)"
	@echo "  make seed           Run dev seed script (default 50 notes)"

# ── Install ──────────────────────────────────────────────────────────

# Set up backend .venv if missing, install Python deps; run npm install in frontend.
install:
	@echo "==> Checking backend .venv..."
	@if [ ! -d backend/.venv ]; then \
		cd backend && uv venv .venv; \
	fi
	@echo "==> Installing backend deps..."
	@cd backend && uv pip install -r requirements.txt
	@cd backend && uv pip install pytest
	@echo "==> Installing frontend deps..."
	cd frontend && npm install
	@echo "==> Done."

# ── Dev servers ─────────────────────────────────────────────────────

# Start both backend and frontend in background with a trap to kill both on exit.
dev:
	@echo "==> Starting backend on port 8000..."
	@cd backend && MNESTIC_LITE=1 .venv/bin/uvicorn main:app --reload --port 8000 & \
	BE_PID=$$$$!; \
	cd ../frontend && npm run dev & \
	FE_PID=$$$$!; \
	trap "echo '==> Shutting down...'; kill $$$$BE_PID $$$$FE_PID 2>/dev/null; wait" INT TERM EXIT; \
	wait

# Start FastAPI backend with auto-reload.
dev-backend:
	cd backend && MNESTIC_LITE=1 .venv/bin/uvicorn main:app --reload --port 8000

# Start Next.js frontend dev server.
dev-frontend:
	cd frontend && npm run dev

# ── Tests ────────────────────────────────────────────────────────────

# Run backend pytest + frontend vitest.
test:
	@echo "==> Running backend tests..."
	cd backend && .venv/bin/python -m pytest -q
	@echo "==> Running frontend tests..."
	cd frontend && npm test

# Run backend unit tests only (skip integration tests).
# This target expects pytest markers (e.g., @pytest.mark.integration) to exist.
test-quick:
	cd backend && .venv/bin/python -m pytest -m "not integration" -q

# Run full backend test suite including integration tests.
test-integration:
	cd backend && .venv/bin/python -m pytest -q

# ── Seeding ────────────────────────────────────────────────────────

# Run the dev seed script with default 50 notes.
# Create scripts/seed_dev_data.py if it does not yet exist.
seed:
	@if [ ! -f scripts/seed_dev_data.py ]; then \
		echo "ERROR: scripts/seed_dev_data.py not found. Create it first."; \
		exit 1; \
	fi
	cd backend && .venv/bin/python ../scripts/seed_dev_data.py 50

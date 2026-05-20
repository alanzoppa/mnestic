#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

echo ">>> Pulling latest changes..."
git -C "$REPO_ROOT" stash -q || true
git -C "$REPO_ROOT" pull --rebase
git -C "$REPO_ROOT" stash pop -q || true

# --- Backend tests (conditional) ---
# Only run if a venv with pytest exists; Docker Compose --build handles deps otherwise.
if [ -x "$REPO_ROOT/backend/.venv/bin/pytest" ]; then
  echo ">>> Installing backend dependencies..."
  "$REPO_ROOT/backend/.venv/bin/pip" install -q -r "$REPO_ROOT/backend/requirements.txt"

  echo ">>> Running backend tests..."
  "$REPO_ROOT/backend/.venv/bin/pytest" -q "$REPO_ROOT/backend/tests/"
else
  echo ">>> Skipping backend venv tests (no .venv/bin/pytest found — Docker build will validate)"
fi

# --- Frontend build (conditional) ---
# Only build locally if node_modules exists; Docker Compose --build handles it otherwise.
if [ -d "$REPO_ROOT/frontend/node_modules" ]; then
  echo ">>> Installing frontend dependencies..."
  npm install --prefix "$REPO_ROOT/frontend" --silent

  echo ">>> Building frontend..."
  npm run build --prefix "$REPO_ROOT/frontend"
else
  echo ">>> Skipping frontend local build (no node_modules found — Docker build will compile)"
fi

echo ">>> Restarting services..."
cd "$REPO_ROOT" && docker compose -f docker-compose.yml up -d --build

echo ">>> Done!"

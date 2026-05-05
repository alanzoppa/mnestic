#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

echo ">>> Pulling latest changes..."
git -C "$REPO_ROOT" pull

echo ">>> Installing backend dependencies..."
"$REPO_ROOT/backend/.venv/bin/pip" install -q -r "$REPO_ROOT/backend/requirements.txt"

echo ">>> Running backend tests..."
"$REPO_ROOT/backend/.venv/bin/pytest" -q "$REPO_ROOT/backend/tests/"

echo ">>> Installing frontend dependencies..."
npm install --prefix "$REPO_ROOT/frontend" --silent

echo ">>> Building frontend..."
npm run build --prefix "$REPO_ROOT/frontend"

echo ">>> Restarting services..."
systemctl --user restart notes-browser-backend.service notes-browser-frontend.service

echo ">>> Done!"
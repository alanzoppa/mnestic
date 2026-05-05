#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

echo ">>> Pulling latest changes..."
git -C "$REPO_ROOT" stash -q || true
git -C "$REPO_ROOT" pull --rebase
git -C "$REPO_ROOT" stash pop -q || true

echo ">>> Installing backend dependencies..."
"$REPO_ROOT/backend/.venv/bin/pip" install -q -r "$REPO_ROOT/backend/requirements.txt"

echo ">>> Running backend tests..."
"$REPO_ROOT/backend/.venv/bin/pytest" -q "$REPO_ROOT/backend/tests/"

echo ">>> Installing frontend dependencies..."
npm install --prefix "$REPO_ROOT/frontend" --silent

echo ">>> Building frontend..."
npm run build --prefix "$REPO_ROOT/frontend"

echo ">>> Restarting services..."
systemctl --user restart mnestic-backend.service mnestic-frontend.service

echo ">>> Done!"
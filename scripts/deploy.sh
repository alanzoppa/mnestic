#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# In CI (GitHub Actions), the repo is already checked out at the right commit.
# Outside CI (manual deploy), we need to git pull to get latest.
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  IN_CI=true
  REPO_ROOT="$GITHUB_WORKSPACE"
else
  IN_CI=false
  REPO_ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
  # Pull latest changes
  echo ">>> Pulling latest changes..."
  git -C "$REPO_ROOT" stash -q || true
  git -C "$REPO_ROOT" pull --rebase
  git -C "$REPO_ROOT" stash pop -q || true
fi

# ---------------------------------------------------------------------------
# Error trap: create a kanban task on any step failure so CI failures are
# visible on the board instead of silently rotting in logs.
# ---------------------------------------------------------------------------
_DEPLOY_LOG=""
_on_error() {
  local cmd="$BASH_COMMAND"
  local line="$LINENO"
  local step_desc="${cmd%%$'\n'*}"

  # Capture recent error output
  local error_context=""
  if [ -f "${TMPDIR:-/tmp}/mnestic-deploy-$$" ]; then
    error_context="$(tail -20 "${TMPDIR:-/tmp}/mnestic-deploy-$$" 2>/dev/null || true)"
  fi

  # Gather diagnostic context
  local docker_status=""
  if command -v docker &>/dev/null; then
    docker_status="$(docker compose -f "$REPO_ROOT/docker-compose.yml" ps --format '{{.Name}} {{.Status}}' 2>/dev/null || echo 'docker compose ps failed')"
  else
    docker_status="docker not found on PATH"
  fi

  local git_status=""
  if [ -d "$REPO_ROOT/.git" ]; then
    git_status="$(git -C "$REPO_ROOT" log --oneline -3 2>/dev/null || echo 'git log failed')"
  fi

  local task_title="fix: CI deploy failed — ${step_desc:0:200}"

  local task_body="## Deploy Failure

**Failed command:** \`${cmd}\`
**Line:** ${line} (in deploy.sh)
**Timestamp:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')
**Running in CI:** ${IN_CI}
**Repo root:** ${REPO_ROOT}

### Error output (last 20 lines)
\`\`\`
${error_context}
\`\`\`

### Environment context
**Git HEAD (last 3 commits):**
\`\`\`
${git_status}
\`\`\`
**Docker containers:**
\`\`\`
${docker_status}
\`\`\`

### Instructions
1. Read the error output above — identify the root cause (do NOT re-diagnose from scratch)
2. Fix the issue in the mnestic repo (\`${REPO_ROOT}\`)
3. Commit your fix and push to main
4. The next CI push will retrigger this workflow
5. If the fix is in deploy.yml or deploy.sh, the workflow fires on push automatically
6. Verify by checking the CI run: \`gh run list --repo alanzoppa/mnestic --workflow=deploy.yml --limit 1\`
7. After fixing, \`kanban_complete()\` with what you changed
"

  # Create kanban task (best-effort — don't let kanban failure mask the original error)
  hermes kanban create "$task_title" \
    --assignee engineer \
    --max-runtime 1500 \
    --body "$task_body" \
    2>/dev/null || true

  # Show the original error on stderr
  echo ">>> DEPLOY FAILED: ${cmd} (line ${line})" >&2
}

trap '_on_error' ERR

# Tee all output to a temp file so the trap can capture recent output
_DEPLOY_LOG="${TMPDIR:-/tmp}/mnestic-deploy-$$"
cleanup() {
  rm -f "$_DEPLOY_LOG"
}
trap cleanup EXIT

# Use a pipe to capture output while still printing it
exec > >(tee "$_DEPLOY_LOG") 2>&1

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

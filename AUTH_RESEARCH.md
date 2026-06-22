# Mnestic Authentication Research

## Date: 2026-06-22
## Status: Research Complete

## Current State

Mnestic has **no authentication**. All 12+ backend API endpoints and 7 MCP tools are open. The app is bound to `127.0.0.1` and served via Tailscale Serve, so it's only reachable through the Tailscale network — but anyone on the tailnet can access it, and the MCP server (stdio transport) has no auth at all.

## Architecture Context

- **Backend**: FastAPI (`backend/main.py`, ~12 endpoints), ChromaDB for vector storage
- **Frontend**: Next.js App Router (`frontend/src/app/`), API client in `src/lib/api.ts`
- **MCP Server**: `backend/mcp_server.py` — 7 tools (search, create, get_note, get_recent, list_tags, get_notes_by_tag, get_stats), stdio transport
- **Deployment**: Docker Compose, backend on :8000, frontend on :3000 (proxied to :3001)
- **Access**: `127.0.0.1` bound, Tailscale Serve on port 8449
- **Config**: `backend/config.py` uses pydantic-settings, loads from `.env`

---

## Option 1: FastAPI Native Auth (JWT + OAuth2PasswordBearer)

### How it works
Standard FastAPI auth flow: user logs in with username/password → backend issues a JWT → JWT is sent as `Authorization: Bearer <token>` on every request → frontend stores JWT in httpOnly cookie or localStorage.

### Implementation
**Backend changes:**
- Add `python-jose[cryptography]` and `passlib[bcrypt]` to `requirements.txt`
- Create `backend/auth.py` — `OAuth2PasswordBearer` token endpoint, password hashing, JWT creation/verification
- Add `Depends(get_current_user)` to every route in `main.py`
- Store credentials in `.env` (single user) or SQLite (multi-user)
- JWT secret in `.env` as `JWT_SECRET`

**Frontend changes:**
- Add `/login` page with username/password form
- Store JWT in httpOnly cookie (Next.js middleware or server-side login handler)
- Add auth header to all `fetchAPI()` calls in `api.ts`
- Redirect to `/login` on 401 responses

**MCP server:**
- Add `X-API-Key` or `Authorization: Bearer` header support to `mcp_server.py`
- MCP config in Hermes passes the token via env var

### Complexity: **Medium**
### Maintenance: **Low** — standard pattern, well-documented
### Security: Good — JWTs expire, passwords hashed with bcrypt
### Fit for single-user: **Overkill** — login page + JWT refresh + password management for one person is heavy
### MCP compatibility: Workable but awkward — stdio MCP doesn't have a natural place for JWTs; would need a static API key for the MCP path anyway

---

## Option 2: Reverse Proxy Auth (Tailscale Serve / NPM)

### How it works
Let the reverse proxy handle auth. Tailscale Serve already provides TLS + network-level access control (only tailnet members can reach it). NPM can add HTTP Basic Auth on top.

### Implementation
**Backend changes:** None
**Frontend changes:** None

**Tailscale-level:**
- Tailscale Serve already restricts to tailnet members
- Tailscale Funnel could expose publicly with Tailscale's own auth
- No per-user auth — it's all-or-nothing on the tailnet

**NPM-level:**
- Add Basic Auth on the proxy host for mnestic
- `.htpasswd` file with a single user
- Browser prompts for credentials before reaching the app

### Complexity: **Low**
### Maintenance: **Very low** — set once, forget
### Security: Weak for API access — Basic Auth credentials are sent with every request (over TLS, so fine), but there's no token revocation, no per-client keys, and the MCP server can't easily go through NPM
### Fit for single-user: **Good for web UI, bad for API/MCP** — the tailnet restriction is already the primary security layer; adding Basic Auth is marginal
### MCP compatibility: **Poor** — MCP server connects via stdio to the backend directly, not through the proxy. Would need a separate API key mechanism.

---

## Option 3: API Key-Based Auth (X-API-Key Header)

### How it works
Every request must include an `X-API-Key` header with a valid key. The backend validates the key against a stored list. Simple, stateless, no login flow.

### Implementation
**Backend changes:**
- Create `backend/auth.py` — middleware or dependency that checks `X-API-Key` header
- Store keys in `.env` (single key) or SQLite (`api_keys` table with key, name, created_at, revoked)
- Add `Depends(require_api_key)` to every route in `main.py`
- Add `/api/auth/keys` endpoints for key management (list, create, revoke)

**Frontend changes:**
- Store API key in localStorage or httpOnly cookie after manual entry
- Add key to all `fetchAPI()` calls in `api.ts`
- Simple key entry page (not a full login — just paste the key)

**MCP server:**
- `mcp_server.py` reads key from env var (`MNESTIC_API_KEY`)
- Hermes MCP config passes the key: `env: {"MNESTIC_API_KEY": "..."}`
- Every MCP tool call includes the key in the backend request

### Complexity: **Low**
### Maintenance: **Very low** — no password management, no token refresh, no expiry
### Security: Adequate — keys are long random strings, can be revoked, no expiry complexity. Risk: key leakage gives full access until revoked.
### Fit for single-user: **Excellent** — one key for the web UI, one for MCP, one for scripts. Simple to manage.
### MCP compatibility: **Perfect** — env var → header, no interactive login needed

---

## Option 4: Full OAuth2/OIDC Provider (Authentik / Authelia / Keycloak)

### How it works
Run a dedicated identity provider. Mnestic delegates auth to the IdP via OAuth2 authorization code flow or OIDC. Users log in at the IdP, get redirected back with a token.

### Implementation
**Backend changes:**
- Add `authlib` or `fastapi-azure-auth` to `requirements.txt`
- Configure OAuth2 client in `backend/config.py` (client_id, client_secret, IdP URL)
- Add OAuth2 callback endpoint in `main.py`
- Validate OIDC tokens on every request

**Frontend changes:**
- Redirect to IdP login page when unauthenticated
- Handle OAuth2 callback (token exchange)
- Store session/token, attach to API calls

**Infrastructure:**
- Deploy Authentik or Authelia as a Docker container
- Configure it with user accounts, client registrations
- Manage the IdP's own database, updates, backups

### Complexity: **High**
### Maintenance: **High** — IdP is another service to maintain, update, back up. User management overhead.
### Security: Excellent — proper OIDC, MFA support, session management, audit logs
### Fit for single-user: **Massive overkill** — running a full IdP for one person is absurd. Only makes sense if you already run Authentik for other services and want SSO across everything.
### MCP compatibility: **Poor** — OAuth2 flow requires interactive browser login. MCP server would need a separate API key or service account anyway, defeating the purpose.

---

## Option 5: Hybrid (Password Login for Web UI + API Tokens for Programmatic Access)

### How it works
Two auth paths:
- **Web UI**: Username/password login → session cookie (signed, httpOnly). No JWT complexity — just a server-side session.
- **API/MCP**: Static API tokens (X-API-Key header). Each token has a name and can be revoked.

This is the pattern used by most self-hosted apps (Gitea, Portainer, Grafana) — web login for humans, API tokens for scripts.

### Implementation

**Backend changes:**
- Add `backend/auth.py`:
  - `POST /api/auth/login` — verify password against `.env` hash, set signed session cookie
  - `POST /api/auth/logout` — clear cookie
  - `GET /api/auth/keys` — list API tokens (requires session)
  - `POST /api/auth/keys` — create new token (requires session)
  - `DELETE /api/auth/keys/{id}` — revoke token (requires session)
  - `require_auth` dependency — accepts EITHER a valid session cookie OR a valid X-API-Key header
- Add `itsdangerous` (signed cookies) and `passlib[bcrypt]` to `requirements.txt`
- Password hash stored in `.env` as `MNESTIC_PASSWORD_HASH`
- API tokens stored in SQLite (`mnestic_auth.db` with table: `id, name, key_hash, created_at, revoked`)
- Add `Depends(require_auth)` to every route except `/api/auth/login` and `/api/health`

**Frontend changes:**
- Add `/login` page with password form
- Next.js middleware: redirect to `/login` if no session cookie
- Session cookie is set by the backend on successful login — frontend just needs to include credentials
- Add API token management page (`/settings` or `/tokens`) — list, create, revoke
- `api.ts`: use `credentials: 'include'` on fetch calls (cookies sent automatically)

**MCP server:**
- `mcp_server.py` reads `MNESTIC_API_KEY` from env
- Passes it as `X-API-Key` header on all backend calls
- Hermes MCP config: `env: {"MNESTIC_API_KEY": "generated-token"}`

### Complexity: **Medium**
### Maintenance: **Low** — password rarely changes, tokens are self-managed via UI
### Security: Good — session cookies are signed and httpOnly (not vulnerable to XSS token theft), API tokens are revocable, password is hashed
### Fit for single-user: **Ideal** — one password for the web UI, a couple API tokens for MCP/scripts. Clean separation, no JWT complexity.
### MCP compatibility: **Perfect** — API token via env var, no interactive login needed

---

## Comparison Matrix

| Option | Complexity | Maintenance | MCP Compatible | Single-User Fit | Security |
|---|---|---|---|---|---|
| 1. FastAPI JWT | Medium | Low | Awkward | Overkill | Good |
| 2. Reverse Proxy | Low | Very Low | Poor | Good (web only) | Weak (API) |
| 3. API Key Only | Low | Very Low | Perfect | Excellent | Adequate |
| 4. Full OIDC | High | High | Poor | Overkill | Excellent |
| 5. Hybrid | Medium | Low | Perfect | Ideal | Good |

---

## Recommendation: Option 5 (Hybrid)

The hybrid approach is the best fit for Mnestic:

1. **Web UI gets a proper login** — password page, signed session cookie, no JWT complexity
2. **MCP and scripts get API tokens** — simple X-API-Key header, managed via env vars, revocable
3. **No external dependencies** — no IdP, no OAuth provider, just `itsdangerous` + `passlib`
4. **MCP works seamlessly** — token in env var → header on every call
5. **Future-proof** — if you ever share the app, each person gets their own password and tokens

### Token Storage: SQLite

Use a small SQLite database (`mnestic_auth.db`) for API tokens. Reasons:
- Already using SQLite-adjacent patterns (ChromaDB uses SQLite internally)
- Supports multiple tokens with metadata (name, creation date, revocation)
- Easy to query and manage
- No external service needed

**Schema:**
```sql
CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,          -- "MCP Server", "Hermes", "Script"
    key_hash TEXT NOT NULL,      -- SHA-256 hash of the token (never store plaintext)
    key_prefix TEXT NOT NULL,    -- First 8 chars for display (e.g., "mnes_abc...")
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked INTEGER DEFAULT 0
);
```

**Token format:** `mnes_<32 random hex chars>` — prefix makes tokens identifiable, random part provides entropy.

### Token Rotation/Revocation

- **Revoke**: `DELETE /api/auth/keys/{id}` sets `revoked=1`. Token immediately stops working.
- **Rotate**: Create new token, update env var, verify works, revoke old token.
- **Last used tracking**: Update `last_used_at` on each successful auth. Helps identify stale tokens.

### Implementation Plan (Ordered)

1. **`backend/auth.py`** — password verification, session cookie signing, API token validation, `require_auth` dependency
2. **`backend/config.py`** — add `MNESTIC_PASSWORD_HASH`, `SESSION_SECRET` settings
3. **`backend/main.py`** — add auth routes, apply `Depends(require_auth)` to all existing routes
4. **`backend/mcp_server.py`** — read `MNESTIC_API_KEY` from env, add `X-API-Key` header to all backend calls
5. **Frontend `/login` page** — password form, POST to `/api/auth/login`, redirect on success
6. **Frontend middleware** — redirect to `/login` if no session cookie
7. **Frontend `api.ts`** — add `credentials: 'include'` to all fetch calls
8. **Frontend `/settings` page** — API token management (list, create, revoke)
9. **`.env`** — add `MNESTIC_PASSWORD_HASH`, `SESSION_SECRET`, `MNESTIC_API_KEY`
10. **Docker** — ensure session cookie works behind Tailscale Serve proxy (may need `SameSite=Lax`)

### Estimated Effort
- Backend: ~200 lines of new code in `auth.py`, ~20 lines changed in `main.py`, ~30 lines in `mcp_server.py`
- Frontend: ~150 lines (login page, middleware, token management page, api.ts changes)
- Config: 3 new env vars
- Testing: ~100 lines of auth tests
- **Total: ~1-2 hours of focused work**

---

## FastAPI Auth Libraries Reference

| Library | Purpose | Notes |
|---|---|---|
| `python-jose[cryptography]` | JWT creation/verification | Only needed for Option 1 |
| `passlib[bcrypt]` | Password hashing | Needed for Options 1, 5 |
| `itsdangerous` | Signed cookies/sessions | Needed for Option 5 (web UI session) |
| `fastapi-security` | Permission/scoping helpers | Optional, adds complexity |
| `authlib` | OAuth2/OIDC client | Only needed for Option 4 |

For Option 5, only `passlib[bcrypt]` and `itsdangerous` are needed — both are lightweight, well-maintained, and have no external dependencies.

---

## Next.js Login Page Patterns

For Next.js App Router (which Mnestic uses):

1. **Server Component login page** — `app/login/page.tsx` renders a form that POSTs to the backend. On success, the backend sets a signed cookie. Simple, no client-side state.

2. **Middleware protection** — `middleware.ts` checks for session cookie on every route. If missing, redirect to `/login`. Runs on the edge before page rendering.

3. **API client changes** — `fetchAPI()` in `lib/api.ts` adds `credentials: 'include'` so cookies are sent with every request. No manual token management needed for the web UI.

```typescript
// lib/api.ts change
async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',  // ← add this
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Authentication required');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```
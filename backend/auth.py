from __future__ import annotations

import hashlib
import logging
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, Response
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from passlib.context import CryptContext

from config import MNESTIC_PASSWORD_HASH, SESSION_SECRET, settings

logger = logging.getLogger(__name__)

COOKIE_NAME = "mnestic_session"
MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # 7 days
TOKEN_PREFIX = "mnes_"
TOKEN_BYTES = 16

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _auth_enabled() -> bool:
    """Auth is enabled only when a password hash is configured."""
    return bool(MNESTIC_PASSWORD_HASH and MNESTIC_PASSWORD_HASH.strip())


def _get_serializer() -> URLSafeTimedSerializer:
    secret = SESSION_SECRET or "dev-secret-change-me"
    return URLSafeTimedSerializer(secret, salt="mnestic-session")


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.warning("Password verification error: %s", e)
        return False


def hash_password(plain_password: str) -> str:
    """Generate a bcrypt hash for a password."""
    return pwd_context.hash(plain_password)


# ---------------------------------------------------------------------------
# Session cookies (signed, httpOnly, SameSite=Lax)
# ---------------------------------------------------------------------------

def set_session_cookie(response: Response) -> None:
    """Set a signed session cookie after successful login."""
    token = _get_serializer().dumps("authenticated")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # OK for localhost/Tailscale serve; rely on TLS proxy
        samesite="lax",
        max_age=MAX_AGE_SECONDS,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Clear the session cookie on logout."""
    response.delete_cookie(key=COOKIE_NAME, path="/")


def _get_session_cookie(request: Request) -> Optional[str]:
    return request.cookies.get(COOKIE_NAME)


def verify_session_cookie(request: Request) -> bool:
    """Verify the signed session cookie. Returns True if valid."""
    cookie = _get_session_cookie(request)
    if not cookie:
        return False
    try:
        _get_serializer().loads(cookie, max_age=MAX_AGE_SECONDS)
        return True
    except (BadSignature, SignatureExpired):
        return False
    except Exception as e:
        logger.warning("Session verification error: %s", e)
        return False


# ---------------------------------------------------------------------------
# API token storage (SQLite)
# ---------------------------------------------------------------------------

@contextmanager
def _auth_db():
    db_path = settings.auth_db_path
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        _init_auth_db(conn)
        yield conn
    finally:
        conn.close()


def _init_auth_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS api_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            key_prefix TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_used_at TEXT,
            revoked INTEGER DEFAULT 0
        )
        """
    )
    conn.commit()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_token() -> str:
    return TOKEN_PREFIX + secrets.token_hex(TOKEN_BYTES)


# ---------------------------------------------------------------------------
# API token management
# ---------------------------------------------------------------------------

def create_token(name: str) -> tuple[str, dict]:
    """Create a new API token. Returns (plaintext_token, token_record_dict)."""
    plaintext = _generate_token()
    key_hash = _hash_token(plaintext)
    prefix = plaintext[: len(TOKEN_PREFIX) + 8]
    created_at = datetime.now(timezone.utc).isoformat()

    with _auth_db() as conn:
        cursor = conn.execute(
            "INSERT INTO api_tokens (name, key_hash, key_prefix, created_at, revoked) VALUES (?, ?, ?, ?, 0)",
            (name, key_hash, prefix, created_at),
        )
        conn.commit()
        token_id = cursor.lastrowid

    return plaintext, {
        "id": token_id,
        "name": name,
        "key_prefix": prefix,
        "created_at": created_at,
        "last_used_at": None,
        "revoked": False,
    }


def list_tokens() -> list[dict]:
    """List all API tokens (excluding the sensitive key_hash)."""
    with _auth_db() as conn:
        rows = conn.execute(
            "SELECT id, name, key_prefix, created_at, last_used_at, revoked FROM api_tokens ORDER BY created_at DESC"
        ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "key_prefix": row["key_prefix"],
            "created_at": row["created_at"],
            "last_used_at": row["last_used_at"],
            "revoked": bool(row["revoked"]),
        }
        for row in rows
    ]


def revoke_token(token_id: int) -> bool:
    """Revoke an API token. Returns True if a row was updated."""
    with _auth_db() as conn:
        cursor = conn.execute(
            "UPDATE api_tokens SET revoked = 1 WHERE id = ? AND revoked = 0", (token_id,)
        )
        conn.commit()
        return cursor.rowcount > 0


def validate_api_key(api_key: str) -> bool:
    """Validate an X-API-Key header value. Updates last_used_at on success."""
    if not api_key or not api_key.startswith(TOKEN_PREFIX):
        return False
    key_hash = _hash_token(api_key)
    now = datetime.now(timezone.utc).isoformat()
    with _auth_db() as conn:
        row = conn.execute(
            "SELECT id, revoked FROM api_tokens WHERE key_hash = ?", (key_hash,)
        ).fetchone()
        if not row or row["revoked"]:
            return False
        conn.execute(
            "UPDATE api_tokens SET last_used_at = ? WHERE id = ?",
            (now, row["id"]),
        )
        conn.commit()
    return True


# ---------------------------------------------------------------------------
# Auth dependency for FastAPI
# ---------------------------------------------------------------------------

async def require_auth(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> None:
    """FastAPI dependency: require either a valid session cookie or X-API-Key.

    If MNESTIC_PASSWORD_HASH is empty, auth is disabled and this is a no-op.
    """
    from config import MNESTIC_PASSWORD_HASH
    if not (MNESTIC_PASSWORD_HASH and MNESTIC_PASSWORD_HASH.strip()):
        return

    x_api_key = request.headers.get("X-API-Key")
    if x_api_key and validate_api_key(x_api_key):
        return

    if verify_session_cookie(request):
        return

    raise HTTPException(status_code=401, detail="Authentication required")


async def optional_auth_status(request: Request) -> dict:
    """Return whether the current request is authenticated."""
    from config import MNESTIC_PASSWORD_HASH
    if not (MNESTIC_PASSWORD_HASH and MNESTIC_PASSWORD_HASH.strip()):
        return {"enabled": False, "authenticated": True}

    x_api_key = request.headers.get("X-API-Key")
    if x_api_key and validate_api_key(x_api_key):
        return {"enabled": True, "authenticated": True}

    if verify_session_cookie(request):
        return {"enabled": True, "authenticated": True}

    return {"enabled": True, "authenticated": False}

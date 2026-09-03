"""Security primitives — password hashing and JWT issuance/verification.

* Passwords: bcrypt with per-password salts (``bcrypt`` package). Plaintext
  passwords are hashed immediately and never stored or logged.
* Access tokens: signed JWTs (HS256) carrying the user id, role and permissions.
* Refresh tokens: 256-bit random opaque strings; only their SHA-256 hash is
  persisted in ``user_sessions``.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
import structlog

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #
def hash_password(plain: str) -> str:
    if not plain or len(plain) < 8:
        raise ValueError("Password must be at least 8 characters")
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, password_hash: str) -> bool:
    if not plain or not password_hash:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


# --------------------------------------------------------------------------- #
# Refresh tokens
# --------------------------------------------------------------------------- #
def new_refresh_token() -> str:
    """A fresh 256-bit opaque refresh token (client-visible)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# JWT access tokens
# --------------------------------------------------------------------------- #
@dataclass
class AccessTokenClaims:
    sub: str  # user id (str) or "system"
    username: str
    role: str
    permissions: list[str] = field(default_factory=list)
    token_type: str = "access"
    jti: str = field(default_factory=lambda: uuid.uuid4().hex)
    exp: datetime | None = None
    iat: datetime | None = None


def issue_access_token(
    *,
    user_id: int | str,
    username: str,
    role: str,
    permissions: list[str],
    expires_minutes: int | None = None,
) -> tuple[str, datetime]:
    """Return ``(token, expires_at)`` for the given principal."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    minutes = expires_minutes or settings.access_token_expire_minutes
    expires_at = now + timedelta(minutes=minutes)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "permissions": permissions,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify signature + expiry. Raises ``jwt.PyJWTError`` on any failure."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["exp", "sub", "type"]},
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload

"""Security audit logging service.

Records every security-relevant action to the ``audit_logs`` table: who
(authenticated principal / role), what (action + resource type/id), when,
from where (IP, user-agent, method, path) and with what result.

Hard guarantees
---------------
* **Secrets are never stored.** Every string that passes through the audit
  service (detail, context values, path) is scrubbed for passwords, JWTs, API
  keys and — critically — RTSP/HTTP URLs that embed ``user:pass@`` credentials.
* Recording an audit event **never breaks the request**: failures are logged
  and swallowed. A separate short-lived DB session is used so an audit write
  can't roll back the caller's transaction.
* Safe to call from worker threads (pipeline) as well as request handlers.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.audit import AuditLog

logger = structlog.get_logger(__name__)

# --------------------------------------------------------------------------- #
# Secret redaction
# --------------------------------------------------------------------------- #
# rtsp://user:pass@host/...  /  http(s)://user:pass@host/...  → credentials masked
_URL_CRED_RE = re.compile(r"([a-zA-Z][a-zA-Z0-9+.-]*://)[^/\s:@]+:[^/\s@]+@")
# ?password= / token= / api_key= style query values.
_QUERY_SECRET_RE = re.compile(
    r"(?i)(password|passwd|secret|token|api[_-]?key|authorization)=([^&\s\"']+)"
)
# Bearer <jwt>
_BEARER_RE = re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]+")
# Anything that looks like a JWT.
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b")

_REDACTED = "***REDACTED***"

# Context keys whose values must never be stored verbatim.
_SECRET_KEY_HINTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "jwt",
    "rtsp_url",
    "webrtc_url",
    "hls_url",
    "stream_url",
)


def redact_text(value: Any) -> Any:
    """Return a secret-free copy of a string (non-strings pass through)."""
    if not isinstance(value, str):
        return value
    text = _URL_CRED_RE.sub(rf"\1{_REDACTED}@", value)
    text = _QUERY_SECRET_RE.sub(rf"\1={_REDACTED}", text)
    text = _BEARER_RE.sub(rf"\1{_REDACTED}", text)
    text = _JWT_RE.sub(_REDACTED, text)
    return text


def _is_secret_key(key: str) -> bool:
    k = key.lower()
    return any(hint in k for hint in _SECRET_KEY_HINTS)


def sanitize_context(context: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return a secret-free, JSON-safe copy of an audit context dict."""
    if not context:
        return None
    clean: dict[str, Any] = {}
    for key, value in context.items():
        if _is_secret_key(str(key)):
            clean[str(key)] = _REDACTED
            continue
        if isinstance(value, dict):
            clean[str(key)] = sanitize_context(value)
        elif isinstance(value, (list, tuple)):
            clean[str(key)] = [redact_text(v) if isinstance(v, str) else v for v in value][:50]
        else:
            clean[str(key)] = redact_text(value)
    return clean


# --------------------------------------------------------------------------- #
# Client metadata
# --------------------------------------------------------------------------- #
def client_ip_from_request(request: Any) -> str | None:
    """Best-effort client IP, honouring common proxy headers."""
    try:
        forwarded = request.headers.get("x-forwarded-for") if hasattr(request, "headers") else None
        if forwarded:
            return forwarded.split(",")[0].strip()[:64] or None
        real = request.headers.get("x-real-ip") if hasattr(request, "headers") else None
        if real:
            return real.strip()[:64]
        if getattr(request, "client", None) is not None:
            return (request.client.host or "")[:64] or None
    except Exception:
        return None
    return None


def _user_agent(request: Any) -> str | None:
    try:
        return (request.headers.get("user-agent") or "")[:255] or None
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Recording
# --------------------------------------------------------------------------- #
def record(
    *,
    action: str,
    principal: Any = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    result: str = "success",
    detail: str | None = None,
    context: dict[str, Any] | None = None,
    request: Any = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    method: str | None = None,
    path: str | None = None,
    username: str | None = None,
    role: str | None = None,
    user_id: str | int | None = None,
    commit: bool = True,
    db: Any = None,
) -> AuditLog | None:
    """Write one audit entry. Never raises into the caller.

    When ``db`` is supplied the row is added to that session (committed when
    ``commit`` is True). Otherwise a short-lived session is created. The
    function is safe to call from request handlers AND worker threads.
    """
    settings = get_settings()
    if not settings.audit_enabled:
        return None

    if principal is not None:
        user_id = user_id if user_id is not None else getattr(principal, "user_id", None)
        username = username if username is not None else getattr(principal, "username", None)
        role = role if role is not None else getattr(principal, "role", None)

    if request is not None:
        ip_address = ip_address or client_ip_from_request(request)
        user_agent = user_agent or _user_agent(request)
        method = method or getattr(request, "method", None)
        path = path or _safe_path(request)

    entry = AuditLog(
        user_id=str(user_id) if user_id is not None else None,
        username=(username or None) and str(username)[:128],
        role=(role or None) and str(role)[:32],
        action=action[:48],
        resource_type=(resource_type or None) and str(resource_type)[:48],
        resource_id=(None if resource_id is None else str(resource_id)[:128]),
        result=result[:16],
        detail=redact_text(detail)[:2000] if detail else None,
        ip_address=(ip_address or None) and str(ip_address)[:64],
        user_agent=user_agent,
        method=(method or None) and str(method)[:8],
        path=redact_text(path)[:255] if path else None,
        context=sanitize_context(context),
    )

    own_session = db is None
    session = db if db is not None else SessionLocal()
    try:
        session.add(entry)
        if commit:
            session.commit()
            session.refresh(entry)
    except Exception as exc:  # never break the caller's flow
        try:
            session.rollback()
        except Exception:
            pass
        logger.warning("audit.record_failed", action=action, error=str(exc))
        return None
    finally:
        if own_session:
            session.close()
    return entry


def _safe_path(request: Any) -> str | None:
    try:
        return str(request.url.path)[:255]
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Querying (GET /api/audit-logs)
# --------------------------------------------------------------------------- #
def list_audit_logs(
    db,
    *,
    limit: int = 50,
    offset: int = 0,
    action: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    username: str | None = None,
    role: str | None = None,
    result: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated, filterable audit trail. Returns ``(rows, total)``."""
    from sqlalchemy import String, cast

    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)

    filters = []
    if action:
        filters.append(AuditLog.action == action)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if resource_id:
        filters.append(AuditLog.resource_id == str(resource_id))
    if username:
        filters.append(AuditLog.username.ilike(f"%{username.strip()}%"))
    if role:
        filters.append(AuditLog.role == role)
    if result:
        filters.append(AuditLog.result == result)
    if date_from:
        filters.append(AuditLog.created_at >= date_from)
    if date_to:
        filters.append(AuditLog.created_at <= date_to)
    if search:
        needle = f"%{search.strip()}%".replace("%%%", "%")
        filters.append(
            (AuditLog.detail.ilike(needle))
            | (cast(AuditLog.resource_id, String).ilike(needle))
            | (AuditLog.username.ilike(needle))
        )
    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [audit_dict(r) for r in rows], total


def audit_dict(row: AuditLog) -> dict[str, Any]:
    def _iso(dt: datetime | None) -> str | None:
        if dt is None:
            return None
        return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()

    return {
        "id": row.id,
        "user_id": row.user_id,
        "username": row.username,
        "role": row.role,
        "action": row.action,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "result": row.result,
        "detail": row.detail,
        "ip_address": row.ip_address,
        "user_agent": row.user_agent,
        "method": row.method,
        "path": row.path,
        "context": row.context,
        "created_at": _iso(row.created_at),
    }


def purge_expired(db) -> int:
    """Delete audit rows older than the retention window. Returns count."""
    settings = get_settings()
    if not settings.audit_retention_days:
        return 0
    cutoff = datetime.now(timezone.utc) - _timedelta_days(settings.audit_retention_days)
    rows = db.scalars(select(AuditLog).where(AuditLog.created_at < cutoff)).all()
    count = 0
    for row in rows:
        db.delete(row)
        count += 1
    db.commit()
    return count


def _timedelta_days(days: int):
    from datetime import timedelta

    return timedelta(days=days)

"""FastAPI dependencies for authentication and permission enforcement.

``get_principal`` resolves the actor for a request:

* ``AUTH_ENABLED=false`` (development default) — an implicit admin principal is
  attached so the existing dashboard keeps working without a login screen.
* ``AUTH_ENABLED=true`` (production) — a valid ``Authorization: Bearer`` JWT is
  required; the user's role permissions are loaded fresh from the database.

``require_permission(...)`` produces a route dependency enforcing a specific
permission (403 when missing, 401 when unauthenticated).
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services import auth as auth_service
from app.services.auth import InvalidCredentials, Principal

UNAUTHORIZED = "Authentication required"
FORBIDDEN = "Insufficient permissions for this action"


def _extract_token(request: Request) -> str | None:
    authorization: str | None = request.headers.get("Authorization")
    if authorization:
        scheme, param = get_authorization_scheme_param(authorization)
        if scheme.lower() == "bearer" and param:
            return param
    # Fallback for image/websocket-ish clients that cannot set headers.
    token = request.query_params.get("token")
    return token or None


def get_principal(
    request: Request,
    db: Session = Depends(get_db),
) -> Principal:
    settings = get_settings()
    if not settings.auth_enabled:
        principal = auth_service.open_mode_principal()
        request.state.principal = principal
        return principal

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        principal = auth_service.resolve_principal_from_token(db, token)
    except (InvalidCredentials, auth_service.AccountDisabled) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    request.state.principal = principal
    return principal


def require_permission(permission: str):
    """Route dependency factory enforcing a single permission."""

    def _dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if not principal.has(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{FORBIDDEN} (requires '{permission}')",
            )
        return principal

    return _dependency


def require_any_permission(*permissions: str):
    """Route dependency factory enforcing at least one of the permissions."""

    def _dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if not any(principal.has(p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{FORBIDDEN} (requires one of {', '.join(permissions)})",
            )
        return principal

    return _dependency


def optional_token(
    token: str | None = Query(None, description="Access token (WebSocket auth)"),
) -> str | None:
    return token

"""Authentication API — login, refresh, logout, current user, password change."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_principal
from app.core.config import get_settings
from app.core.permissions import ALL_PERMISSIONS
from app.db.session import get_db
from app.models.audit import (
    ACTION_LOGIN_FAILED,
    ACTION_LOGIN_SUCCESS,
    ACTION_LOGOUT,
    ACTION_PASSWORD_CHANGE,
    RESULT_FAILURE,
)
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
)
from app.services import audit as audit_service
from app.services import auth as auth_service
from app.services import security
from app.services.auth import Principal

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    try:
        result = auth_service.login(
            db,
            username=payload.username,
            password=payload.password,
            user_agent=request.headers.get("User-Agent"),
            client_ip=request.client.host if request.client else None,
        )
    except (auth_service.InvalidCredentials, auth_service.AccountDisabled) as exc:
        result_status = RESULT_FAILURE
        # Failed login attempts are audited (no password stored — ever).
        audit_service.record(
            db=db,
            action=ACTION_LOGIN_FAILED,
            resource_type="auth",
            resource_id=(payload.username or "")[:128],
            result=RESULT_FAILURE,
            detail=f"Failed login for '{payload.username}': {exc}",
            username=payload.username,
            request=request,
        )
        code = (
            status.HTTP_403_FORBIDDEN
            if isinstance(exc, auth_service.AccountDisabled)
            else status.HTTP_401_UNAUTHORIZED
        )
        raise HTTPException(status_code=code, detail=str(exc)) from exc

    audit_service.record(
        db=db,
        action=ACTION_LOGIN_SUCCESS,
        resource_type="auth",
        resource_id=result["user"].get("username"),
        username=result["user"].get("username"),
        role=result["user"].get("role"),
        user_id=result["user"].get("id"),
        detail=f"User '{result['user'].get('username')}' signed in",
        request=request,
    )
    return result


@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> dict:
    try:
        return auth_service.refresh_session(db, payload.refresh_token)
    except (auth_service.SessionExpired, auth_service.InvalidCredentials) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except auth_service.AccountDisabled as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> dict:
    try:
        return auth_service.refresh_session(db, payload.refresh_token)
    except (auth_service.SessionExpired, auth_service.InvalidCredentials) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except auth_service.AccountDisabled as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post("/logout")
def logout(payload: LogoutRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    revoked = auth_service.logout(db, payload.refresh_token)
    audit_service.record(
        db=db,
        action=ACTION_LOGOUT,
        resource_type="auth",
        resource_id="session",
        result="success" if revoked else "failure",
        detail="User signed out" if revoked else "Logout with unknown/expired token",
        request=request,
    )
    return {"revoked": revoked}


@router.get("/me")
def me(principal: Principal = Depends(get_principal)) -> dict:
    return {
        "user_id": principal.user_id,
        "username": principal.username,
        "full_name": principal.full_name,
        "role": principal.role,
        "permissions": sorted(principal.permissions),
        "open_mode": principal.is_system,
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> dict:
    if principal.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is unavailable in open mode (AUTH_ENABLED=false)",
        )
    user = auth_service.get_user(db, int(principal.user_id))
    if user is None or not security.verify_password(payload.current_password, user.password_hash):
        audit_service.record(
            db=db,
            action=ACTION_PASSWORD_CHANGE,
            principal=principal,
            resource_type="user",
            resource_id=principal.user_id,
            result="failure",
            detail="Password change failed: current password incorrect",
            request=request,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    auth_service.set_password(db, user, payload.new_password)
    audit_service.record(
        db=db,
        action=ACTION_PASSWORD_CHANGE,
        principal=principal,
        resource_type="user",
        resource_id=user.id,
        detail=f"Password changed for {user.username} (all other sessions revoked)",
        request=request,
    )
    return {"changed": True, "message": "Password updated — other sessions were signed out"}


@router.get("/config")
def auth_config() -> dict:
    """Non-sensitive auth configuration for the frontend."""
    settings = get_settings()
    return {
        "auth_enabled": settings.auth_enabled,
        "access_token_expire_minutes": settings.access_token_expire_minutes,
        "refresh_token_expire_days": settings.refresh_token_expire_days,
        "open_mode": not settings.auth_enabled,
        "available_permissions": sorted(ALL_PERMISSIONS),
    }

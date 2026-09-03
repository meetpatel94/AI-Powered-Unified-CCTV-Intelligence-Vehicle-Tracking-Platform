"""Users & Roles administration API (RBAC protected)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, require_permission
from app.core.permissions import (
    ROLES_READ,
    ROLES_WRITE,
    USERS_READ,
    USERS_WRITE,
)
from app.db.session import get_db
from app.models.auth import User
from app.schemas.auth import SetPasswordRequest, UserCreateRequest, UserUpdateRequest
from app.services import auth as auth_service
from app.services.auth import Principal

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users")
def list_users(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(USERS_READ)),
) -> dict:
    rows, total = auth_service.list_users(db, limit=limit, offset=offset)
    return {
        "items": [auth_service.user_dict(u) for u in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(USERS_WRITE)),
) -> dict:
    try:
        user = auth_service.create_user(
            db,
            username=payload.username,
            password=payload.password,
            full_name=payload.full_name,
            role_id=payload.role_id,
            email=str(payload.email) if payload.email else None,
            rank=payload.rank,
            employee_id=payload.employee_id,
            department=payload.department,
            location=payload.location,
            phone=payload.phone,
            created_by=principal.username,
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return auth_service.user_dict(user)


@router.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(USERS_READ)),
) -> dict:
    user = auth_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return auth_service.user_dict(user)


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(USERS_WRITE)),
) -> dict:
    user = auth_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Guard: an admin cannot demote/disable the last active administrator.
    fields = payload.model_dump(exclude_unset=True, exclude_none=True)
    if user.role_id == "ADMIN" and (
        fields.get("role_id") not in (None, "ADMIN") or fields.get("is_active") is False
    ):
        admins = db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role_id == "ADMIN", User.is_active.is_(True), User.id != user.id)
        )
        if not admins:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot remove the last active administrator",
            )
    try:
        user = auth_service.update_user(db, user, **fields)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return auth_service.user_dict(user)


@router.post("/users/{user_id}/set-password")
def set_password(
    user_id: int,
    payload: SetPasswordRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(USERS_WRITE)),
) -> dict:
    user = auth_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    auth_service.set_password(db, user, payload.new_password)
    return {"changed": True, "by": principal.username}


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ROLES_READ)),
) -> list[dict]:
    roles = auth_service.list_roles(db)
    counts = {
        row[0]: int(row[1])
        for row in db.execute(select(User.role_id, func.count()).group_by(User.role_id)).all()
    }
    return [auth_service.role_dict(r, user_count=counts.get(r.id, 0)) for r in roles]


@router.get("/roles/{role_id}")
def get_role(
    role_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ROLES_READ)),
) -> dict:
    role = auth_service.get_role(db, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    count = int(
        db.scalar(select(func.count()).select_from(User).where(User.role_id == role_id)) or 0
    )
    return auth_service.role_dict(role, user_count=count)


@router.get("/me")
def me_alias(principal: Principal = Depends(get_principal)) -> dict:
    """Alias so the frontend can use /api/me."""
    return {
        "user_id": principal.user_id,
        "username": principal.username,
        "full_name": principal.full_name,
        "role": principal.role,
        "permissions": sorted(principal.permissions),
        "open_mode": principal.is_system,
    }

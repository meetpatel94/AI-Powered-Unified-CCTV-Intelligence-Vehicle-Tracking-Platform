"""Authentication + user/role management service.

Implements login (password verification → JWT + refresh session), refresh,
logout, the current-user payload and the user/role CRUD the Users & Roles
screen consumes. Role permissions come from ``core/permissions.py`` and are
seeded/refreshed into the ``roles`` table on startup.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import ROLE_DEFINITIONS, SYSTEM_ROLES
from app.models.auth import Role, User, UserSession
from app.services import security

logger = structlog.get_logger(__name__)


class AuthError(Exception):
    """Base class — maps to 401/403/404 responses in the API layer."""


class InvalidCredentials(AuthError):
    pass


class AccountDisabled(AuthError):
    pass


class UsernameTaken(AuthError):
    pass


class SessionExpired(AuthError):
    pass


@dataclass
class Principal:
    """The authenticated (or implicit open-mode) actor attached to a request."""

    user_id: int | str
    username: str
    full_name: str
    role: str
    permissions: set[str] = field(default_factory=set)
    is_system: bool = False  # True for the implicit open-mode principal

    @property
    def display_name(self) -> str:
        return self.full_name or self.username

    def has(self, permission: str) -> bool:
        return permission in self.permissions


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Roles
# --------------------------------------------------------------------------- #
def seed_roles(db: Session) -> int:
    """Upsert the system roles + default permission matrix. Returns count."""
    count = 0
    for role_id in SYSTEM_ROLES:
        definition = ROLE_DEFINITIONS[role_id]
        role = db.get(Role, role_id)
        if role is None:
            role = Role(id=role_id, name=definition["name"], is_system=True)
            db.add(role)
        role.name = definition["name"]
        role.description = definition["description"]
        role.permissions = list(definition["permissions"])
        role.is_system = True
        count += 1
    db.commit()
    return count


def list_roles(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.id)).all())


def get_role(db: Session, role_id: str) -> Role | None:
    if role_id not in SYSTEM_ROLES:
        return None
    return db.get(Role, role_id)


def role_dict(role: Role, user_count: int | None = None) -> dict[str, Any]:
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "permissions": list(role.permissions or []),
        "is_system": role.is_system,
        "user_count": user_count,
        "created_at": _as_iso(role.created_at),
        "updated_at": _as_iso(role.updated_at),
    }


def _as_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
def create_user(
    db: Session,
    *,
    username: str,
    password: str,
    full_name: str,
    role_id: str,
    email: str | None = None,
    rank: str | None = None,
    employee_id: str | None = None,
    department: str | None = None,
    location: str | None = None,
    phone: str | None = None,
    created_by: str | None = None,
    is_active: bool = True,
) -> User:
    username = username.strip().lower()
    if not username:
        raise AuthError("Username is required")
    if db.scalar(select(User).where(User.username == username)) is not None:
        raise UsernameTaken(f"Username '{username}' already exists")
    if role_id not in SYSTEM_ROLES:
        raise AuthError(f"Unknown role '{role_id}'")
    user = User(
        username=username,
        email=(email or None) or None,
        full_name=full_name.strip() or username,
        rank=rank,
        employee_id=employee_id,
        department=department,
        location=location,
        phone=phone,
        password_hash=security.hash_password(password),
        role_id=role_id,
        is_active=is_active,
        created_by=created_by,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("auth.user.created", username=username, role=role_id, by=created_by)
    return user


def list_users(db: Session, *, limit: int = 100, offset: int = 0) -> tuple[list[User], int]:
    total = int(db.scalar(select(func.count()).select_from(User)) or 0)
    rows = db.scalars(
        select(User).order_by(User.id).limit(limit).offset(offset)
    ).all()
    return list(rows), total


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.strip().lower()))


def update_user(
    db: Session,
    user: User,
    *,
    full_name: str | None = None,
    email: str | None = None,
    rank: str | None = None,
    employee_id: str | None = None,
    department: str | None = None,
    location: str | None = None,
    phone: str | None = None,
    role_id: str | None = None,
    is_active: bool | None = None,
) -> User:
    if role_id is not None:
        if role_id not in SYSTEM_ROLES:
            raise AuthError(f"Unknown role '{role_id}'")
        user.role_id = role_id
    if full_name is not None:
        user.full_name = full_name.strip() or user.full_name
    if email is not None:
        user.email = email or None
    if rank is not None:
        user.rank = rank or None
    if employee_id is not None:
        user.employee_id = employee_id or None
    if department is not None:
        user.department = department or None
    if location is not None:
        user.location = location or None
    if phone is not None:
        user.phone = phone or None
    if is_active is not None:
        user.is_active = is_active
    db.commit()
    db.refresh(user)
    logger.info("auth.user.updated", username=user.username)
    return user


def set_password(db: Session, user: User, new_password: str) -> None:
    user.password_hash = security.hash_password(new_password)
    db.commit()
    # Invalidate all refresh sessions — force re-login everywhere.
    now = _utcnow()
    for session in db.scalars(select(UserSession).where(UserSession.user_id == user.id)).all():
        if session.revoked_at is None and session.expires_at > now:
            session.revoked_at = now
    db.commit()


def user_dict(user: User, *, include_permissions: bool = True) -> dict[str, Any]:
    role = user.role
    data: dict[str, Any] = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "rank": user.rank,
        "employee_id": user.employee_id,
        "department": user.department,
        "location": user.location,
        "phone": user.phone,
        "role": role.id if role else None,
        "role_name": role.name if role else None,
        "is_active": user.is_active,
        "last_login_at": _as_iso(user.last_login_at),
        "created_at": _as_iso(user.created_at),
        "created_by": user.created_by,
    }
    if include_permissions and role is not None:
        data["permissions"] = sorted(set(role.permissions or []))
    return data


def principal_from_user(user: User) -> Principal:
    role = user.role
    return Principal(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=role.id if role else "VIEWER",
        permissions=set(role.permissions or []) if role else set(),
    )


# --------------------------------------------------------------------------- #
# Login / refresh / logout
# --------------------------------------------------------------------------- #
def login(
    db: Session, *, username: str, password: str, user_agent: str | None = None, client_ip: str | None = None
) -> dict[str, Any]:
    user = get_user_by_username(db, username)
    if user is None or not security.verify_password(password, user.password_hash):
        logger.warning("auth.login.failed", username=username)
        raise InvalidCredentials("Invalid username or password")
    if not user.is_active:
        raise AccountDisabled("Account is disabled")
    return _issue_session(db, user, user_agent=user_agent, client_ip=client_ip)


def refresh_session(db: Session, refresh_token: str) -> dict[str, Any]:
    token_hash = security.hash_refresh_token(refresh_token)
    session = db.scalar(select(UserSession).where(UserSession.refresh_token_hash == token_hash))
    now = _utcnow()
    if session is None or session.revoked_at is not None:
        raise SessionExpired("Refresh token is invalid")
    if session.expires_at <= now:
        raise SessionExpired("Refresh token expired")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise AccountDisabled("Account is disabled")

    # Rotate: revoke the old session, issue a fresh pair.
    session.revoked_at = now
    payload = _issue_session(db, user)
    logger.info("auth.session.refreshed", user_id=user.id)
    return payload


def logout(db: Session, refresh_token: str | None) -> bool:
    if not refresh_token:
        return False
    token_hash = security.hash_refresh_token(refresh_token)
    session = db.scalar(select(UserSession).where(UserSession.refresh_token_hash == token_hash))
    if session is None or session.revoked_at is not None:
        return False
    session.revoked_at = _utcnow()
    db.commit()
    logger.info("auth.session.revoked", user_id=session.user_id)
    return True


def _issue_session(
    db: Session, user: User, *, user_agent: str | None = None, client_ip: str | None = None
) -> dict[str, Any]:
    settings = get_settings()
    principal = principal_from_user(user)
    access_token, expires_at = security.issue_access_token(
        user_id=user.id,
        username=user.username,
        role=principal.role,
        permissions=sorted(principal.permissions),
    )
    refresh_token = security.new_refresh_token()
    now = _utcnow()
    user.last_login_at = now
    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=security.hash_refresh_token(refresh_token),
            issued_at=now,
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
            user_agent=(user_agent or "")[:255] or None,
            client_ip=(client_ip or "")[:64] or None,
        )
    )
    db.commit()
    logger.info("auth.login.success", username=user.username, role=principal.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_at": expires_at.isoformat(),
        "refresh_token": refresh_token,
        "user": user_dict(user),
    }


def resolve_principal_from_token(db: Session, token: str) -> Principal:
    """Validate an access token and rebuild the Principal (fresh permissions)."""
    try:
        payload = security.decode_access_token(token)
    except Exception as exc:
        raise InvalidCredentials("Invalid or expired access token") from exc
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise AccountDisabled("Account is disabled")
    return principal_from_user(user)


def open_mode_principal() -> Principal:
    """The implicit principal used when AUTH_ENABLED=false (development)."""
    from app.core.permissions import ALL_PERMISSIONS

    return Principal(
        user_id="system",
        username="open-mode",
        full_name="Open Mode (AUTH_ENABLED=false)",
        role="ADMIN",
        permissions=set(ALL_PERMISSIONS),
        is_system=True,
    )


# --------------------------------------------------------------------------- #
# Startup bootstrap
# --------------------------------------------------------------------------- #
def bootstrap_auth(db: Session) -> dict[str, Any]:
    """Seed system roles and (optionally) the first admin. Idempotent."""
    roles = seed_roles(db)
    created_admin = False
    settings = get_settings()
    username = settings.bootstrap_admin_username.strip()
    password = settings.bootstrap_admin_password
    if username and password:
        if get_user_by_username(db, username) is None and db.scalar(select(func.count()).select_from(User)) == 0:
            create_user(
                db,
                username=username,
                password=password,
                full_name=settings.bootstrap_admin_full_name or "System Administrator",
                role_id="ADMIN",
                email=settings.bootstrap_admin_email or None,
                created_by="bootstrap",
            )
            created_admin = True
            logger.info("auth.bootstrap.admin_created", username=username)
    return {"roles": roles, "admin_created": created_admin}


def generate_bootstrap_password() -> str:
    return secrets.token_urlsafe(12)

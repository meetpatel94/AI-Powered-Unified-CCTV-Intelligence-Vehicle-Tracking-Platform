"""Pydantic request/response models for the new intelligence modules."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=256)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    password: str = Field(min_length=8, max_length=256)
    full_name: str = Field(min_length=1, max_length=128)
    role_id: str = Field(min_length=2, max_length=32)
    email: EmailStr | None = None
    rank: str | None = Field(None, max_length=64)
    employee_id: str | None = Field(None, max_length=64)
    department: str | None = Field(None, max_length=128)
    location: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=32)


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(None, max_length=128)
    role_id: str | None = Field(None, max_length=32)
    email: EmailStr | None = None
    rank: str | None = Field(None, max_length=64)
    employee_id: str | None = Field(None, max_length=64)
    department: str | None = Field(None, max_length=128)
    location: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=32)
    is_active: bool | None = None


class SetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=256)


# --------------------------------------------------------------------------- #
# Watchlist
# --------------------------------------------------------------------------- #
class WatchlistEntryCreate(BaseModel):
    plate: str | None = Field(None, max_length=64, description="Vehicle plate (vehicle entries)")
    entry_type: str = Field("vehicle", pattern=r"^(vehicle|person|other)$")
    label: str | None = Field(None, max_length=255)
    alias: str | None = Field(None, max_length=255)
    description: str | None = Field(None, max_length=2000)
    category: str = Field(
        "others", pattern=r"^(stolen|wanted|suspect|missing|traffic|security|others)$"
    )
    priority: str = Field("medium", pattern=r"^(critical|high|medium|low)$")
    is_active: bool = True


class WatchlistEntryUpdate(BaseModel):
    plate: str | None = Field(None, max_length=64)
    label: str | None = Field(None, max_length=255)
    alias: str | None = Field(None, max_length=255)
    description: str | None = Field(None, max_length=2000)
    category: str | None = Field(
        None, pattern=r"^(stolen|wanted|suspect|missing|traffic|security|others)$"
    )
    priority: str | None = Field(None, pattern=r"^(critical|high|medium|low)$")
    is_active: bool | None = None


# --------------------------------------------------------------------------- #
# Alerts
# --------------------------------------------------------------------------- #
class AlertStatusRequest(BaseModel):
    status: str = Field(pattern=r"^(NEW|ACKNOWLEDGED|INVESTIGATING|ESCALATED|RESOLVED)$")
    note: str | None = Field(None, max_length=2000)


class AlertResolveRequest(BaseModel):
    note: str | None = Field(None, max_length=2000)


# --------------------------------------------------------------------------- #
# Investigation
# --------------------------------------------------------------------------- #
class CaseCreateRequest(BaseModel):
    subject_plate: str = Field(min_length=3, max_length=16)
    title: str = Field(min_length=3, max_length=255)
    priority: str = Field("medium", pattern=r"^(critical|high|medium|low)$")
    notes: str | None = Field(None, max_length=8000)
    officer: str | None = Field(None, max_length=128)
    evidence_ids: list[int] = Field(default_factory=list, max_length=200)


class CaseStatusRequest(BaseModel):
    status: str = Field(pattern=r"^(OPEN|IN_PROGRESS|CLOSED)$")


# --------------------------------------------------------------------------- #
# Generic pagination envelope
# --------------------------------------------------------------------------- #
class Page(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    items: list[Any]
    total: int
    limit: int
    offset: int

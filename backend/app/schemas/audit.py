"""Pydantic schemas for the security Audit Log."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    model_config = {"extra": "ignore"}

    id: int
    user_id: str | None = None
    username: str | None = None
    role: str | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    result: str
    detail: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    method: str | None = None
    path: str | None = None
    context: dict[str, Any] | None = None
    created_at: datetime | None = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int

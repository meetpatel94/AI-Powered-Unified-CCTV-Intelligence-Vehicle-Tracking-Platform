"""Security Audit Log API.

``GET /api/audit-logs`` is a paginated, filterable view of the immutable audit
trail. It is restricted to roles holding the ``audit:read`` permission
(ADMIN by default — the audit trail itself is sensitive). Sensitive
credentials are never stored and therefore never returned.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import AUDIT_READ
from app.db.session import get_db
from app.schemas.audit import AuditLogListResponse, AuditLogOut
from app.services import audit as audit_service
from app.services.auth import Principal

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None, max_length=48),
    resource_type: str | None = Query(None, max_length=48),
    resource_id: str | None = Query(None, max_length=128),
    username: str | None = Query(None, max_length=128),
    role: str | None = Query(None, max_length=32),
    result: str | None = Query(None, max_length=16),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    search: str | None = Query(None, max_length=200),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(AUDIT_READ)),
) -> AuditLogListResponse:
    rows, total = audit_service.list_audit_logs(
        db,
        limit=limit,
        offset=offset,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        username=username,
        role=role,
        result=result,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
        search=search,
    )
    return AuditLogListResponse(
        items=[AuditLogOut(**r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )

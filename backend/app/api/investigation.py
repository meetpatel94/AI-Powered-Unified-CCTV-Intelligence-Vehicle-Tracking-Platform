"""Investigation API — timeline, dossier and case management."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import INVESTIGATION_READ, INVESTIGATION_WRITE
from app.db.session import get_db
from app.models.audit import (
    ACTION_CASE_CREATE,
    ACTION_CASE_STATUS,
    ACTION_INVESTIGATION_ACCESS,
)
from app.schemas.auth import CaseCreateRequest, CaseStatusRequest
from app.services import audit as audit_service
from app.services import investigation as inv
from app.services.auth import Principal

router = APIRouter(prefix="/api/investigation", tags=["investigation"])


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("/search")
def search(
    q: str = Query(..., min_length=1, max_length=64),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(INVESTIGATION_READ)),
) -> list[dict]:
    """Vehicle identity search for the investigation target picker."""
    from app.services import vehicle_intel as vi

    return vi.search_vehicles(db, q, limit)


@router.get("/cases")
def list_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    plate: str | None = Query(None, max_length=16),
    status: str | None = Query(None, max_length=16),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(INVESTIGATION_READ)),
) -> dict:
    rows, total = inv.list_cases(db, limit=limit, offset=offset, plate=plate, status=status)
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@router.post("/cases", status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(INVESTIGATION_WRITE)),
) -> dict:
    try:
        case = inv.create_case(
            db,
            subject_plate=payload.subject_plate,
            title=payload.title,
            priority=payload.priority,
            notes=payload.notes,
            officer=payload.officer or principal.display_name,
            evidence_ids=payload.evidence_ids,
            created_by=principal.username,
        )
    except inv.InvestigationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_CASE_CREATE,
        principal=principal,
        resource_type="case",
        resource_id=case.case_number,
        detail=f"Case {case.case_number} opened for {case.subject_plate}: {case.title}",
        context={"subject_plate": case.subject_plate, "priority": case.priority,
                 "evidence_ids": payload.evidence_ids or []},
        request=request,
    )
    return inv.get_case(db, case.case_number) or inv.case_dict(case)


@router.get("/cases/{case_number}")
def get_case(
    case_number: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(INVESTIGATION_READ)),
) -> dict:
    case = inv.get_case(db, case_number)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case


@router.patch("/cases/{case_number}/status")
def update_case_status(
    case_number: str,
    payload: CaseStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(INVESTIGATION_WRITE)),
) -> dict:
    case = inv.get_case_row(db, case_number)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    from_status = case.status
    try:
        case = inv.update_case_status(db, case, payload.status, actor=principal.username)
    except inv.InvestigationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_CASE_STATUS,
        principal=principal,
        resource_type="case",
        resource_id=case.case_number,
        detail=f"Case {case.case_number} moved {from_status} → {case.status}",
        context={"from": from_status, "to": case.status, "subject_plate": case.subject_plate},
        request=request,
    )
    return inv.get_case(db, case.case_number) or inv.case_dict(case)


@router.get("/{plate}/timeline")
def timeline(
    plate: str,
    limit: int = Query(200, ge=1, le=1000),
    since: str | None = Query(None),
    until: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(INVESTIGATION_READ)),
) -> dict:
    """Unified chronological timeline (sightings, journeys, matches, alerts)."""
    items = inv.timeline_for_plate(db, plate, limit=limit, since=_parse(since), until=_parse(until))
    return {
        "plate": plate.upper().strip(),
        "count": len(items),
        "items": items,
    }


@router.get("/{plate}/dossier")
def dossier(
    plate: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(INVESTIGATION_READ)),
) -> dict:
    try:
        data = inv.dossier(db, plate)
    except inv.InvestigationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    # Accessing a subject's full dossier is sensitive — record it.
    audit_service.record(
        db=db,
        action=ACTION_INVESTIGATION_ACCESS,
        principal=principal,
        resource_type="investigation_dossier",
        resource_id=plate.upper().strip(),
        detail=f"Investigation dossier accessed for {plate.upper().strip()}",
        request=request,
    )
    return data

"""Intelligence Reports API — generated from real PostgreSQL data.

* ``GET  /api/reports``                 — paginated, filterable report list.
* ``POST /api/reports/generate``        — generate a report over real data.
* ``GET  /api/reports/{id}/preview``    — JSON preview (summary + first rows).
* ``GET  /api/reports/{id}/download``   — download the rendered CSV document.

Every report is audited (generation / preview / download). No secrets are
returned: reports contain only camera ids, locations, plates, timestamps,
events and evidence references.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import REPORTS_GENERATE, REPORTS_READ
from app.db.session import get_db
from app.schemas.report import (
    ReportGenerateRequest,
    ReportListResponse,
    ReportOut,
    ReportPreviewResponse,
)
from app.services import reports as report_service
from app.services.auth import Principal
from app.services.reports import ReportError

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid timestamp '{value}'")


@router.get("", response_model=ReportListResponse)
def list_reports(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(REPORTS_READ)),
) -> ReportListResponse:
    rows, total = report_service.list_reports(
        db,
        limit=limit,
        offset=offset,
        report_type=type,
        status=status_filter,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
    )
    return ReportListResponse(
        items=[ReportOut(**report_service.report_dict(r)) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/generate", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(
    payload: ReportGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(REPORTS_GENERATE)),
) -> ReportOut:
    try:
        report = report_service.create_report(
            db,
            name=payload.name or f"{payload.type} report",
            report_type=payload.type,
            date_from=payload.date_from,
            date_to=payload.date_to,
            camera_id=payload.camera_id,
            plate=payload.plate,
            alert_type=payload.alert_type,
            fmt=payload.format,
            classification=payload.classification,
            created_by=principal.username,
            created_by_role=principal.role,
            principal=principal,
            request=request,
        )
    except ReportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ReportOut(**report_service.report_dict(report))


@router.get("/{report_id}/preview", response_model=ReportPreviewResponse)
def preview_report(
    report_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(REPORTS_READ)),
) -> ReportPreviewResponse:
    report = report_service.get_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status == "failed":
        raise HTTPException(status_code=409, detail=f"Report generation failed: {report.error}")
    data = report_service.preview(db, report, principal=principal, request=request)
    return ReportPreviewResponse(**data)


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(REPORTS_READ)),
):
    report = report_service.get_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    path = report_service.resolve_file(db, report, principal=principal, request=request)
    if path is None:
        raise HTTPException(status_code=410, detail="Report document is no longer available")
    ext = "csv" if report.format == "CSV" else "json"
    filename = f"{report.report_id}-{report.type}.{ext}"
    return FileResponse(
        path,
        media_type="text/csv" if ext == "csv" else "application/json",
        filename=filename,
        headers={"Cache-Control": "private, max-age=300"},
    )

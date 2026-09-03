"""Dashboard KPIs + Analytics API (PostgreSQL aggregations, never fabricated)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import ANALYTICS_READ, DASHBOARD_READ
from app.db.session import get_db
from app.services import dashboard as dashboard_service
from app.services import vehicle_intel as vi
from app.services.auth import Principal

router = APIRouter(prefix="/api", tags=["dashboard"])


def _parse_since(since: str | None) -> datetime | None:
    if not since:
        return None
    try:
        return datetime.fromisoformat(since.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("/dashboard/kpis")
def kpis(
    hours: float = Query(24, ge=0.01, le=8760),
    since: str | None = Query(None, description="ISO timestamp override for the window start"),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DASHBOARD_READ)),
) -> dict:
    return dashboard_service.dashboard_kpis(db, hours=hours, since=_parse_since(since))


@router.get("/dashboard/activity")
def activity(
    hours: float = Query(24, ge=0.01, le=720),
    bucket: str = Query("hour", pattern=r"^(hour|day|minute)$"),
    since: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DASHBOARD_READ)),
) -> dict:
    return dashboard_service.activity_series(db, hours=hours, bucket=bucket, since=_parse_since(since))


@router.get("/dashboard/journeys")
def dashboard_journeys(
    limit: int = Query(6, ge=1, le=25),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DASHBOARD_READ)),
) -> list[dict]:
    return dashboard_service.recent_journey_summaries(db, limit=limit)


@router.get("/analytics/summary")
def analytics_summary(
    hours: float | None = Query(24, ge=0.01, le=8760),
    since: str | None = Query(None),
    until: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ANALYTICS_READ)),
) -> dict:
    until_dt = None
    if until:
        try:
            until_dt = datetime.fromisoformat(until.replace("Z", "+00:00"))
        except ValueError:
            until_dt = None
    return dashboard_service.analytics_summary(
        db, hours=hours or 24, since=_parse_since(since), until=until_dt
    )


@router.get("/analytics/timeseries")
def analytics_timeseries(
    hours: float = Query(24, ge=0.01, le=720),
    bucket: str = Query("hour", pattern=r"^(hour|day|minute)$"),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ANALYTICS_READ)),
) -> dict:
    return dashboard_service.activity_series(db, hours=hours, bucket=bucket)


@router.get("/analytics/vehicles")
def analytics_vehicles(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ANALYTICS_READ)),
) -> list[dict]:
    """Most-sighted vehicles in the window — feeds the analytics panels."""
    rows = vi.recent_journeys(db, limit=limit)
    for row in rows:
        row.pop("points", None)
    return rows

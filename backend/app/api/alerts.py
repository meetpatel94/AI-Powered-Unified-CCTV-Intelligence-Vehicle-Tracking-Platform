"""Real-Time Alerts API — feed, lifecycle actions and stats."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import ALERTS_ACKNOWLEDGE, ALERTS_READ, ALERTS_RESOLVE
from app.db.session import get_db
from app.schemas.auth import AlertResolveRequest, AlertStatusRequest
from app.services import alerts as alerts_service
from app.services import watchlist as watchlist_service
from app.services.auth import Principal

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _load_alert(db: Session, alert_id: str):
    alert = alerts_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert '{alert_id}' not found")
    return alert


def _with_entry(db: Session, alert) -> dict:
    """Alert payload + the watchlist entry context (and match confidence)."""
    entry_dict = None
    confidence = None
    if alert.source_type == "watchlist_match" and alert.source_ref:
        from app.models.watchlist import WatchlistEntry, WatchlistMatch

        match_id = alert.source_ref.split(":")[-1]
        row = db.get(WatchlistMatch, int(match_id)) if match_id.isdigit() else None
        if row is not None:
            confidence = row.confidence
            entry = db.get(WatchlistEntry, row.entry_id)
            if entry is not None:
                entry_dict = watchlist_service.entry_dict(entry)
    payload = alerts_service.alert_dict(alert, entry=entry_dict)
    payload["confidence"] = round(float(confidence), 4) if confidence is not None else None
    return payload


@router.get("/recent")
def recent_alerts(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    type: str | None = Query(None),
    camera_id: str | None = Query(None),
    plate: str | None = Query(None),
    hours: float | None = Query(None, ge=0.01, le=8760),
    open_only: bool = Query(False, description="Only NEW/ACKNOWLEDGED/… alerts"),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ALERTS_READ)),
) -> dict:
    since = None
    if hours:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows, total = alerts_service.list_alerts(
        db,
        limit=limit,
        offset=offset,
        status=status_filter,
        severity=severity,
        type=type,
        camera_id=camera_id,
        plate=plate,
        since=since,
        open_only=open_only,
    )
    return {
        "items": [_with_entry(db, a) for a in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/stats")
def alert_stats(
    hours: float | None = Query(24, ge=0.01, le=8760),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ALERTS_READ)),
) -> dict:
    since = (
        datetime.now(timezone.utc) - timedelta(hours=hours) if hours else None
    )
    stats = alerts_service.alert_stats(db, since=since)
    stats["window_hours"] = hours
    return stats


@router.get("/{alert_id}")
def get_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(ALERTS_READ)),
) -> dict:
    alert = _load_alert(db, alert_id)
    return _with_entry(db, alert)


@router.post("/{alert_id}/acknowledge")
def acknowledge(
    alert_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(ALERTS_ACKNOWLEDGE)),
) -> dict:
    alert = _load_alert(db, alert_id)
    alert = alerts_service.acknowledge_alert(db, alert, actor=principal.display_name)
    return _with_entry(db, alert)


@router.post("/{alert_id}/resolve")
def resolve(
    alert_id: str,
    payload: AlertResolveRequest | None = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(ALERTS_RESOLVE)),
) -> dict:
    alert = _load_alert(db, alert_id)
    note = payload.note if payload else None
    alert = alerts_service.resolve_alert(db, alert, actor=principal.display_name, note=note)
    return _with_entry(db, alert)


@router.post("/{alert_id}/status")
def set_status(
    alert_id: str,
    payload: AlertStatusRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(ALERTS_ACKNOWLEDGE)),
) -> dict:
    """Generic status transition (investigate / escalate need acknowledge-level
    permission; RESOLVED additionally requires the resolve permission)."""
    if payload.status == "RESOLVED" and not principal.has(ALERTS_RESOLVE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions (requires '{ALERTS_RESOLVE}')",
        )
    alert = _load_alert(db, alert_id)
    try:
        alert = alerts_service.set_alert_status(
            db, alert, payload.status, actor=principal.display_name, note=payload.note
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _with_entry(db, alert)

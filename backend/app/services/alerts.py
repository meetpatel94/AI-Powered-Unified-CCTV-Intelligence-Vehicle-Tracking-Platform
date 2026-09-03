"""Real-Time Alert Engine.

Converts **confirmed** platform events into operational alerts:

* watchlist matches raised by the pipeline from genuine, persisted ANPR
  sightings (primary source),
* sustained camera failures detected by the health monitor,
* journey anomalies computed by the journey builder.

Every alert carries an ``alert_id``, type, severity, plate, camera, location,
timestamp, message, event/evidence reference and a NEW / ACKNOWLEDGED /
RESOLVED-style status. Duplicate suppression is two-layered:

1. ``dedupe_key`` is UNIQUE — one alert per source event, ever.
2. An unresolved alert for the same watchlist entry + camera inside the
   ``ALERT_DEDUPE_SECONDS`` window folds the new match into the existing alert
   (its ``last_seen``/count context is refreshed via the match record).

New/updated alerts are published on the WebSocket hub as ``alert:new`` and
``alert:update`` frames.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.alerts import (
    ALERT_STATUS_ACKNOWLEDGED,
    ALERT_STATUS_ESCALATED,
    ALERT_STATUS_INVESTIGATING,
    ALERT_STATUS_NEW,
    ALERT_STATUS_RESOLVED,
    OPEN_STATUSES,
    Alert,
)
from app.models.watchlist import WatchlistMatch
from app.services.events import publish

logger = structlog.get_logger(__name__)

# Statuses an operator may transition an alert into (UI parity).
_TRANSITION_STATUSES = {
    ALERT_STATUS_NEW,
    ALERT_STATUS_ACKNOWLEDGED,
    ALERT_STATUS_INVESTIGATING,
    ALERT_STATUS_ESCALATED,
    ALERT_STATUS_RESOLVED,
}

# Watchlist entry priority → alert severity.
_PRIORITY_SEVERITY = {
    "critical": "critical",
    "high": "high",
    "medium": "medium",
    "low": "info",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def alert_dict(a: Alert, *, entry: dict[str, Any] | None = None) -> dict[str, Any]:
    data = {
        "id": a.id,
        "alert_id": a.alert_id,
        "type": a.type,
        "severity": a.severity,
        "status": a.status,
        "plate": a.plate,
        "camera_id": a.camera_id,
        "location_name": a.location_name,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "message": a.message,
        "source_type": a.source_type,
        "source_ref": a.source_ref,
        "evidence_id": a.evidence_id,
        "evidence_url": f"/api/evidence/{a.evidence_id}/image" if a.evidence_id else None,
        "dedupe_key": a.dedupe_key,
        "created_at": _iso(a.created_at),
        "acknowledged_at": _iso(a.acknowledged_at),
        "acknowledged_by": a.acknowledged_by,
        "resolved_at": _iso(a.resolved_at),
        "resolved_by": a.resolved_by,
        "resolution_note": a.resolution_note,
        "updated_at": _iso(a.updated_at),
    }
    if entry is not None:
        data["watchlist_entry"] = entry
    return data


# --------------------------------------------------------------------------- #
# Creation (called from pipeline threads / health monitor)
# --------------------------------------------------------------------------- #
def _insert_alert(db: Session, values: dict[str, Any]) -> Alert | None:
    """Insert with dedupe-key conflict handling. Returns the row or None.

    PostgreSQL and SQLite both support ``ON CONFLICT DO NOTHING``; the dialect
    is chosen so development/tests can run the same code on SQLite without
    changing production behaviour.
    """
    dialect = db.get_bind().dialect.name if db.get_bind() is not None else "postgresql"
    if dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        stmt = sqlite_insert(Alert).values(**values).on_conflict_do_nothing(
            index_elements=["dedupe_key"]
        )
    else:
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = pg_insert(Alert).values(**values).on_conflict_do_nothing(
            index_elements=[Alert.dedupe_key]
        )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.rollback()
        return None
    row = db.scalar(select(Alert).where(Alert.dedupe_key == values["dedupe_key"]))
    if row is None:
        db.commit()
        return None
    # Backfill the human-facing alert_id from the PK (race-free).
    row.alert_id = f"ALR-{row.created_at.astimezone(timezone.utc).strftime('%Y%m%d')}-{row.id:06d}"
    db.commit()
    db.refresh(row)
    return row


def create_alert(
    db: Session,
    *,
    type: str,
    severity: str,
    message: str,
    source_type: str,
    dedupe_key: str,
    plate: str | None = None,
    camera_id: str | None = None,
    location_name: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    source_ref: str | None = None,
    evidence_id: int | None = None,
    suppress_window_seconds: float | None = None,
) -> tuple[Alert | None, bool]:
    """Create an alert with duplicate suppression.

    Returns ``(alert, created)`` — ``alert`` is the new row when created, or
    the existing suppressing alert when de-duplicated, or ``(None, False)``
    on unexpected failure.
    """
    settings = get_settings()
    now = _utcnow()

    # Layer 2: fold into an unresolved alert with the SAME dedupe key (the
    # cooldown window is encoded in the key itself by callers, e.g.
    # ``watchlist_match:{entry}:{camera}:{bucket}``) within the suppression
    # window. Scoped to the exact source (vehicle+camera) — never across
    # unrelated cameras.
    window = suppress_window_seconds if suppress_window_seconds is not None else settings.alert_dedupe_seconds
    if window and window > 0:
        cutoff = now - timedelta(seconds=window)
        existing = db.scalar(
            select(Alert).where(
                Alert.dedupe_key == dedupe_key,
                Alert.status.in_(OPEN_STATUSES),
                Alert.created_at >= cutoff,
            )
        )
        if existing is not None:
            db.rollback()
            logger.info(
                "alert.suppressed_duplicate",
                dedupe_key=dedupe_key,
                suppressed_by=existing.alert_id,
            )
            return existing, False

    alert = _insert_alert(
        db,
        {
            "alert_id": "PENDING",
            "type": type,
            "severity": severity,
            "status": ALERT_STATUS_NEW,
            "message": message,
            "source_type": source_type,
            "source_ref": source_ref,
            "dedupe_key": dedupe_key,
            "plate": plate,
            "camera_id": camera_id,
            "location_name": location_name,
            "latitude": latitude,
            "longitude": longitude,
            "evidence_id": evidence_id,
            "created_at": now,
        },
    )
    if alert is not None:
        logger.info(
            "alert.created",
            alert_id=alert.alert_id,
            type=alert.type,
            severity=alert.severity,
            plate=plate,
            camera_id=camera_id,
        )
        publish("alert:new", alert_dict(alert))
    return alert, alert is not None


def raise_watchlist_alert(
    db: Session, match: WatchlistMatch, *, entry: Any, evidence_id: int | None = None
) -> tuple[Alert | None, bool]:
    """Convert a confirmed watchlist match into an alert (with suppression).

    The dedupe key encodes the cooldown bucket
    (``watchlist_match:{entry}:{camera}:{bucket}``) so that:
    * duplicate spam for the SAME vehicle + camera inside the window folds into
      one alert, and
    * after the window expires a genuinely new sighting CAN raise a fresh alert
      (rather than being blocked forever by the unique key).
    """
    settings = get_settings()
    severity = _PRIORITY_SEVERITY.get(getattr(entry, "priority", "medium"), "medium")
    message = (
        f"Watchlist match: {getattr(entry, 'label', match.plate)} "
        f"({' / '.join(filter(None, [getattr(entry, 'alias', None)]))}) detected at "
        f"{match.location_name or match.camera_id}"
    )
    if getattr(entry, "description", None):
        message += f" — {str(entry.description)[:180]}"

    window = max(1.0, float(settings.alert_dedupe_seconds))
    bucket = int(time.time() // window)
    alert, created = create_alert(
        db,
        type="WATCHLIST_MATCH",
        severity=severity,
        message=message,
        source_type="watchlist_match",
        dedupe_key=f"watchlist_match:{match.entry_id}:{match.camera_id}:{bucket}",
        plate=match.plate,
        camera_id=match.camera_id,
        location_name=match.location_name,
        latitude=match.latitude,
        longitude=match.longitude,
        source_ref=f"watchlist_match:{match.id}",
        evidence_id=evidence_id,
        suppress_window_seconds=settings.alert_dedupe_seconds,
    )
    if alert is not None:
        match.alert_id = alert.id
        db.commit()  # link the match to its (new or standing) alert
        db.refresh(match)
    return alert, created


def raise_camera_alert(
    db: Session,
    *,
    camera_id: str,
    failure_type: str,  # CAMERA_OFFLINE | CAMERA_ERROR
    detail: str,
    location_name: str | None = None,
) -> tuple[Alert | None, bool]:
    """Raise/suppress a sustained camera-failure alert (unique per camera)."""
    severity = "high" if failure_type == "CAMERA_OFFLINE" else "medium"
    return create_alert(
        db,
        type=failure_type,
        severity=severity,
        message=f"Camera {camera_id} {('offline' if failure_type == 'CAMERA_OFFLINE' else 'stream error')}: {detail[:200]}",
        source_type="camera_health",
        dedupe_key=f"camera_health:{camera_id}",
        camera_id=camera_id,
        location_name=location_name,
        source_ref=f"camera:{camera_id}",
        suppress_window_seconds=0,  # dedupe key is already per-camera unique
    )


def resolve_camera_alerts(db: Session, camera_id: str, *, resolved_by: str = "system") -> int:
    """Auto-resolve standing camera alerts once the camera recovers."""
    rows = db.scalars(
        select(Alert).where(
            Alert.source_type == "camera_health",
            Alert.camera_id == camera_id,
            Alert.status.in_(OPEN_STATUSES),
        )
    ).all()
    now = _utcnow()
    for row in rows:
        row.status = ALERT_STATUS_RESOLVED
        row.resolved_at = now
        row.resolved_by = resolved_by
        row.resolution_note = "Auto-resolved: camera recovered"
        publish("alert:update", alert_dict(row))
    if rows:
        db.commit()
        logger.info("alert.camera_recovered", camera_id=camera_id, resolved=len(rows))
    return len(rows)


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #
def get_alert(db: Session, alert_id: str) -> Alert | None:
    """Fetch by numeric id or human-facing ALR-... id."""
    if alert_id.isdigit():
        return db.get(Alert, int(alert_id))
    return db.scalar(select(Alert).where(Alert.alert_id == alert_id))


def acknowledge_alert(db: Session, alert: Alert, *, actor: str) -> Alert:
    if alert.status == ALERT_STATUS_NEW:
        alert.status = ALERT_STATUS_ACKNOWLEDGED
        alert.acknowledged_at = _utcnow()
        alert.acknowledged_by = actor
        db.commit()
        db.refresh(alert)
        publish("alert:update", alert_dict(alert))
        logger.info("alert.acknowledged", alert_id=alert.alert_id, by=actor)
    return alert


def set_alert_status(
    db: Session, alert: Alert, status: str, *, actor: str, note: str | None = None
) -> Alert:
    if status not in _TRANSITION_STATUSES:
        raise ValueError(f"Invalid alert status '{status}'")
    now = _utcnow()
    alert.status = status
    if status == ALERT_STATUS_ACKNOWLEDGED:
        alert.acknowledged_at = now
        alert.acknowledged_by = actor
    elif status == ALERT_STATUS_RESOLVED:
        alert.resolved_at = now
        alert.resolved_by = actor
        if note:
            alert.resolution_note = note
    if note and status != ALERT_STATUS_RESOLVED:
        alert.resolution_note = note
    db.commit()
    db.refresh(alert)
    publish("alert:update", alert_dict(alert))
    logger.info("alert.status_changed", alert_id=alert.alert_id, status=status, by=actor)
    return alert


def resolve_alert(db: Session, alert: Alert, *, actor: str, note: str | None = None) -> Alert:
    return set_alert_status(db, alert, ALERT_STATUS_RESOLVED, actor=actor, note=note)


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #
def list_alerts(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
    severity: str | None = None,
    type: str | None = None,
    camera_id: str | None = None,
    plate: str | None = None,
    since: datetime | None = None,
    open_only: bool = False,
) -> tuple[list[Alert], int]:
    stmt = select(Alert)
    count_stmt = select(func.count()).select_from(Alert)
    filters = []
    if status and status.upper() != "ALL":
        statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
        if statuses:
            filters.append(Alert.status.in_(statuses))
    if open_only:
        filters.append(Alert.status.in_(OPEN_STATUSES))
    if severity and severity.lower() != "all":
        filters.append(Alert.severity == severity.lower())
    if type and type.upper() != "ALL":
        filters.append(Alert.type == type.upper())
    if camera_id:
        filters.append(Alert.camera_id == camera_id)
    if plate:
        filters.append(Alert.plate == plate.upper().strip())
    if since:
        filters.append(Alert.created_at >= since)
    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(stmt.order_by(Alert.created_at.desc()).limit(limit).offset(offset)).all()
    return list(rows), total


def alert_stats(db: Session, *, since: datetime | None = None) -> dict[str, Any]:
    base = select(Alert)
    if since:
        base = base.where(Alert.created_at >= since)

    def _count(*statuses: str) -> int:
        return int(db.scalar(base.with_only_columns(func.count()).where(Alert.status.in_(statuses))) or 0)

    total = int(db.scalar(base.with_only_columns(func.count())) or 0)
    by_severity_rows = db.execute(
        base.with_only_columns(Alert.severity, func.count()).group_by(Alert.severity)
    ).all()
    by_type_rows = db.execute(
        base.with_only_columns(Alert.type, func.count()).group_by(Alert.type)
    ).all()
    return {
        "total": total,
        "new": _count(ALERT_STATUS_NEW),
        "acknowledged": _count(ALERT_STATUS_ACKNOWLEDGED),
        "in_progress": _count(ALERT_STATUS_INVESTIGATING, ALERT_STATUS_ESCALATED),
        "resolved": _count(ALERT_STATUS_RESOLVED),
        "active": total - _count(ALERT_STATUS_RESOLVED),
        "by_severity": {row[0]: int(row[1]) for row in by_severity_rows},
        "by_type": {row[0]: int(row[1]) for row in by_type_rows},
    }


def alerts_for_plate(db: Session, plate: str, *, limit: int = 50) -> list[Alert]:
    return list(
        db.scalars(
            select(Alert)
            .where(Alert.plate == plate.upper().strip())
            .order_by(Alert.created_at.desc())
            .limit(limit)
        ).all()
    )

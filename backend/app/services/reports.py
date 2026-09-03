"""Intelligence Reports service — reports over REAL PostgreSQL data.

Five report families, each generated with parameterised SQLAlchemy queries
(indexed on camera_id / plate / timestamp) and rendered to a CSV document plus
a JSON preview:

* ``anpr_activity``     — ANPR sightings (camera, plate, class, conf, time).
* ``vehicle_journey``   — cross-camera journey stops per plate (ordered).
* ``watchlist_alerts``  — watchlist matches + the alerts they raised.
* ``camera_health``     — per-camera sighting/alert/health activity rollup.
* ``investigation``     — investigation cases and their timeline events.

Every row carries real timestamps, camera ids, locations, plate/vehicle
information and evidence references where available. No fabricated data.
"""

from __future__ import annotations

import csv
import io
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.alerts import Alert
from app.models.audit import (
    ACTION_REPORT_DOWNLOAD,
    ACTION_REPORT_GENERATE,
    ACTION_REPORT_PREVIEW,
)
from app.models.camera import Camera
from app.models.health import CameraHealthStatus
from app.models.investigation import InvestigationCase
from app.models.report import (
    REPORT_FORMAT_CSV,
    REPORT_STATUS_COMPLETED,
    REPORT_STATUS_FAILED,
    REPORT_TYPES,
    Report,
)
from app.models.vehicle import AnprSighting, JourneyPoint
from app.models.watchlist import WatchlistEntry, WatchlistMatch
from app.services import audit as audit_service

logger = structlog.get_logger(__name__)


class ReportError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Data collection — one function per report family. Each returns
# (columns, rows, summary) where rows are lists of dict.
# --------------------------------------------------------------------------- #
def _anpr_activity(db: Session, filters: dict[str, Any]) -> tuple[list[str], list[dict], dict]:
    q = select(AnprSighting)
    q = _apply_time_camera_plate(q, AnprSighting, filters)
    q = q.order_by(AnprSighting.seen_at.desc()).limit(_max_rows())

    rows = []
    cameras: set[str] = set()
    confs: list[float] = []
    for s in db.scalars(q).all():
        cameras.add(s.camera_id)
        if s.ocr_confidence is not None:
            confs.append(float(s.ocr_confidence))
        rows.append(
            {
                "seen_at": _iso(s.seen_at),
                "camera_id": s.camera_id,
                "location_name": s.location_name,
                "plate": s.plate,
                "plate_raw": s.plate_raw,
                "vehicle_class": s.vehicle_class,
                "track_id": s.track_id,
                "ocr_confidence": round(float(s.ocr_confidence), 3) if s.ocr_confidence is not None else None,
                "detection_confidence": round(float(s.detection_confidence), 3) if s.detection_confidence else None,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "pts_ms": s.pts_ms,
                "evidence_path": s.evidence_path,
            }
        )
    columns = [
        "seen_at", "camera_id", "location_name", "plate", "plate_raw",
        "vehicle_class", "track_id", "ocr_confidence", "detection_confidence",
        "latitude", "longitude", "pts_ms", "evidence_path",
    ]
    summary = {
        "sightings": len(rows),
        "cameras": len(cameras),
        "unique_plates": len({r["plate"] for r in rows}),
        "avg_ocr_confidence": round(sum(confs) / len(confs), 3) if confs else None,
    }
    return columns, rows, summary


def _vehicle_journey(db: Session, filters: dict[str, Any]) -> tuple[list[str], list[dict], dict]:
    q = select(JourneyPoint)
    if filters.get("plate"):
        q = q.where(JourneyPoint.plate == filters["plate"].upper().strip())
    if filters.get("camera_id"):
        q = q.where(JourneyPoint.camera_id == filters["camera_id"])
    if filters.get("date_from"):
        q = q.where(JourneyPoint.seen_at >= _aware(filters["date_from"]))
    if filters.get("date_to"):
        q = q.where(JourneyPoint.seen_at <= _aware(filters["date_to"]))
    q = q.order_by(JourneyPoint.plate, JourneyPoint.journey_id, JourneyPoint.sequence).limit(_max_rows())

    rows = []
    plates: set[str] = set()
    anomalies = 0
    for p in db.scalars(q).all():
        plates.add(p.plate)
        anomalies += 1 if p.anomaly else 0
        rows.append(
            {
                "plate": p.plate,
                "journey_id": p.journey_id,
                "sequence": p.sequence,
                "seen_at": _iso(p.seen_at),
                "camera_id": p.camera_id,
                "location_name": p.location_name,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "distance_km": round(float(p.distance_km), 3) if p.distance_km is not None else None,
                "interval_seconds": round(float(p.interval_seconds), 1) if p.interval_seconds is not None else None,
                "speed_kph": round(float(p.speed_kph), 1) if p.speed_kph is not None else None,
                "anomaly": p.anomaly,
                "anomaly_reason": p.anomaly_reason,
                "confidence": round(float(p.confidence), 3) if p.confidence is not None else None,
            }
        )
    columns = [
        "plate", "journey_id", "sequence", "seen_at", "camera_id", "location_name",
        "latitude", "longitude", "distance_km", "interval_seconds", "speed_kph",
        "anomaly", "anomaly_reason", "confidence",
    ]
    summary = {
        "journey_stops": len(rows),
        "vehicles": len(plates),
        "anomalies": anomalies,
    }
    return columns, rows, summary


def _watchlist_alerts(db: Session, filters: dict[str, Any]) -> tuple[list[str], list[dict], dict]:
    # Alert-centric rows (one per alert in scope) enriched with match + entry.
    q = select(Alert)
    if filters.get("alert_type"):
        q = q.where(Alert.type == filters["alert_type"])
    else:
        q = q.where(Alert.type.in_(["WATCHLIST_MATCH", "JOURNEY_ANOMALY", "CAMERA_OFFLINE", "CAMERA_ERROR"]))
    if filters.get("plate"):
        q = q.where(Alert.plate == filters["plate"].upper().strip())
    if filters.get("camera_id"):
        q = q.where(Alert.camera_id == filters["camera_id"])
    if filters.get("date_from"):
        q = q.where(Alert.created_at >= _aware(filters["date_from"]))
    if filters.get("date_to"):
        q = q.where(Alert.created_at <= _aware(filters["date_to"]))
    q = q.order_by(Alert.created_at.desc()).limit(_max_rows())

    alerts = list(db.scalars(q).all())
    # Batch-load related entries for watchlist alerts.
    entry_ids = set()
    for a in alerts:
        if a.source_ref and a.source_ref.startswith("watchlist_match:"):
            try:
                entry_ids.add(int(a.source_ref.split(":")[1]))
            except (ValueError, IndexError):
                pass
    entries = {
        e.id: e for e in db.scalars(select(WatchlistEntry).where(WatchlistEntry.id.in_(entry_ids))).all()
    } if entry_ids else {}

    rows = []
    by_type: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    open_alerts = 0
    for a in alerts:
        by_type[a.type] = by_type.get(a.type, 0) + 1
        by_severity[a.severity] = by_severity.get(a.severity, 0) + 1
        if a.status != "RESOLVED":
            open_alerts += 1
        entry = None
        match_id = None
        if a.source_ref and a.source_ref.startswith("watchlist_match:"):
            try:
                match_id = int(a.source_ref.split(":")[1])
                m = db.get(WatchlistMatch, match_id)
                if m is not None:
                    entry = entries.get(m.entry_id)
                    match_id = m.id
            except (ValueError, IndexError):
                match_id = None
        rows.append(
            {
                "created_at": _iso(a.created_at),
                "alert_id": a.alert_id,
                "type": a.type,
                "severity": a.severity,
                "status": a.status,
                "plate": a.plate,
                "camera_id": a.camera_id,
                "location_name": a.location_name,
                "message": a.message,
                "watchlist_label": entry.label if entry else None,
                "watchlist_category": entry.category if entry else None,
                "watchlist_priority": entry.priority if entry else None,
                "match_id": match_id,
                "evidence_id": a.evidence_id,
                "acknowledged_by": a.acknowledged_by,
                "acknowledged_at": _iso(a.acknowledged_at),
                "resolved_by": a.resolved_by,
                "resolved_at": _iso(a.resolved_at),
                "resolution_note": a.resolution_note,
            }
        )
    columns = [
        "created_at", "alert_id", "type", "severity", "status", "plate", "camera_id",
        "location_name", "message", "watchlist_label", "watchlist_category",
        "watchlist_priority", "match_id", "evidence_id", "acknowledged_by",
        "acknowledged_at", "resolved_by", "resolved_at", "resolution_note",
    ]
    summary = {
        "alerts": len(rows),
        "open_alerts": open_alerts,
        "by_type": by_type,
        "by_severity": by_severity,
    }
    return columns, rows, summary


def _camera_health(db: Session, filters: dict[str, Any]) -> tuple[list[str], list[dict], dict]:
    # Per-camera rollup: registry info + health state + sighting/alert counts.
    cam_q = select(Camera)
    if filters.get("camera_id"):
        cam_q = cam_q.where(Camera.camera_id == filters["camera_id"])
    cameras = list(db.scalars(cam_q.order_by(Camera.camera_id)).all())

    sighting_counts: dict[str, int] = {}
    alert_counts: dict[str, int] = {}
    health_by_id: dict[str, CameraHealthStatus] = {
        h.camera_id: h for h in db.scalars(select(CameraHealthStatus)).all()
    }

    if cameras:
        ids = [c.camera_id for c in cameras]
        s_q = select(AnprSighting.camera_id, func.count()).where(AnprSighting.camera_id.in_(ids))
        s_q = _apply_time(s_q, AnprSighting.seen_at, filters)
        for cid, cnt in db.execute(s_q.group_by(AnprSighting.camera_id)).all():
            sighting_counts[cid] = int(cnt)

        a_q = select(Alert.camera_id, func.count()).where(Alert.camera_id.in_(ids))
        a_q = _apply_time(a_q, Alert.created_at, filters)
        for cid, cnt in db.execute(a_q.group_by(Alert.camera_id)).all():
            if cid:
                alert_counts[cid] = int(cnt)

    rows = []
    live = 0
    for c in cameras:
        h = health_by_id.get(c.camera_id)
        state = h.state if h else "UNKNOWN"
        if state == "LIVE":
            live += 1
        rows.append(
            {
                "camera_id": c.camera_id,
                "location_name": c.location_name,
                "department": c.department,
                "camera_type": c.camera_type,
                "codec": c.codec or (h.codec if h else None),
                "resolution": c.resolution or (h.resolution if h else None),
                "registry_status": c.status,
                "health_state": state,
                "observed_fps": round(float(h.observed_fps), 2) if h and h.observed_fps is not None else None,
                "reconnect_count": h.reconnect_count if h else 0,
                "last_frame_at": _iso(h.last_frame_at) if h else None,
                "last_success_at": _iso(h.last_success_at) if h else None,
                "last_error": (h.last_error[:200] if h and h.last_error else None),
                "sightings_in_window": sighting_counts.get(c.camera_id, 0),
                "alerts_in_window": alert_counts.get(c.camera_id, 0),
            }
        )
    columns = [
        "camera_id", "location_name", "department", "camera_type", "codec",
        "resolution", "registry_status", "health_state", "observed_fps",
        "reconnect_count", "last_frame_at", "last_success_at", "last_error",
        "sightings_in_window", "alerts_in_window",
    ]
    states: dict[str, int] = {}
    for r in rows:
        states[r["health_state"]] = states.get(r["health_state"], 0) + 1
    summary = {
        "cameras": len(rows),
        "live": live,
        "by_state": states,
        "total_sightings": sum(r["sightings_in_window"] for r in rows),
        "total_alerts": sum(r["alerts_in_window"] for r in rows),
    }
    return columns, rows, summary


def _investigation(db: Session, filters: dict[str, Any]) -> tuple[list[str], list[dict], dict]:
    q = select(InvestigationCase)
    if filters.get("plate"):
        q = q.where(InvestigationCase.subject_plate == filters["plate"].upper().strip())
    if filters.get("date_from"):
        q = q.where(InvestigationCase.created_at >= _aware(filters["date_from"]))
    if filters.get("date_to"):
        q = q.where(InvestigationCase.created_at <= _aware(filters["date_to"]))
    q = q.order_by(InvestigationCase.created_at.desc()).limit(_max_rows())

    rows = []
    by_status: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    for c in db.scalars(q).all():
        by_status[c.status] = by_status.get(c.status, 0) + 1
        by_priority[c.priority] = by_priority.get(c.priority, 0) + 1
        # Count linked evidence + sightings for the subject plate.
        evidence_count = len(getattr(c, "evidence", []) or [])
        sighting_count = int(
            db.scalar(
                select(func.count())
                .select_from(AnprSighting)
                .where(AnprSighting.plate == c.subject_plate)
            )
            or 0
        )
        rows.append(
            {
                "created_at": _iso(c.created_at),
                "case_number": c.case_number,
                "subject_plate": c.subject_plate,
                "title": c.title,
                "priority": c.priority,
                "status": c.status,
                "officer": c.officer,
                "created_by": c.created_by,
                "updated_at": _iso(c.updated_at),
                "closed_at": _iso(c.closed_at),
                "sightings_total": sighting_count,
                "evidence_items": evidence_count,
                "notes": (c.notes or "")[:500],
            }
        )
    columns = [
        "created_at", "case_number", "subject_plate", "title", "priority",
        "status", "officer", "created_by", "updated_at", "closed_at",
        "sightings_total", "evidence_items", "notes",
    ]
    summary = {
        "cases": len(rows),
        "open_cases": sum(1 for r in rows if r["status"] not in ("CLOSED", "RESOLVED")),
        "by_status": by_status,
        "by_priority": by_priority,
    }
    return columns, rows, summary


_BUILDERS = {
    "anpr_activity": _anpr_activity,
    "vehicle_journey": _vehicle_journey,
    "watchlist_alerts": _watchlist_alerts,
    "camera_health": _camera_health,
    "investigation": _investigation,
}


def _apply_time_camera_plate(q, model, filters):
    if filters.get("camera_id"):
        q = q.where(model.camera_id == filters["camera_id"])
    if filters.get("plate"):
        q = q.where(model.plate == filters["plate"].upper().strip())
    return _apply_time(q, model.seen_at, filters)


def _apply_time(q, column, filters):
    if filters.get("date_from"):
        q = q.where(column >= _aware(filters["date_from"]))
    if filters.get("date_to"):
        q = q.where(column <= _aware(filters["date_to"]))
    return q


def _max_rows() -> int:
    return max(100, get_settings().reports_max_rows)


# --------------------------------------------------------------------------- #
# Report lifecycle
# --------------------------------------------------------------------------- #
def create_report(
    db: Session,
    *,
    name: str,
    report_type: str,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    camera_id: str | None = None,
    plate: str | None = None,
    alert_type: str | None = None,
    fmt: str = REPORT_FORMAT_CSV,
    classification: str = "internal",
    created_by: str | None = None,
    created_by_role: str | None = None,
    principal: Any = None,
    request: Any = None,
) -> Report:
    if report_type not in REPORT_TYPES:
        raise ReportError(
            f"Unknown report type '{report_type}'. Valid: {', '.join(REPORT_TYPES)}"
        )
    settings = get_settings()
    now = _utcnow()

    report = Report(
        name=(name or f"{report_type} report").strip()[:255],
        type=report_type,
        status="generating",
        format=(fmt or REPORT_FORMAT_CSV).upper()[:8],
        classification=(classification or "internal")[:32],
        date_from=_aware(date_from),
        date_to=_aware(date_to),
        camera_id=(camera_id or None) and camera_id.strip()[:64],
        plate=(plate or None) and plate.upper().strip()[:16],
        alert_type=(alert_type or None) and alert_type.strip()[:32],
        created_by=created_by,
        created_by_role=created_by_role,
        expires_at=now + timedelta(days=max(1, settings.reports_retention_days)),
    )
    # Insert the row with a unique placeholder human-facing id so the not-null
    # + unique constraints are always satisfied; then update it to the final id
    # (which embeds the surrogate PK) in the same transaction.
    import uuid

    report.report_id = f"RPT-PENDING-{uuid.uuid4().hex[:12]}"
    db.add(report)
    db.flush()
    report.report_id = f"RPT-{now.strftime('%Y%m%d')}-{report.id:06d}"
    db.commit()
    db.refresh(report)

    filters = {
        "date_from": _aware(date_from),
        "date_to": _aware(date_to),
        "camera_id": report.camera_id,
        "plate": report.plate,
        "alert_type": report.alert_type,
    }
    try:
        columns, rows, summary = _BUILDERS[report_type](db, filters)
        file_path = _write_document(report, columns, rows)
        report.row_count = len(rows)
        report.camera_count = summary.get("cameras", 0) or len({r.get("camera_id") for r in rows if r.get("camera_id")})
        report.file_path = file_path
        report.file_size_bytes = os.path.getsize(file_path) if file_path and os.path.exists(file_path) else None
        report.summary = {
            **summary,
            "columns": columns,
            "generated_at": _iso(now),
            "filters": {
                "date_from": _iso(filters["date_from"]),
                "date_to": _iso(filters["date_to"]),
                "camera_id": filters["camera_id"],
                "plate": filters["plate"],
                "alert_type": filters["alert_type"],
            },
        }
        report.status = REPORT_STATUS_COMPLETED
        report.completed_at = _utcnow()
    except Exception as exc:
        logger.exception("report.generate_failed", report_id=report.report_id, type=report_type)
        report.status = REPORT_STATUS_FAILED
        report.error = str(exc)[:1000]
    db.commit()
    db.refresh(report)

    audit_service.record(
        db=db,
        action=ACTION_REPORT_GENERATE,
        principal=principal,
        resource_type="report",
        resource_id=report.report_id,
        result="success" if report.status == REPORT_STATUS_COMPLETED else "failure",
        detail=f"Generated {report_type} report '{report.name}' ({report.row_count} rows)",
        context={"type": report_type, "rows": report.row_count, "format": report.format},
        request=request,
    )
    return report


def _write_document(report: Report, columns: list[str], rows: list[dict]) -> str:
    settings = get_settings()
    os.makedirs(settings.reports_dir, exist_ok=True)
    safe_type = report.type.replace("/", "_")
    fname = f"RPT-{report.id:06d}-{safe_type}.csv"
    fpath = os.path.join(settings.reports_dir, fname)
    with open(fpath, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return fpath


def get_report(db: Session, report_id: str) -> Report | None:
    if not report_id:
        return None
    if report_id.upper().startswith("RPT-"):
        return db.scalar(select(Report).where(Report.report_id == report_id))
    # Numeric PK fallback.
    try:
        return db.get(Report, int(report_id))
    except (ValueError, TypeError):
        return None


def list_reports(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    report_type: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> tuple[list[Report], int]:
    stmt = select(Report)
    count_stmt = select(func.count()).select_from(Report)
    if report_type:
        stmt = stmt.where(Report.type == report_type)
        count_stmt = count_stmt.where(Report.type == report_type)
    if status:
        stmt = stmt.where(Report.status == status)
        count_stmt = count_stmt.where(Report.status == status)
    if date_from:
        stmt = stmt.where(Report.created_at >= _aware(date_from))
        count_stmt = count_stmt.where(Report.created_at >= _aware(date_from))
    if date_to:
        stmt = stmt.where(Report.created_at <= _aware(date_to))
        count_stmt = count_stmt.where(Report.created_at <= _aware(date_to))
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        stmt.order_by(Report.created_at.desc(), Report.id.desc()).limit(limit).offset(offset)
    ).all()
    return list(rows), total


def report_dict(r: Report) -> dict[str, Any]:
    return {
        "id": r.id,
        "report_id": r.report_id,
        "name": r.name,
        "type": r.type,
        "status": r.status,
        "format": r.format,
        "classification": r.classification,
        "date_from": _iso(r.date_from),
        "date_to": _iso(r.date_to),
        "camera_id": r.camera_id,
        "plate": r.plate,
        "alert_type": r.alert_type,
        "created_by": r.created_by,
        "created_by_role": r.created_by_role,
        "row_count": r.row_count,
        "camera_count": r.camera_count,
        "file_size_bytes": r.file_size_bytes,
        "error": r.error,
        "summary": r.summary,
        "created_at": _iso(r.created_at),
        "completed_at": _iso(r.completed_at),
        "expires_at": _iso(r.expires_at),
        "download_url": f"/api/reports/{r.report_id}/download",
        "preview_url": f"/api/reports/{r.report_id}/preview",
    }


def preview(db: Session, report: Report, *, principal=None, request=None) -> dict[str, Any]:
    """Return a JSON preview (summary + first rows + columns)."""
    summary = report.summary or {}
    columns = summary.get("columns", [])
    preview_rows: list[dict] = []
    if report.file_path and os.path.exists(report.file_path):
        try:
            with open(report.file_path, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                for i, row in enumerate(reader):
                    if i >= 100:
                        break
                    preview_rows.append(dict(row))
        except Exception as exc:
            logger.warning("report.preview_read_failed", report_id=report.report_id, error=str(exc))
    audit_service.record(
        db=db,
        action=ACTION_REPORT_PREVIEW,
        principal=principal,
        resource_type="report",
        resource_id=report.report_id,
        detail=f"Previewed report {report.report_id}",
        request=request,
    )
    return {
        **report_dict(report),
        "columns": columns,
        "rows": preview_rows,
        "row_preview_count": len(preview_rows),
    }


def resolve_file(db: Session, report: Report, *, principal=None, request=None) -> str | None:
    """Mark a download in the audit trail and return the on-disk path."""
    audit_service.record(
        db=db,
        action=ACTION_REPORT_DOWNLOAD,
        principal=principal,
        resource_type="report",
        resource_id=report.report_id,
        detail=f"Downloaded report {report.report_id} ({report.format})",
        request=request,
    )
    if report.file_path and os.path.exists(report.file_path):
        return report.file_path
    return None

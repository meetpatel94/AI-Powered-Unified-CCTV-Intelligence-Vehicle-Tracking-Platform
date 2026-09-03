"""Investigation workflow service.

Builds investigation views from **real** records only: the vehicle identity
aggregate, ANPR sightings, cross-camera journeys, watchlist matches and
alerts. Case files store operator metadata (case number, subject plate,
notes, status) and reference evidence snapshots by id.

Timeline items are returned chronologically, newest-last, with stable ``kind``
labels so the console can render a unified history.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.alerts import Alert
from app.models.evidence import EvidenceSnapshot
from app.models.investigation import (
    CASE_STATUS_CLOSED,
    CASE_STATUS_IN_PROGRESS,
    CASE_STATUS_OPEN,
    CaseEvidence,
    InvestigationCase,
)
from app.models.vehicle import AnprSighting, JourneyPoint, Vehicle, VehicleTrack
from app.models.watchlist import WatchlistEntry, WatchlistMatch

logger = structlog.get_logger(__name__)

CASE_STATUSES = (CASE_STATUS_OPEN, CASE_STATUS_IN_PROGRESS, CASE_STATUS_CLOSED)
PRIORITIES = ("critical", "high", "medium", "low")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


class InvestigationError(Exception):
    pass


# --------------------------------------------------------------------------- #
# Dossier / timeline
# --------------------------------------------------------------------------- #
def timeline_for_plate(
    db: Session,
    plate: str,
    *,
    limit: int = 200,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[dict[str, Any]]:
    """Unified chronological timeline: sightings, journey stops, watchlist
    matches, alerts and cases involving the plate."""
    plate = plate.upper().strip()
    items: list[dict[str, Any]] = []

    def _in_window(ts: datetime | None) -> bool:
        if ts is None:
            return False
        ts = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        if since is not None and ts < since:
            return False
        if until is not None and ts > until:
            return False
        return True

    sightings = db.scalars(
        select(AnprSighting)
        .where(AnprSighting.plate == plate)
        .order_by(desc(AnprSighting.seen_at))
        .limit(limit)
    ).all()
    for s in sightings:
        if not _in_window(s.seen_at):
            continue
        items.append(
            {
                "kind": "sighting",
                "timestamp": _iso(s.seen_at),
                "camera_id": s.camera_id,
                "location_name": s.location_name,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "plate": s.plate,
                "confidence": s.ocr_confidence,
                "vehicle_class": s.vehicle_class,
                "track_id": s.track_id,
                "evidence_id": None,
                "detail": f"ANPR read {s.plate_raw or s.plate} (conf {s.ocr_confidence:.2f})",
                "ref": f"anpr_sighting:{s.id}",
            }
        )

    journeys = db.scalars(
        select(JourneyPoint)
        .where(JourneyPoint.plate == plate)
        .order_by(desc(JourneyPoint.seen_at))
        .limit(limit)
    ).all()
    for p in journeys:
        if not _in_window(p.seen_at):
            continue
        items.append(
            {
                "kind": "journey",
                "timestamp": _iso(p.seen_at),
                "camera_id": p.camera_id,
                "location_name": p.location_name,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "plate": p.plate,
                "journey_id": p.journey_id,
                "sequence": p.sequence,
                "speed_kph": p.speed_kph,
                "distance_km": p.distance_km,
                "anomaly": p.anomaly,
                "detail": (
                    f"Journey {p.journey_id} stop {p.sequence} at {p.camera_id}"
                    + (f" — {p.anomaly_reason}" if p.anomaly else "")
                ),
                "ref": f"journey_point:{p.id}",
            }
        )

    matches = db.scalars(
        select(WatchlistMatch)
        .where(WatchlistMatch.plate == plate)
        .order_by(desc(WatchlistMatch.matched_at))
        .limit(limit)
    ).all()
    entry_map = {e.id: e for e in db.scalars(
        select(WatchlistEntry).where(WatchlistEntry.id.in_({m.entry_id for m in matches} or {0}))
    ).all()}
    for m in matches:
        if not _in_window(m.matched_at):
            continue
        entry = entry_map.get(m.entry_id)
        items.append(
            {
                "kind": "watchlist_match",
                "timestamp": _iso(m.matched_at),
                "camera_id": m.camera_id,
                "location_name": m.location_name,
                "latitude": m.latitude,
                "longitude": m.longitude,
                "plate": m.plate,
                "confidence": m.confidence,
                "watchlist_entry_id": m.entry_id,
                "watchlist_category": entry.category if entry else None,
                "watchlist_priority": entry.priority if entry else None,
                "alert_id": m.alert_id,
                "evidence_id": m.evidence_id,
                "detail": (
                    f"Watchlist match ({entry.label if entry else 'entry #' + str(m.entry_id)}"
                    f" · {entry.category if entry else '?'})"
                ),
                "ref": f"watchlist_match:{m.id}",
            }
        )

    alerts = db.scalars(
        select(Alert)
        .where(Alert.plate == plate)
        .order_by(desc(Alert.created_at))
        .limit(limit)
    ).all()
    for a in alerts:
        if not _in_window(a.created_at):
            continue
        items.append(
            {
                "kind": "alert",
                "timestamp": _iso(a.created_at),
                "camera_id": a.camera_id,
                "location_name": a.location_name,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "plate": a.plate,
                "alert_id": a.alert_id,
                "alert_type": a.type,
                "severity": a.severity,
                "status": a.status,
                "evidence_id": a.evidence_id,
                "detail": a.message,
                "ref": f"alert:{a.id}",
            }
        )

    cases = db.scalars(
        select(InvestigationCase)
        .where(InvestigationCase.subject_plate == plate)
        .order_by(desc(InvestigationCase.created_at))
        .limit(50)
    ).all()
    for c in cases:
        if not _in_window(c.created_at):
            continue
        items.append(
            {
                "kind": "case",
                "timestamp": _iso(c.created_at),
                "camera_id": None,
                "location_name": None,
                "plate": c.subject_plate,
                "case_number": c.case_number,
                "case_status": c.status,
                "case_priority": c.priority,
                "detail": f"Case {c.case_number} opened — {c.title}",
                "ref": f"case:{c.id}",
            }
        )

    items.sort(key=lambda item: item["timestamp"] or "")
    return items


def dossier(db: Session, plate: str) -> dict[str, Any]:
    """Everything the investigation console needs for one plate."""
    plate = plate.upper().strip()
    vehicle = db.scalar(select(Vehicle).where(Vehicle.plate == plate))
    if vehicle is None:
        raise InvestigationError(f"No vehicle identity for plate {plate}")

    sightings = db.scalars(
        select(AnprSighting)
        .where(AnprSighting.plate == plate)
        .order_by(desc(AnprSighting.seen_at))
        .limit(200)
    ).all()
    tracks = db.scalars(
        select(VehicleTrack)
        .where(VehicleTrack.plate == plate)
        .order_by(desc(VehicleTrack.last_seen))
        .limit(50)
    ).all()
    journey = db.query(JourneyPoint).filter(JourneyPoint.plate == plate).order_by(
        JourneyPoint.journey_id, JourneyPoint.sequence
    ).all()
    matches = db.scalars(
        select(WatchlistMatch)
        .where(WatchlistMatch.plate == plate)
        .order_by(desc(WatchlistMatch.matched_at))
        .limit(50)
    ).all()
    alerts = db.scalars(
        select(Alert)
        .where(Alert.plate == plate)
        .order_by(desc(Alert.created_at))
        .limit(50)
    ).all()
    cases = db.scalars(
        select(InvestigationCase)
        .where(InvestigationCase.subject_plate == plate)
        .order_by(desc(InvestigationCase.created_at))
        .limit(20)
    ).all()

    # Watchlist context.
    entry = db.scalar(
        select(WatchlistEntry).where(
            WatchlistEntry.plate == plate, WatchlistEntry.is_active.is_(True)
        )
    )
    confidences = [s.ocr_confidence for s in sightings if s.ocr_confidence]
    cameras = {s.camera_id for s in sightings}

    return {
        "plate": plate,
        "vehicle": {
            "id": vehicle.id,
            "plate": vehicle.plate,
            "vehicle_class": vehicle.vehicle_class,
            "first_seen": _iso(vehicle.first_seen),
            "last_seen": _iso(vehicle.last_seen),
            "last_camera_id": vehicle.last_camera_id,
            "total_sightings": vehicle.total_sightings,
            "camera_count": vehicle.camera_count,
            "best_confidence": vehicle.best_confidence,
        },
        "mean_confidence": round(sum(confidences) / len(confidences), 4) if confidences else None,
        "cameras_seen": sorted(cameras),
        "watchlist": (
            {
                "match": True,
                "entry_id": entry.id,
                "label": entry.label,
                "category": entry.category,
                "priority": entry.priority,
                "description": entry.description,
                "added_on": _iso(entry.created_at),
            }
            if entry
            else {"match": False}
        ),
        "sightings": [
            {
                "id": s.id,
                "camera_id": s.camera_id,
                "timestamp": _iso(s.seen_at),
                "location_name": s.location_name,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "ocr_confidence": s.ocr_confidence,
                "detection_confidence": s.detection_confidence,
                "vehicle_class": s.vehicle_class,
                "track_id": s.track_id,
                "bbox": (
                    {"x": s.bbox_x, "y": s.bbox_y, "w": s.bbox_w, "h": s.bbox_h}
                    if s.bbox_x is not None
                    else None
                ),
                "evidence_path": s.evidence_path,
            }
            for s in reversed(sightings)
        ],
        "journey_points": [
            {
                "journey_id": p.journey_id,
                "sequence": p.sequence,
                "camera_id": p.camera_id,
                "timestamp": _iso(p.seen_at),
                "location_name": p.location_name,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "distance_km": p.distance_km,
                "interval_seconds": p.interval_seconds,
                "speed_kph": p.speed_kph,
                "anomaly": p.anomaly,
                "anomaly_reason": p.anomaly_reason,
            }
            for p in journey
        ],
        "tracks": [
            {
                "id": t.id,
                "camera_id": t.camera_id,
                "track_id": t.track_id,
                "first_seen": _iso(t.first_seen),
                "last_seen": _iso(t.last_seen),
                "frame_count": t.frame_count,
            }
            for t in tracks
        ],
        "watchlist_matches": [
            {
                "id": m.id,
                "entry_id": m.entry_id,
                "camera_id": m.camera_id,
                "matched_at": _iso(m.matched_at),
                "location_name": m.location_name,
                "confidence": m.confidence,
                "alert_id": m.alert_id,
                "evidence_id": m.evidence_id,
            }
            for m in matches
        ],
        "alerts": [
            {
                "alert_id": a.alert_id,
                "type": a.type,
                "severity": a.severity,
                "status": a.status,
                "camera_id": a.camera_id,
                "message": a.message,
                "created_at": _iso(a.created_at),
                "evidence_id": a.evidence_id,
            }
            for a in alerts
        ],
        "cases": [case_dict(c) for c in cases],
    }


# --------------------------------------------------------------------------- #
# Cases
# --------------------------------------------------------------------------- #
def case_dict(c: InvestigationCase, *, evidence_ids: list[int] | None = None) -> dict[str, Any]:
    return {
        "id": c.id,
        "case_number": c.case_number,
        "subject_plate": c.subject_plate,
        "title": c.title,
        "priority": c.priority,
        "status": c.status,
        "notes": c.notes,
        "officer": c.officer,
        "created_by": c.created_by,
        "created_at": _iso(c.created_at),
        "updated_at": _iso(c.updated_at),
        "closed_at": _iso(c.closed_at),
        "evidence_ids": evidence_ids or [],
    }


def create_case(
    db: Session,
    *,
    subject_plate: str,
    title: str,
    priority: str = "medium",
    notes: str | None = None,
    officer: str | None = None,
    evidence_ids: list[int] | None = None,
    created_by: str | None = None,
) -> InvestigationCase:
    subject_plate = subject_plate.upper().strip()
    if priority not in PRIORITIES:
        raise InvestigationError(f"Invalid priority '{priority}'")
    if not title.strip():
        raise InvestigationError("Title is required")
    vehicle = db.scalar(select(Vehicle).where(Vehicle.plate == subject_plate))
    if vehicle is None:
        raise InvestigationError(
            f"No vehicle identity for plate {subject_plate} — only real tracked plates can be casework subjects"
        )

    case = InvestigationCase(
        case_number="PENDING",
        subject_plate=subject_plate,
        title=title.strip(),
        priority=priority,
        notes=notes,
        officer=officer,
        created_by=created_by,
    )
    db.add(case)
    db.flush()
    case.case_number = (
        f"GP-CASE-{case.created_at.astimezone(timezone.utc).strftime('%Y%m%d')}-{case.id:06d}"
    )
    for evidence_id in evidence_ids or []:
        snap = db.get(EvidenceSnapshot, int(evidence_id))
        if snap is None:
            raise InvestigationError(f"Evidence {evidence_id} not found")
        db.add(CaseEvidence(case_id=case.id, evidence_id=snap.id))
    db.commit()
    db.refresh(case)
    logger.info(
        "investigation.case_created",
        case_number=case.case_number,
        plate=subject_plate,
        by=created_by,
    )
    return case


def list_cases(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    plate: str | None = None,
    status: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(InvestigationCase)
    count_stmt = select(func.count()).select_from(InvestigationCase)
    if plate:
        stmt = stmt.where(InvestigationCase.subject_plate == plate.upper().strip())
        count_stmt = count_stmt.where(InvestigationCase.subject_plate == plate.upper().strip())
    if status and status.upper() != "ALL":
        stmt = stmt.where(InvestigationCase.status == status.upper())
        count_stmt = count_stmt.where(InvestigationCase.status == status.upper())
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(stmt.order_by(desc(InvestigationCase.created_at)).limit(limit).offset(offset)).all()
    out = []
    for case in rows:
        evidence_ids = db.scalars(
            select(CaseEvidence.evidence_id).where(CaseEvidence.case_id == case.id)
        ).all()
        out.append(case_dict(case, evidence_ids=list(evidence_ids)))
    return out, total


def get_case(db: Session, case_number: str) -> dict[str, Any] | None:
    case = db.scalar(
        select(InvestigationCase).where(InvestigationCase.case_number == case_number)
    )
    if case is None:
        return None
    evidence_ids = db.scalars(
        select(CaseEvidence.evidence_id).where(CaseEvidence.case_id == case.id)
    ).all()
    return case_dict(case, evidence_ids=list(evidence_ids))


def update_case_status(
    db: Session, case: InvestigationCase, status: str, *, actor: str
) -> InvestigationCase:
    status = status.upper()
    if status not in CASE_STATUSES:
        raise InvestigationError(f"Invalid status '{status}' (one of {CASE_STATUSES})")
    case.status = status
    if status == CASE_STATUS_CLOSED:
        case.closed_at = _utcnow()
    db.commit()
    db.refresh(case)
    logger.info("investigation.case_status", case_number=case.case_number, status=status, by=actor)
    return case


def get_case_row(db: Session, case_number: str) -> InvestigationCase | None:
    return db.scalar(
        select(InvestigationCase).where(InvestigationCase.case_number == case_number)
    )

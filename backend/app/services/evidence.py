"""Evidence Snapshot service.

Captures **individual JPEG still frames** from the current live-frame buffer
(or an in-memory crop produced by the pipeline) when an important event fires —
never continuous video. Each snapshot gets a SHA-256 hash, stored metadata and
a retention window; a background task deletes expired evidence.

Storage layout: ``{EVIDENCE_DIR}/{YYYY/MM/DD}/{camera}_{event}_{timestamp}.jpg``
— paths stored relative to ``EVIDENCE_DIR`` so the tree can be swapped for an
object store without touching the database.
"""

from __future__ import annotations

import hashlib
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.evidence import EvidenceSnapshot

logger = structlog.get_logger(__name__)

try:  # cv2 is used to (re)encode crops; guarded like the pipeline.
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    _CV2 = True
except Exception:  # pragma: no cover
    cv2 = None  # type: ignore
    np = None  # type: ignore
    _CV2 = False


def _evidence_root() -> str:
    return get_settings().evidence_frames_dir


def resolve_evidence_path(relative_path: str) -> str | None:
    """Resolve a stored relative path under the evidence root, safely.

    Returns ``None`` for any path that would escape the evidence directory
    (path-traversal guard) or does not exist.
    """
    root = os.path.realpath(_evidence_root())
    full = os.path.realpath(os.path.join(root, relative_path))
    if not full.startswith(root + os.sep):
        return None
    if not os.path.isfile(full):
        return None
    return full


def capture_evidence(
    db: Session,
    *,
    event_type: str,
    event_id: str,
    camera_id: str,
    jpeg: bytes,
    plate: str | None = None,
    captured_at: datetime | None = None,
    bbox: dict[str, Any] | None = None,
    note: str | None = None,
    commit: bool = True,
) -> EvidenceSnapshot | None:
    """Persist one JPEG evidence frame + its metadata. Returns the record.

    ``jpeg`` must be an encoded JPEG (from the live-frame buffer or a crop).
    """
    settings = get_settings()
    if not settings.evidence_frames_enabled or not jpeg:
        return None
    captured_at = captured_at or datetime.now(timezone.utc)
    sha256 = hashlib.sha256(jpeg).hexdigest()

    day_dir = captured_at.strftime("%Y/%m/%d")
    ts = captured_at.strftime("%Y%m%d_%H%M%S_%f")
    safe_camera = "".join(c if c.isalnum() or c in "-_." else "_" for c in camera_id)[:64]
    safe_event = "".join(c if c.isalnum() else "_" for c in event_type)[:32]
    fname = f"{safe_camera}_{safe_event}_{ts}.jpg"
    relative = os.path.join(day_dir, fname)

    root = _evidence_root()
    full_dir = os.path.join(root, day_dir)
    try:
        os.makedirs(full_dir, exist_ok=True)
        with open(os.path.join(root, relative), "wb") as fh:
            fh.write(jpeg)
    except OSError as exc:
        logger.error("evidence.write_failed", camera_id=camera_id, error=str(exc))
        return None

    retention_until = (
        captured_at + timedelta(days=settings.evidence_retention_days)
        if settings.evidence_retention_days > 0
        else None
    )
    snapshot = EvidenceSnapshot(
        event_type=event_type,
        event_id=str(event_id),
        camera_id=camera_id,
        plate=plate,
        captured_at=captured_at,
        bbox=bbox,
        file_path=relative,
        sha256=sha256,
        size_bytes=len(jpeg),
        content_type="image/jpeg",
        note=note,
        retention_until=retention_until,
    )
    db.add(snapshot)
    db.flush()  # populate snapshot.id for callers linking evidence to events
    if commit:
        db.commit()
        db.refresh(snapshot)
    logger.info(
        "evidence.captured",
        evidence_id=snapshot.id,
        source=f"{event_type}:{event_id}",
        camera_id=camera_id,
        plate=plate,
        sha256=sha256[:12],
        size_bytes=len(jpeg),
    )
    return snapshot


def capture_crop_evidence(
    db: Session,
    *,
    event_type: str,
    event_id: str,
    camera_id: str,
    frame: "Any",
    bbox: tuple[float, float, float, float] | None,
    plate: str | None = None,
    captured_at: datetime | None = None,
    commit: bool = True,
) -> EvidenceSnapshot | None:
    """Encode a vehicle crop (numpy BGR frame + bbox) and store it."""
    if not _CV2 or frame is None:
        return None
    try:
        if bbox is not None:
            h, w = frame.shape[:2]
            x1, y1, x2, y2 = int(max(0, bbox[0])), int(max(0, bbox[1])), int(min(w, bbox[0] + bbox[2])), int(min(h, bbox[1] + bbox[3]))
            if x2 - x1 >= 8 and y2 - y1 >= 8:
                frame = frame[y1:y2, x1:x2]
        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not ok:
            return None
        return capture_evidence(
            db,
            event_type=event_type,
            event_id=event_id,
            camera_id=camera_id,
            jpeg=buf.tobytes(),
            plate=plate,
            captured_at=captured_at,
            bbox=(
                {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]} if bbox else None
            ),
            note="vehicle crop",
            commit=commit,
        )
    except Exception:
        logger.exception("evidence.crop_failed", camera_id=camera_id)
        return None


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #
def evidence_dict(s: EvidenceSnapshot, *, include_url: bool = True) -> dict[str, Any]:
    data = {
        "id": s.id,
        "event_type": s.event_type,
        "event_id": s.event_id,
        "camera_id": s.camera_id,
        "plate": s.plate,
        "captured_at": _iso(s.captured_at),
        "bbox": s.bbox,
        "sha256": s.sha256,
        "size_bytes": s.size_bytes,
        "content_type": s.content_type,
        "note": s.note,
        "retention_until": _iso(s.retention_until),
        "created_at": _iso(s.created_at),
    }
    if include_url:
        data["image_url"] = f"/api/evidence/{s.id}/image"
        data["download_url"] = f"/api/evidence/{s.id}/image?download=1"
    return data


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def list_evidence(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    camera_id: str | None = None,
    plate: str | None = None,
    event_type: str | None = None,
    event_id: str | None = None,
    since: datetime | None = None,
) -> tuple[list[EvidenceSnapshot], int]:
    stmt = select(EvidenceSnapshot).where(EvidenceSnapshot.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(EvidenceSnapshot).where(EvidenceSnapshot.deleted_at.is_(None))
    if camera_id:
        stmt = stmt.where(EvidenceSnapshot.camera_id == camera_id)
        count_stmt = count_stmt.where(EvidenceSnapshot.camera_id == camera_id)
    if plate:
        stmt = stmt.where(EvidenceSnapshot.plate == plate.upper().strip())
        count_stmt = count_stmt.where(EvidenceSnapshot.plate == plate.upper().strip())
    if event_type:
        stmt = stmt.where(EvidenceSnapshot.event_type == event_type)
        count_stmt = count_stmt.where(EvidenceSnapshot.event_type == event_type)
    if event_id:
        stmt = stmt.where(EvidenceSnapshot.event_id == str(event_id))
        count_stmt = count_stmt.where(EvidenceSnapshot.event_id == str(event_id))
    if since:
        stmt = stmt.where(EvidenceSnapshot.captured_at >= since)
        count_stmt = count_stmt.where(EvidenceSnapshot.captured_at >= since)
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        stmt.order_by(desc(EvidenceSnapshot.captured_at)).limit(limit).offset(offset)
    ).all()
    return list(rows), total


def get_evidence(db: Session, evidence_id: int) -> EvidenceSnapshot | None:
    snap = db.get(EvidenceSnapshot, evidence_id)
    if snap is not None and snap.deleted_at is not None:
        return None
    return snap


def evidence_for_event(db: Session, event_type: str, event_id: str) -> list[EvidenceSnapshot]:
    return list(
        db.scalars(
            select(EvidenceSnapshot)
            .where(
                EvidenceSnapshot.event_type == event_type,
                EvidenceSnapshot.event_id == str(event_id),
                EvidenceSnapshot.deleted_at.is_(None),
            )
            .order_by(desc(EvidenceSnapshot.captured_at))
            .limit(20)
        ).all()
    )


# --------------------------------------------------------------------------- #
# Retention
# --------------------------------------------------------------------------- #
def purge_expired(db: Session) -> dict[str, int]:
    """Delete evidence past its retention window (files + rows)."""
    now = datetime.now(timezone.utc)
    rows = db.scalars(
        select(EvidenceSnapshot).where(
            EvidenceSnapshot.retention_until.isnot(None),
            EvidenceSnapshot.retention_until < now,
            EvidenceSnapshot.deleted_at.is_(None),
        )
    ).all()
    root = os.path.realpath(_evidence_root())
    removed_files = 0
    for snap in rows:
        full = os.path.realpath(os.path.join(root, snap.file_path))
        if full.startswith(root + os.sep) and os.path.isfile(full):
            try:
                os.remove(full)
                removed_files += 1
            except OSError:
                logger.warning("evidence.purge.file_failed", evidence_id=snap.id)
        snap.deleted_at = now
    db.commit()
    if rows:
        logger.info("evidence.purge.complete", count=len(rows), files_removed=removed_files)
    return {"rows": len(rows), "files": removed_files}


# Retention loop (runs in a daemon thread started from main.py lifespan).
class _RetentionTask:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="evidence-retention", daemon=True)
        self._thread.start()
        logger.info("evidence.retention.started")

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def _run(self) -> None:
        from app.db.session import SessionLocal

        while not self._stop.wait(3600.0):  # hourly
            try:
                db = SessionLocal()
                try:
                    purge_expired(db)
                finally:
                    db.close()
            except Exception:
                logger.exception("evidence.retention.error")


retention_task = _RetentionTask()

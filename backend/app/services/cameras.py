"""Camera Registry persistence — upsert from Sentinel catalogue."""

from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.camera import Camera
from app.services.sentinel import SentinelError, fetch_catalogue, normalize_camera

logger = structlog.get_logger(__name__)

_UPSERT_COLUMNS = (
    "department",
    "location_name",
    "latitude",
    "longitude",
    "camera_type",
    "codec",
    "resolution",
    "status",
    "connectivity",
    "vms",
    "owner",
    "rtsp_url",
    "webrtc_url",
    "hls_url",
)


def list_cameras(db: Session) -> list[Camera]:
    return list(db.scalars(select(Camera).order_by(Camera.camera_id)).all())


def get_camera(db: Session, camera_id: str) -> Camera | None:
    return db.get(Camera, camera_id)


def camera_count(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(Camera)) or 0)


def upsert_cameras(db: Session, records: list[dict[str, Any]]) -> tuple[int, int, list[str]]:
    upserted = 0
    skipped = 0
    errors: list[str] = []
    for raw in records:
        normalized = normalize_camera(raw)
        if not normalized:
            skipped += 1
            errors.append("Skipped record without camera_id")
            continue
        stmt = insert(Camera).values(**normalized)
        update_map = {col: stmt.excluded[col] for col in _UPSERT_COLUMNS}
        update_map["updated_at"] = func.now()
        stmt = stmt.on_conflict_do_update(index_elements=[Camera.camera_id], set_=update_map)
        try:
            db.execute(stmt)
            upserted += 1
        except Exception as exc:  # pragma: no cover - defensive
            skipped += 1
            errors.append(f"{normalized['camera_id']}: {exc}")
            logger.exception("camera.upsert.failed", camera_id=normalized["camera_id"])
    db.commit()
    return upserted, skipped, errors


def ingest_from_sentinel(db: Session) -> dict[str, Any]:
    settings = get_settings()
    try:
        records = fetch_catalogue()
    except SentinelError:
        raise
    upserted, skipped, errors = upsert_cameras(db, records)
    logger.info(
        "camera.ingest.complete",
        fetched=len(records),
        upserted=upserted,
        skipped=skipped,
    )
    return {
        "source": settings.sentinel_ingest_url,
        "fetched": len(records),
        "upserted": upserted,
        "skipped": skipped,
        "errors": errors[:50],
    }

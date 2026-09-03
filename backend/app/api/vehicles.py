"""Vehicle Identity, plate-search, sightings, cross-camera match and journey APIs."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import VEHICLES_READ
from app.db.session import get_db
from app.schemas.vehicle import (
    JourneyOut,
    SightingOut,
    TrackOut,
    VehicleOut,
)
from app.services import vehicle_intel as vi
from app.services.auth import Principal

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("/search", response_model=list[VehicleOut])
def search(
    q: str = Query(..., min_length=1, description="Full or partial normalized plate"),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(VEHICLES_READ)),
) -> list[VehicleOut]:
    return [VehicleOut(**v) for v in vi.search_vehicles(db, q, limit)]


@router.get("/{plate}", response_model=VehicleOut)
def vehicle(
    plate: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(VEHICLES_READ)),
) -> VehicleOut:
    data = vi.get_vehicle(db, plate)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No vehicle identity for plate {plate}")
    return VehicleOut(**data)


@router.get("/{plate}/sightings", response_model=list[SightingOut])
def sightings(
    plate: str,
    limit: int = Query(200, ge=1, le=1000),
    since: str | None = Query(None, description="ISO-8601 start of time window"),
    until: str | None = Query(None, description="ISO-8601 end of time window"),
    camera_id: str | None = Query(None, max_length=64),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(VEHICLES_READ)),
) -> list[SightingOut]:
    """Real database observations for a normalized plate.

    Filters by time range and camera; results are chronological (newest first).
    Uncertain reads are included and carry ``plate_uncertain`` so the caller can
    display them honestly.
    """
    return [
        SightingOut(**s)
        for s in vi.get_vehicle_sightings(
            db,
            plate,
            limit,
            since=_parse_iso(since),
            until=_parse_iso(until),
            camera_id=camera_id,
        )
    ]


@router.get("/{plate}/cross-camera")
def cross_camera(
    plate: str,
    max_gap_seconds: float | None = Query(None, gt=0, description="Max gap for a journey segment"),
    max_speed_kph: float | None = Query(None, gt=0, description="Max plausible implied speed"),
    include_visual: bool = Query(False, description="Include config-gated metadata candidates"),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(VEHICLES_READ)),
) -> dict:
    """Cross-camera vehicle matching.

    Primary mode is deterministic plate identity with temporal/spatial
    constraints (chronological stops, segment gaps, implied-speed validation).
    A clearly-marked, low-confidence metadata association is only returned when
    ``CROSS_CAMERA_VISUAL_MATCH_ENABLED=true`` and ``include_visual=true``; it
    is never claimed as certain.
    """
    result = vi.match_cross_camera(
        db,
        plate,
        max_gap_seconds=max_gap_seconds,
        max_speed_kph=max_speed_kph,
    )
    if include_visual and result.get("stops"):
        last = result["stops"][-1]
        result["metadata_candidates"] = vi.cross_camera_metadata_candidates(
            db,
            vehicle_class=last.get("vehicle_class"),
            camera_id=last.get("camera_id"),
            seen_at=_parse_iso(last.get("timestamp")),
            exclude_plate=plate,
        )
    else:
        result["metadata_candidates"] = []
    return result


@router.get("/{plate}/journey", response_model=JourneyOut)
def journey(
    plate: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(VEHICLES_READ)),
) -> JourneyOut:
    return JourneyOut(**vi.get_vehicle_journey(db, plate))


@router.get("/{plate}/tracks", response_model=list[TrackOut])
def vehicle_tracks(
    plate: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(VEHICLES_READ)),
) -> list[TrackOut]:
    plate_u = plate.upper().strip()
    rows = [t for t in vi.recent_tracks(db, limit=limit) if t.get("plate") == plate_u]
    return [TrackOut(**t) for t in rows]

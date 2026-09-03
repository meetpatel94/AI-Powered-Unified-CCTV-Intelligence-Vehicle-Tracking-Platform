"""Vehicle Identity, plate-search, sightings and journey APIs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.vehicle import (
    JourneyOut,
    SightingOut,
    TrackOut,
    VehicleOut,
)
from app.services import vehicle_intel as vi

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


@router.get("/search", response_model=list[VehicleOut])
def search(
    q: str = Query(..., min_length=1, description="Full or partial normalized plate"),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[VehicleOut]:
    return [VehicleOut(**v) for v in vi.search_vehicles(db, q, limit)]


@router.get("/{plate}", response_model=VehicleOut)
def vehicle(plate: str, db: Session = Depends(get_db)) -> VehicleOut:
    data = vi.get_vehicle(db, plate)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No vehicle identity for plate {plate}")
    return VehicleOut(**data)


@router.get("/{plate}/sightings", response_model=list[SightingOut])
def sightings(
    plate: str,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[SightingOut]:
    return [SightingOut(**s) for s in vi.get_vehicle_sightings(db, plate, limit)]


@router.get("/{plate}/journey", response_model=JourneyOut)
def journey(plate: str, db: Session = Depends(get_db)) -> JourneyOut:
    return JourneyOut(**vi.get_vehicle_journey(db, plate))


@router.get("/{plate}/tracks", response_model=list[TrackOut])
def vehicle_tracks(
    plate: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[TrackOut]:
    plate_u = plate.upper().strip()
    rows = [t for t in vi.recent_tracks(db, limit=limit) if t.get("plate") == plate_u]
    return [TrackOut(**t) for t in rows]

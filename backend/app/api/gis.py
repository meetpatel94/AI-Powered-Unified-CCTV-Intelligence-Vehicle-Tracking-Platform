"""GIS intelligence API — cameras GeoJSON, vehicle routes, nearby queries."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import GIS_READ
from app.db.session import get_db
from app.services import gis as gis_service
from app.services.auth import Principal

router = APIRouter(prefix="/api/gis", tags=["gis"])


@router.get("/cameras")
def cameras(
    department: str | None = Query(None, max_length=128),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(GIS_READ)),
) -> dict:
    """GeoJSON FeatureCollection of the dynamic camera fleet (Sentinel-fed)."""
    return gis_service.cameras_geojson(db, department=department)


@router.get("/vehicle/{plate}/route")
def vehicle_route(
    plate: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(GIS_READ)),
) -> dict:
    """GeoJSON routes + stop points for a plate's cross-camera journeys."""
    return gis_service.vehicle_route(db, plate)


@router.get("/nearby")
def nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: float = Query(2000, ge=1, le=200_000),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(GIS_READ)),
) -> dict:
    """Cameras near a point, nearest first (PostGIS or haversine)."""
    return gis_service.nearby_cameras(db, lat=lat, lng=lng, radius_m=radius_m, limit=limit)


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(GIS_READ)),
) -> dict:
    """Fleet coverage summary for the map statistics strip."""
    geojson = gis_service.cameras_geojson(db)
    states: dict[str, int] = {}
    departments: dict[str, int] = {}
    for feature in geojson["features"]:
        props = feature["properties"]
        states[props.get("health_state") or "UNKNOWN"] = (
            states.get(props.get("health_state") or "UNKNOWN", 0) + 1
        )
        dept = props.get("department") or "Unassigned"
        departments[dept] = departments.get(dept, 0) + 1
    return {
        "geocoded_cameras": geojson["count"],
        "states": states,
        "departments": departments,
        "postgis": geojson["postgis"],
    }

"""GIS intelligence layer.

Builds on the Camera Registry (coordinates come from Sentinel — never hard-
coded) and the pipeline's journey data:

* ``GET /api/gis/cameras``  — GeoJSON FeatureCollection of the camera fleet.
* ``GET /api/gis/vehicle/{plate}/route`` — GeoJSON routes + stop points for a
  plate's cross-camera journeys.
* ``GET /api/gis/nearby`` — cameras near a point (PostGIS ``ST_DWithin`` /
  ``ST_Distance`` when the extension is available, haversine fallback
  otherwise).

PostGIS presence is probed once per process (``pg_available_extensions`` and
the actual ``cameras.geom`` column) — the layer degrades to haversine on plain
PostgreSQL so it works everywhere.
"""

from __future__ import annotations

import math
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.camera import Camera
from app.models.vehicle import JourneyPoint
from app.services import camera_health as health_service
from app.services.cameras import list_cameras
from app.services.stream_gateway import StreamState, gateway

logger = structlog.get_logger(__name__)

EARTH_RADIUS_M = 6_371_008.8

_state_cache: dict[str, bool] = {"checked": False, "postgis": False, "geom_column": False}


def _check_postgis(db: Session) -> None:
    if _state_cache["checked"]:
        return
    try:
        has_ext = db.execute(
            text("SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'")
        ).first()
        _state_cache["postgis"] = has_ext is not None
        if _state_cache["postgis"]:
            has_col = db.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'cameras' AND column_name = 'geom'"
                )
            ).first()
            _state_cache["geom_column"] = has_col is not None
    except Exception:
        _state_cache["postgis"] = False
        _state_cache["geom_column"] = False
    _state_cache["checked"] = True
    logger.info(
        "gis.probe",
        postgis=_state_cache["postgis"],
        camera_geom=_state_cache["geom_column"],
    )


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    r1, r2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(r1) * math.cos(r2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


# --------------------------------------------------------------------------- #
# Camera GeoJSON
# --------------------------------------------------------------------------- #
def camera_feature(camera: Camera, extra: dict[str, Any] | None = None) -> dict[str, Any] | None:
    if camera.latitude is None or camera.longitude is None:
        return None
    props: dict[str, Any] = {
        "camera_id": camera.camera_id,
        "location_name": camera.location_name,
        "department": camera.department,
        "camera_type": camera.camera_type,
        "codec": camera.codec,
        "resolution": camera.resolution,
        "registry_status": camera.status,
        "rtsp_configured": bool(camera.rtsp_url),
    }
    if extra:
        props.update(extra)
    return {
        "type": "Feature",
        "id": camera.camera_id,
        "geometry": {"type": "Point", "coordinates": [round(camera.longitude, 6), round(camera.latitude, 6)]},
        "properties": props,
    }


def cameras_geojson(db: Session, *, department: str | None = None) -> dict[str, Any]:
    """GeoJSON FeatureCollection for the fleet (optionally one department)."""
    cameras = list_cameras(db)
    snapshots = {s.camera_id: s.to_dict() for s in gateway.list_snapshots()}
    health_rows = {h["camera_id"]: h for h in health_service.list_health(db)}
    features = []
    for camera in cameras:
        if department and camera.department != department:
            continue
        health = health_rows.get(camera.camera_id, {})
        snap = snapshots.get(camera.camera_id)
        extra = {
            "health_state": health.get("state", "UNKNOWN"),
            "stream_state": snap.get("state") if snap else None,
            "observed_fps": health.get("observed_fps"),
            "last_frame_at": health.get("last_frame_at"),
            "last_error": health.get("last_error"),
        }
        feature = camera_feature(camera, extra)
        if feature is not None:
            features.append(feature)
    return {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "count": len(features),
        "postgis": _state_cache.get("postgis", False),
    }


# --------------------------------------------------------------------------- #
# Vehicle route GeoJSON
# --------------------------------------------------------------------------- #
def vehicle_route(db: Session, plate: str) -> dict[str, Any]:
    """Journeys for a plate as GeoJSON: one LineString per journey segment +
    one Point per stop. Points carry timing/speed/anomaly properties."""
    plate = plate.upper().strip()
    points = db.query(JourneyPoint).filter(JourneyPoint.plate == plate).order_by(
        JourneyPoint.journey_id, JourneyPoint.sequence
    ).all()

    point_features: list[dict[str, Any]] = []
    lines: dict[int, list[list[float]]] = {}
    for p in points:
        props = {
            "sequence": p.sequence,
            "journey_id": p.journey_id,
            "camera_id": p.camera_id,
            "location_name": p.location_name,
            "timestamp": p.seen_at.isoformat() if p.seen_at else None,
            "confidence": p.confidence,
            "distance_km": p.distance_km,
            "interval_seconds": p.interval_seconds,
            "speed_kph": p.speed_kph,
            "anomaly": p.anomaly,
            "anomaly_reason": p.anomaly_reason,
        }
        if p.latitude is not None and p.longitude is not None:
            coords = [round(p.longitude, 6), round(p.latitude, 6)]
            point_features.append(
                {"type": "Feature", "id": f"jp-{p.id}", "geometry": {"type": "Point", "coordinates": coords}, "properties": props}
            )
            lines.setdefault(p.journey_id, []).append(coords)

    route_features = [
        {
            "type": "Feature",
            "id": f"journey-{jid}",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "kind": "route",
                "journey_id": jid,
                "stops": len(coords),
            },
        }
        for jid, coords in sorted(lines.items())
        if len(coords) >= 2
    ]

    return {
        "type": "FeatureCollection",
        "plate": plate,
        "journey_count": len(lines),
        "point_count": len(point_features),
        "anomaly_count": sum(1 for f in point_features if f["properties"]["anomaly"]),
        "features": route_features + point_features,
    }


# --------------------------------------------------------------------------- #
# Nearby cameras
# --------------------------------------------------------------------------- #
def nearby_cameras(
    db: Session,
    *,
    lat: float,
    lng: float,
    radius_m: float = 2000.0,
    limit: int = 20,
) -> dict[str, Any]:
    """Cameras within ``radius_m`` of (lat, lng), nearest first.

    Uses PostGIS ST_DWithin/ST_Distance on ``cameras.geom`` when available;
    otherwise falls back to haversine ordering in SQL.
    """
    _check_postgis(db)
    limit = max(1, min(limit, 200))
    radius_m = max(1.0, min(radius_m, 200_000.0))

    if _state_cache["postgis"] and _state_cache["geom_column"]:
        try:
            rows = db.execute(
                text(
                    """
                    SELECT camera_id, location_name, department, camera_type, status,
                           latitude, longitude,
                           ST_Distance(geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) AS distance_m
                    FROM cameras
                    WHERE geom IS NOT NULL
                      AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
                    ORDER BY distance_m
                    LIMIT :lim
                    """
                ),
                {"lat": lat, "lng": lng, "radius": radius_m, "lim": limit},
            ).all()
            results = [
                {
                    "camera_id": r[0],
                    "location_name": r[1],
                    "department": r[2],
                    "camera_type": r[3],
                    "registry_status": r[4],
                    "latitude": r[5],
                    "longitude": r[6],
                    "distance_m": round(float(r[7]), 1),
                }
                for r in rows
            ]
            return {
                "origin": {"latitude": lat, "longitude": lng},
                "radius_m": radius_m,
                "engine": "postgis",
                "count": len(results),
                "cameras": results,
            }
        except Exception:
            logger.exception("gis.nearby.postgis_failed", fallback="haversine")

    # Haversine fallback — works on plain PostgreSQL.
    cameras = list_cameras(db)
    scored = []
    for camera in cameras:
        if camera.latitude is None or camera.longitude is None:
            continue
        distance = haversine_m(lat, lng, camera.latitude, camera.longitude)
        if distance <= radius_m:
            scored.append((distance, camera))
    scored.sort(key=lambda pair: pair[0])
    results = [
        {
            "camera_id": c.camera_id,
            "location_name": c.location_name,
            "department": c.department,
            "camera_type": c.camera_type,
            "registry_status": c.status,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "distance_m": round(d, 1),
        }
        for d, c in scored[:limit]
    ]
    return {
        "origin": {"latitude": lat, "longitude": lng},
        "radius_m": radius_m,
        "engine": "haversine",
        "count": len(results),
        "cameras": results,
    }

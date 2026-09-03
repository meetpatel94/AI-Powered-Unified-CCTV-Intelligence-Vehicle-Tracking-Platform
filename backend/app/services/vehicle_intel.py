"""Persistence + query layer for the Vehicle Intelligence Pipeline.

Responsibilities
----------------
* Persist ANPR sightings and upsert the Vehicle Identity aggregate.
* Persist / update stable multi-frame tracks.
* Build the ordered cross-camera journey, flagging impossible travel intervals.
* Serve the plate-search / sightings / journey / recent-activity queries.

All writes run inside short-lived sessions and are defensive: a DB error on one
sighting is logged and rolled back without tearing down the pipeline.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.camera import Camera
from app.models.vehicle import AnprSighting, JourneyPoint, Vehicle, VehicleTrack

logger = structlog.get_logger(__name__)

EARTH_RADIUS_KM = 6371.0088


def _haversine_km(lat1, lon1, lat2, lon2) -> float | None:
    if None in (lat1, lon1, lat2, lon2):
        return None
    r1, r2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(r1) * math.cos(r2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------------------- #
# Camera location cache (denormalized onto sightings for fast geo queries)
# ---------------------------------------------------------------------------- #
def camera_location(db: Session, camera_id: str) -> tuple[float | None, float | None, str | None]:
    cam = db.get(Camera, camera_id)
    if cam is None:
        return None, None, None
    return cam.latitude, cam.longitude, cam.location_name


# ---------------------------------------------------------------------------- #
# Track persistence
# ---------------------------------------------------------------------------- #
def upsert_track(
    db: Session,
    *,
    camera_id: str,
    track_id: int,
    vehicle_class: str | None,
    seen_at: datetime,
    pts_ms: float | None,
    bbox: tuple[float, float, float, float],
    confidence: float,
    plate: str | None = None,
) -> None:
    settings = get_settings()
    seen_at = _aware(seen_at)
    point = {
        "pts_ms": pts_ms,
        "x": round(bbox[0], 1),
        "y": round(bbox[1], 1),
        "w": round(bbox[2], 1),
        "h": round(bbox[3], 1),
        "conf": round(confidence, 3),
    }
    track = db.scalar(
        select(VehicleTrack).where(
            VehicleTrack.camera_id == camera_id, VehicleTrack.track_id == track_id
        )
    )
    if track is None:
        track = VehicleTrack(
            camera_id=camera_id,
            track_id=track_id,
            vehicle_class=vehicle_class,
            plate=plate,
            first_seen=seen_at,
            last_seen=seen_at,
            first_pts_ms=pts_ms,
            last_pts_ms=pts_ms,
            frame_count=1,
            trajectory=[point],
        )
        db.add(track)
    else:
        track.last_seen = seen_at
        track.last_pts_ms = pts_ms
        track.frame_count += 1
        if vehicle_class:
            track.vehicle_class = vehicle_class
        if plate:
            track.plate = plate
        traj = list(track.trajectory or [])
        traj.append(point)
        cap = settings.track_trajectory_max_points
        if len(traj) > cap:
            traj = traj[-cap:]
        track.trajectory = traj


# ---------------------------------------------------------------------------- #
# ANPR sighting + Vehicle Identity + journey
# ---------------------------------------------------------------------------- #
def _get_or_create_vehicle(db: Session, plate: str, vehicle_class: str | None) -> Vehicle:
    vehicle = db.scalar(select(Vehicle).where(Vehicle.plate == plate))
    if vehicle is None:
        vehicle = Vehicle(plate=plate, vehicle_class=vehicle_class)
        db.add(vehicle)
        db.flush()
    return vehicle


def record_anpr_sighting(
    db: Session,
    *,
    plate: str,
    plate_raw: str,
    camera_id: str,
    seen_at: datetime,
    ocr_confidence: float,
    detection_confidence: float | None,
    vehicle_class: str | None,
    track_id: int | None,
    bbox: tuple[float, float, float, float] | None,
    pts_ms: float | None,
    evidence_path: str | None = None,
) -> dict[str, Any] | None:
    """Persist one ANPR sighting, update Vehicle Identity and extend the journey.

    Returns a dict describing what was persisted (for WebSocket broadcast), or
    ``None`` if it was de-duplicated / failed.
    """
    settings = get_settings()
    seen_at = _aware(seen_at)

    lat, lon, loc_name = camera_location(db, camera_id)

    # De-dupe: skip if we already logged this plate on this camera very recently.
    if settings.anpr_dedupe_seconds > 0:
        cutoff = seen_at - timedelta(seconds=settings.anpr_dedupe_seconds)
        recent = db.scalar(
            select(AnprSighting.id)
            .where(
                AnprSighting.plate == plate,
                AnprSighting.camera_id == camera_id,
                AnprSighting.seen_at >= cutoff,
            )
            .limit(1)
        )
        if recent is not None:
            return None

    vehicle = _get_or_create_vehicle(db, plate, vehicle_class)

    bx = by = bw = bh = None
    if bbox is not None:
        bx, by, bw, bh = bbox

    sighting = AnprSighting(
        vehicle_id=vehicle.id,
        plate=plate,
        plate_raw=plate_raw,
        camera_id=camera_id,
        track_id=track_id,
        vehicle_class=vehicle_class,
        ocr_confidence=ocr_confidence,
        detection_confidence=detection_confidence,
        bbox_x=bx,
        bbox_y=by,
        bbox_w=bw,
        bbox_h=bh,
        pts_ms=pts_ms,
        latitude=lat,
        longitude=lon,
        location_name=loc_name,
        evidence_path=evidence_path,
        seen_at=seen_at,
    )
    db.add(sighting)

    # Update Vehicle Identity aggregate.
    if vehicle.first_seen is None or seen_at < _aware(vehicle.first_seen):
        vehicle.first_seen = seen_at
    if vehicle.last_seen is None or seen_at >= _aware(vehicle.last_seen):
        vehicle.last_seen = seen_at
        vehicle.last_camera_id = camera_id
    if vehicle_class:
        vehicle.vehicle_class = vehicle_class
    vehicle.total_sightings = (vehicle.total_sightings or 0) + 1
    if vehicle.best_confidence is None or ocr_confidence > vehicle.best_confidence:
        vehicle.best_confidence = ocr_confidence

    db.flush()

    # Extend the cross-camera journey.
    journey_info = _extend_journey(
        db,
        vehicle=vehicle,
        plate=plate,
        camera_id=camera_id,
        seen_at=seen_at,
        lat=lat,
        lon=lon,
        loc_name=loc_name,
        confidence=ocr_confidence,
    )

    # Distinct camera count for the identity.
    vehicle.camera_count = int(
        db.scalar(
            select(func.count(func.distinct(AnprSighting.camera_id))).where(
                AnprSighting.vehicle_id == vehicle.id
            )
        )
        or 0
    )

    return {
        "sighting_id": sighting.id,
        "vehicle_id": vehicle.id,
        "plate": plate,
        "plate_raw": plate_raw,
        "camera_id": camera_id,
        "vehicle_class": vehicle_class,
        "ocr_confidence": round(ocr_confidence, 4),
        "detection_confidence": (
            round(detection_confidence, 4) if detection_confidence is not None else None
        ),
        "track_id": track_id,
        "latitude": lat,
        "longitude": lon,
        "location_name": loc_name,
        "evidence_path": evidence_path,
        "seen_at": seen_at.isoformat(),
        "journey": journey_info,
    }


def _extend_journey(
    db: Session,
    *,
    vehicle: Vehicle,
    plate: str,
    camera_id: str,
    seen_at: datetime,
    lat: float | None,
    lon: float | None,
    loc_name: str | None,
    confidence: float,
) -> dict[str, Any] | None:
    """Append a journey point, computing interval/distance/speed + anomaly.

    A large time gap starts a new journey segment. Cross-camera legs whose
    implied speed exceeds the configured ceiling are flagged as anomalies rather
    than silently accepted. Repeated reads on the same camera do not add a stop.
    """
    settings = get_settings()

    last = db.scalar(
        select(JourneyPoint)
        .where(JourneyPoint.vehicle_id == vehicle.id)
        .order_by(desc(JourneyPoint.journey_id), desc(JourneyPoint.sequence))
        .limit(1)
    )

    journey_id = 1
    sequence = 1
    distance_km = interval_seconds = speed_kph = None
    anomaly = False
    anomaly_reason: str | None = None

    if last is not None:
        last_seen = _aware(last.seen_at)
        gap = (seen_at - last_seen).total_seconds()

        # Same camera as the previous stop within the gap window → not a new leg.
        if last.camera_id == camera_id and gap <= settings.journey_max_gap_seconds:
            return None

        if gap > settings.journey_max_gap_seconds:
            journey_id = last.journey_id + 1
            sequence = 1
        else:
            journey_id = last.journey_id
            sequence = last.sequence + 1
            interval_seconds = gap
            distance_km = _haversine_km(last.latitude, last.longitude, lat, lon)
            if distance_km is not None and gap >= settings.journey_min_interval_seconds:
                speed_kph = distance_km / (gap / 3600.0)
                if speed_kph > settings.journey_max_speed_kph:
                    anomaly = True
                    anomaly_reason = (
                        f"impossible speed {speed_kph:.0f} km/h "
                        f"(> {settings.journey_max_speed_kph:.0f})"
                    )
            elif distance_km is not None and gap < settings.journey_min_interval_seconds and distance_km > 0.5:
                # Two far-apart cameras within a couple seconds is impossible.
                anomaly = True
                anomaly_reason = f"impossible: {distance_km:.1f} km in {gap:.1f}s"

    point = JourneyPoint(
        vehicle_id=vehicle.id,
        plate=plate,
        journey_id=journey_id,
        sequence=sequence,
        camera_id=camera_id,
        seen_at=seen_at,
        latitude=lat,
        longitude=lon,
        location_name=loc_name,
        confidence=confidence,
        distance_km=distance_km,
        interval_seconds=interval_seconds,
        speed_kph=speed_kph,
        anomaly=anomaly,
        anomaly_reason=anomaly_reason,
    )
    db.add(point)
    db.flush()

    if anomaly:
        logger.warning(
            "journey.anomaly",
            plate=plate,
            camera_id=camera_id,
            reason=anomaly_reason,
            speed_kph=speed_kph,
        )

    return {
        "journey_id": journey_id,
        "sequence": sequence,
        "camera_id": camera_id,
        "latitude": lat,
        "longitude": lon,
        "location_name": loc_name,
        "distance_km": round(distance_km, 3) if distance_km is not None else None,
        "interval_seconds": round(interval_seconds, 1) if interval_seconds is not None else None,
        "speed_kph": round(speed_kph, 1) if speed_kph is not None else None,
        "anomaly": anomaly,
        "anomaly_reason": anomaly_reason,
        "seen_at": seen_at.isoformat(),
    }


# ---------------------------------------------------------------------------- #
# Query API
# ---------------------------------------------------------------------------- #
def _sighting_dict(s: AnprSighting) -> dict[str, Any]:
    return {
        "id": s.id,
        "plate": s.plate,
        "plate_raw": s.plate_raw,
        "camera_id": s.camera_id,
        "track_id": s.track_id,
        "vehicle_class": s.vehicle_class,
        "ocr_confidence": s.ocr_confidence,
        "detection_confidence": s.detection_confidence,
        "bbox": (
            {"x": s.bbox_x, "y": s.bbox_y, "w": s.bbox_w, "h": s.bbox_h}
            if s.bbox_x is not None
            else None
        ),
        "pts_ms": s.pts_ms,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "location_name": s.location_name,
        "evidence_path": s.evidence_path,
        "seen_at": _aware(s.seen_at).isoformat() if s.seen_at else None,
    }


def _vehicle_dict(v: Vehicle) -> dict[str, Any]:
    return {
        "id": v.id,
        "plate": v.plate,
        "vehicle_class": v.vehicle_class,
        "first_seen": _aware(v.first_seen).isoformat() if v.first_seen else None,
        "last_seen": _aware(v.last_seen).isoformat() if v.last_seen else None,
        "last_camera_id": v.last_camera_id,
        "total_sightings": v.total_sightings,
        "camera_count": v.camera_count,
        "best_confidence": v.best_confidence,
    }


def get_vehicle(db: Session, plate: str) -> dict[str, Any] | None:
    plate = plate.upper().strip()
    v = db.scalar(select(Vehicle).where(Vehicle.plate == plate))
    if v is None:
        return None
    data = _vehicle_dict(v)
    last_sightings = db.scalars(
        select(AnprSighting)
        .where(AnprSighting.vehicle_id == v.id)
        .order_by(desc(AnprSighting.seen_at))
        .limit(10)
    ).all()
    data["recent_sightings"] = [_sighting_dict(s) for s in last_sightings]
    return data


def get_vehicle_sightings(db: Session, plate: str, limit: int = 200) -> list[dict[str, Any]]:
    plate = plate.upper().strip()
    rows = db.scalars(
        select(AnprSighting)
        .where(AnprSighting.plate == plate)
        .order_by(desc(AnprSighting.seen_at))
        .limit(limit)
    ).all()
    return [_sighting_dict(s) for s in rows]


def get_vehicle_journey(db: Session, plate: str) -> dict[str, Any]:
    plate = plate.upper().strip()
    rows = db.scalars(
        select(JourneyPoint)
        .where(JourneyPoint.plate == plate)
        .order_by(JourneyPoint.journey_id, JourneyPoint.sequence)
    ).all()
    points = [
        {
            "vehicle_id": p.vehicle_id,
            "journey_id": p.journey_id,
            "sequence": p.sequence,
            "camera_id": p.camera_id,
            "timestamp": _aware(p.seen_at).isoformat() if p.seen_at else None,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "location_name": p.location_name,
            "confidence": p.confidence,
            "distance_km": p.distance_km,
            "interval_seconds": p.interval_seconds,
            "speed_kph": p.speed_kph,
            "anomaly": p.anomaly,
            "anomaly_reason": p.anomaly_reason,
        }
        for p in rows
    ]
    anomalies = [p for p in points if p["anomaly"]]
    return {
        "plate": plate,
        "point_count": len(points),
        "segment_count": len({p["journey_id"] for p in points}),
        "anomaly_count": len(anomalies),
        "points": points,
    }


def search_vehicles(db: Session, q: str, limit: int = 25) -> list[dict[str, Any]]:
    q = (q or "").upper().strip()
    if not q:
        return []
    like = f"%{q}%"
    rows = db.scalars(
        select(Vehicle)
        .where(Vehicle.plate.like(like))
        .order_by(desc(Vehicle.last_seen))
        .limit(limit)
    ).all()
    return [_vehicle_dict(v) for v in rows]


def recent_sightings(
    db: Session, limit: int = 50, camera_id: str | None = None
) -> list[dict[str, Any]]:
    stmt = select(AnprSighting).order_by(desc(AnprSighting.seen_at)).limit(limit)
    if camera_id:
        stmt = (
            select(AnprSighting)
            .where(AnprSighting.camera_id == camera_id)
            .order_by(desc(AnprSighting.seen_at))
            .limit(limit)
        )
    rows = db.scalars(stmt).all()
    return [_sighting_dict(s) for s in rows]


def recent_tracks(
    db: Session, limit: int = 50, camera_id: str | None = None
) -> list[dict[str, Any]]:
    stmt = select(VehicleTrack).order_by(desc(VehicleTrack.last_seen)).limit(limit)
    if camera_id:
        stmt = (
            select(VehicleTrack)
            .where(VehicleTrack.camera_id == camera_id)
            .order_by(desc(VehicleTrack.last_seen))
            .limit(limit)
        )
    rows = db.scalars(stmt).all()
    return [
        {
            "id": t.id,
            "camera_id": t.camera_id,
            "track_id": t.track_id,
            "vehicle_class": t.vehicle_class,
            "plate": t.plate,
            "first_seen": _aware(t.first_seen).isoformat() if t.first_seen else None,
            "last_seen": _aware(t.last_seen).isoformat() if t.last_seen else None,
            "first_pts_ms": t.first_pts_ms,
            "last_pts_ms": t.last_pts_ms,
            "frame_count": t.frame_count,
            "trajectory": t.trajectory or [],
        }
        for t in rows
    ]


def recent_journeys(db: Session, limit: int = 25) -> list[dict[str, Any]]:
    """Most recently active vehicles with a multi-camera journey."""
    rows = db.scalars(
        select(Vehicle)
        .where(Vehicle.camera_count >= 1)
        .order_by(desc(Vehicle.last_seen))
        .limit(limit)
    ).all()
    out: list[dict[str, Any]] = []
    for v in rows:
        pts = db.scalars(
            select(JourneyPoint)
            .where(JourneyPoint.vehicle_id == v.id)
            .order_by(JourneyPoint.journey_id, JourneyPoint.sequence)
        ).all()
        out.append(
            {
                **_vehicle_dict(v),
                "points": [
                    {
                        "sequence": p.sequence,
                        "journey_id": p.journey_id,
                        "camera_id": p.camera_id,
                        "timestamp": _aware(p.seen_at).isoformat() if p.seen_at else None,
                        "latitude": p.latitude,
                        "longitude": p.longitude,
                        "location_name": p.location_name,
                        "anomaly": p.anomaly,
                    }
                    for p in pts
                ],
            }
        )
    return out


def pipeline_counts(db: Session) -> dict[str, int]:
    return {
        "vehicles": int(db.scalar(select(func.count()).select_from(Vehicle)) or 0),
        "anpr_sightings": int(db.scalar(select(func.count()).select_from(AnprSighting)) or 0),
        "tracks": int(db.scalar(select(func.count()).select_from(VehicleTrack)) or 0),
        "journey_points": int(db.scalar(select(func.count()).select_from(JourneyPoint)) or 0),
    }

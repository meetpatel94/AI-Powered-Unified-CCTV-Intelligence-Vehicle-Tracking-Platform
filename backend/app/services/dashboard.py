"""Dashboard KPIs + analytics aggregations.

All numbers come from PostgreSQL aggregations over genuine pipeline records
(cameras, streams, tracks, ANPR sightings, journeys, watchlist matches,
alerts) — never fabricated. Windows are parameterised for date/time filtering.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.alerts import Alert, ALERT_STATUS_RESOLVED
from app.models.camera import Camera
from app.models.vehicle import AnprSighting, JourneyPoint, Vehicle, VehicleTrack
from app.models.watchlist import WatchlistEntry, WatchlistMatch
from app.services import alerts as alerts_service
from app.services import camera_health as health_service
from app.services.stream_gateway import StreamState, gateway

logger = structlog.get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return _aware(dt).isoformat() if dt else None


def _window_start(hours: float | None, since: datetime | None) -> datetime | None:
    if since is not None:
        return _aware(since)
    if hours:
        return _utcnow() - timedelta(hours=hours)
    return None


# --------------------------------------------------------------------------- #
# KPIs
# --------------------------------------------------------------------------- #
def dashboard_kpis(db: Session, *, hours: float = 24.0, since: datetime | None = None) -> dict[str, Any]:
    start = _window_start(hours, since)
    now = _utcnow()

    # Cameras / streams (live state from the gateway, registry for totals).
    total_cameras = int(db.scalar(select(func.count()).select_from(Camera)) or 0)
    snapshots = gateway.list_snapshots()
    live_streams = sum(1 for s in snapshots if s.state == StreamState.LIVE)
    fleet = health_service.fleet_summary(db)

    # Vehicle intelligence (windowed).
    def count(stmt) -> int:
        return int(db.scalar(stmt) or 0)

    tracks_window = select(func.count()).select_from(VehicleTrack)
    vehicles_window = select(func.count()).select_from(Vehicle)
    anpr_window = select(func.count()).select_from(AnprSighting)
    matches_window = select(func.count()).select_from(WatchlistMatch)
    if start:
        tracks_window = tracks_window.where(VehicleTrack.last_seen >= start)
        vehicles_window = vehicles_window.where(Vehicle.last_seen >= start)
        anpr_window = anpr_window.where(AnprSighting.seen_at >= start)
        matches_window = matches_window.where(WatchlistMatch.matched_at >= start)

    vehicles_detected = count(tracks_window)
    unique_vehicles = count(vehicles_window)
    anpr_hits = count(anpr_window)
    watchlist_matches = count(matches_window)

    # Alerts.
    alerts_open = count(
        select(func.count()).select_from(Alert).where(Alert.status != ALERT_STATUS_RESOLVED)
    )
    alerts_new = count(
        select(func.count()).select_from(Alert).where(Alert.status == "NEW")
    )

    # Active watchlist entries.
    watchlist_active = count(
        select(func.count()).select_from(WatchlistEntry).where(WatchlistEntry.is_active.is_(True))
    )

    return {
        "window": {"hours": hours, "since": _iso(start), "until": now.isoformat()},
        "total_cameras": total_cameras,
        "live_cameras": live_streams,
        "offline_cameras": fleet["counts"].get("OFFLINE", 0),
        "degraded_cameras": fleet["counts"].get("DEGRADED", 0),
        "monitored_cameras": fleet["monitored"],
        "vehicles_detected": vehicles_detected,
        "unique_vehicles": unique_vehicles,
        "anpr_hits": anpr_hits,
        "watchlist_matches": watchlist_matches,
        "watchlist_active_entries": watchlist_active,
        "active_alerts": alerts_open,
        "new_alerts": alerts_new,
        "camera_states": fleet["counts"],
        "generated_at": now.isoformat(),
    }


# --------------------------------------------------------------------------- #
# Activity timeseries
# --------------------------------------------------------------------------- #
def activity_series(
    db: Session, *, hours: float = 24.0, bucket: str = "hour", since: datetime | None = None
) -> dict[str, Any]:
    start = _window_start(hours, since) or (_utcnow() - timedelta(hours=24))
    now = _utcnow()

    if bucket == "day":
        step = timedelta(days=1)
        fmt = "%Y-%m-%d"
    elif bucket == "minute":
        step = timedelta(minutes=1)
        fmt = "%H:%M"
    else:
        step = timedelta(hours=1)
        fmt = "%Y-%m-%dT%H:00"

    sightings = db.execute(
        select(AnprSighting.seen_at).where(AnprSighting.seen_at >= start)
    ).scalars().all()
    matches = db.execute(
        select(WatchlistMatch.matched_at).where(WatchlistMatch.matched_at >= start)
    ).scalars().all()
    alerts = db.execute(
        select(Alert.created_at).where(Alert.created_at >= start)
    ).scalars().all()

    def bucketize(timestamps: list[datetime]) -> dict[str, int]:
        out: dict[str, int] = {}
        for ts in timestamps:
            ts = _aware(ts)
            if ts is None:
                continue
            if bucket == "day":
                key = ts.strftime(fmt)
            elif bucket == "minute":
                key = ts.strftime(fmt)
            else:
                key = ts.replace(minute=0, second=0, microsecond=0).strftime(fmt)
            out[key] = out.get(key, 0) + 1
        return out

    s_buckets = bucketize(sightings)
    m_buckets = bucketize(matches)
    a_buckets = bucketize(alerts)

    points = []
    cursor = start
    if bucket != "minute":
        cursor = cursor.replace(minute=0, second=0, microsecond=0)
    while cursor <= now:
        key = cursor.strftime(fmt)
        points.append(
            {
                "bucket": key,
                "detections": s_buckets.get(key, 0),
                "watchlist_matches": m_buckets.get(key, 0),
                "alerts": a_buckets.get(key, 0),
            }
        )
        cursor += step
        if len(points) > 2000:  # hard cap for absurd windows
            break
    return {
        "bucket": bucket,
        "since": start.isoformat(),
        "until": now.isoformat(),
        "points": points,
    }


# --------------------------------------------------------------------------- #
# Analytics summary
# --------------------------------------------------------------------------- #
def analytics_summary(
    db: Session, *, hours: float = 24.0, since: datetime | None = None, until: datetime | None = None
) -> dict[str, Any]:
    start = _window_start(hours, since)
    end = _aware(until)

    def scope(col):
        stmt = select(col)
        if start is not None:
            stmt = stmt.where(col >= start)
        if end is not None:
            stmt = stmt.where(col <= end)
        return stmt

    # Vehicle classes detected (from tracks).
    class_rows = db.execute(
        scope(VehicleTrack.last_seen).with_only_columns(
            VehicleTrack.vehicle_class, func.count()
        ).group_by(VehicleTrack.vehicle_class)
    ).all()
    vehicle_types = {row[0] or "unknown": int(row[1]) for row in class_rows}

    # Hourly heatmap of ANPR reads.
    hourly_rows = db.execute(
        select(AnprSighting.seen_at).where(
            *([AnprSighting.seen_at >= start] if start else []),
            *([AnprSighting.seen_at <= end] if end else []),
        )
    ).scalars().all()
    hour_hist = [0] * 24
    for ts in hourly_rows:
        ts = _aware(ts)
        if ts:
            hour_hist[ts.hour] += 1

    # Top cameras by ANPR reads.
    top_camera_rows = db.execute(
        select(AnprSighting.camera_id, func.count())
        .where(
            *([AnprSighting.seen_at >= start] if start else []),
            *([AnprSighting.seen_at <= end] if end else []),
        )
        .group_by(AnprSighting.camera_id)
        .order_by(desc(func.count()))
        .limit(10)
    ).all()
    top_cameras = [
        {"camera_id": row[0], "reads": int(row[1])} for row in top_camera_rows
    ]

    # ANPR performance.
    perf = db.execute(
        select(func.count(AnprSighting.id), func.avg(AnprSighting.ocr_confidence))
        .where(
            *([AnprSighting.seen_at >= start] if start else []),
            *([AnprSighting.seen_at <= end] if end else []),
        )
    ).one()
    anpr_reads = int(perf[0] or 0)
    avg_confidence = float(perf[1] or 0.0)

    # Watchlist match trend + alert stats + journey anomalies.
    match_rows = db.execute(
        scope(WatchlistMatch.matched_at).with_only_columns(func.count())
    ).scalar()
    anomaly_rows = db.execute(
        scope(JourneyPoint.seen_at).with_only_columns(func.count()).where(JourneyPoint.anomaly.is_(True))
    ).scalar()
    alert_stats = alerts_service.alert_stats(
        db, since=start if start else None
    )

    kpis = dashboard_kpis(db, hours=hours, since=since)
    return {
        "window": kpis["window"],
        "kpis": kpis,
        "vehicle_types": vehicle_types,
        "hourly_histogram": hour_hist,
        "top_cameras": top_cameras,
        "anpr": {
            "reads": anpr_reads,
            "avg_confidence": round(avg_confidence, 4),
        },
        "watchlist_matches": int(match_rows or 0),
        "journey_anomalies": int(anomaly_rows or 0),
        "alerts": alert_stats,
    }


def detection_activity(db: Session, *, hours: float = 24.0) -> list[dict[str, Any]]:
    """Recent detection/ANPR/watchlist/alert counts for the dashboard charts."""
    series = activity_series(db, hours=hours, bucket="hour")
    return series["points"]


def recent_journey_summaries(db: Session, *, limit: int = 6) -> list[dict[str, Any]]:
    """Latest journeys (multi-stop) for the dashboard timeline panel."""
    rows = db.execute(
        select(JourneyPoint.plate, func.max(JourneyPoint.seen_at).label("last_seen"))
        .group_by(JourneyPoint.plate)
        .order_by(desc("last_seen"))
        .limit(limit)
    ).all()
    out = []
    for plate, last_seen in rows:
        points = db.query(JourneyPoint).filter(JourneyPoint.plate == plate).order_by(
            JourneyPoint.journey_id, JourneyPoint.sequence
        ).all()
        latest_journey = points[-1].journey_id if points else 1
        stops = [p for p in points if p.journey_id == latest_journey]
        out.append(
            {
                "plate": plate,
                "journey_id": latest_journey,
                "stops": [
                    {
                        "sequence": p.sequence,
                        "camera_id": p.camera_id,
                        "location_name": p.location_name,
                        "timestamp": _iso(p.seen_at),
                        "latitude": p.latitude,
                        "longitude": p.longitude,
                        "speed_kph": p.speed_kph,
                        "distance_km": p.distance_km,
                        "anomaly": p.anomaly,
                    }
                    for p in stops
                ],
                "last_seen": _iso(last_seen),
            }
        )
    return out

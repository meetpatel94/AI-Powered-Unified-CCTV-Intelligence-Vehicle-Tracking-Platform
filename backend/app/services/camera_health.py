"""Camera health monitoring service.

Runs a poller that merges the **dynamic Camera Registry** (Sentinel-fed) with
live Stream Gateway snapshots to produce a per-camera health record:

* state — LIVE / DEGRADED / RECONNECTING / OFFLINE / ERROR / UNKNOWN
* last frame time, last successful connection, reconnect count
* latency (frame age), codec, resolution, observed FPS, last error

Rules (per the platform contract):
* A single transient FFmpeg **decoder warning never marks a camera offline** —
  the gateway already logs those at DEBUG and keeps streaming.
* OFFLINE is only reported after ``CAMERA_HEALTH_OFFLINE_GRACE_POLLS``
  consecutive failed polls, or when the gateway worker itself gives up.
* Sustained failures raise a camera alert (once, deduplicated) and a recovered
  camera auto-resolves its standing alert.

State transitions and periodic frames are published on the WebSocket hub as
``camera:state`` and ``camera:health`` respectively.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.camera import Camera
from app.models.health import (
    HEALTH_DEGRADED,
    HEALTH_ERROR,
    HEALTH_LIVE,
    HEALTH_OFFLINE,
    HEALTH_RECONNECTING,
    HEALTH_UNKNOWN,
    CameraHealthEvent,
    CameraHealthStatus,
)
from app.services import alerts as alerts_service
from app.services.cameras import list_cameras
from app.services.events import publish
from app.services.stream_gateway import StreamState, gateway

logger = structlog.get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


# --------------------------------------------------------------------------- #
# State computation
# --------------------------------------------------------------------------- #
def compute_state(snapshot: dict[str, Any], *, prev_failures: int, settings) -> tuple[str, int]:
    """Return (state, consecutive_failures) for one gateway snapshot.

    ``snapshot`` is a StreamGateway ``StreamSnapshot.to_dict()`` payload (or an
    idle stub with state OFFLINE + rtsp_configured flag for registry cameras
    with no worker).
    """
    state = (snapshot.get("state") or HEALTH_UNKNOWN).upper()

    if state == StreamState.LIVE.value:
        # Degraded: frames flowing but well below the configured FPS, or the
        # last frame is older than twice the stale window.
        last_frame_at = _parse_iso(snapshot.get("last_frame_at"))
        frame_age = (_utcnow() - last_frame_at).total_seconds() if last_frame_at else None
        fps = float(snapshot.get("measured_fps") or 0.0)
        if (frame_age is not None and frame_age > settings.stream_stale_seconds * 2) or (
            fps > 0 and fps < settings.camera_health_degraded_fps
        ):
            return HEALTH_DEGRADED, 0
        return HEALTH_LIVE, 0

    if state in (StreamState.RECONNECTING.value, StreamState.CONNECTING.value):
        # Reconnect attempts are transient — not counted as failures until the
        # worker itself gives up (OFFLINE/ERROR).
        return HEALTH_RECONNECTING, prev_failures

    if state in (StreamState.ERROR.value, StreamState.OFFLINE.value):
        failures = prev_failures + 1
        if failures >= settings.camera_health_offline_grace_polls:
            return HEALTH_OFFLINE, failures
        return HEALTH_ERROR, failures

    if state == StreamState.STOPPED.value:
        # Operator-initiated stop: report OFFLINE (nothing is streaming) but do
        # not accumulate failures — alerts are suppressed for deliberate stops.
        return HEALTH_OFFLINE, prev_failures

    return HEALTH_UNKNOWN, prev_failures


# --------------------------------------------------------------------------- #
# Persistence
# --------------------------------------------------------------------------- #
def health_dict(
    status: CameraHealthStatus,
    *,
    camera: Camera | None = None,
    stream: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = {
        "camera_id": status.camera_id,
        "state": status.state,
        "monitored": status.monitored,
        "rtsp_configured": bool(camera.rtsp_url) if camera else None,
        "last_frame_at": _iso(status.last_frame_at),
        "last_success_at": _iso(status.last_success_at),
        "reconnect_count": status.reconnect_count,
        "latency_ms": status.latency_ms,
        "frame_age_s": (
            round((_utcnow() - status.last_frame_at).total_seconds(), 1)
            if status.last_frame_at
            else None
        ),
        "codec": status.codec,
        "resolution": status.resolution,
        "observed_fps": status.observed_fps,
        "last_error": status.last_error,
        "stream_started_at": _iso(status.stream_started_at),
        "updated_at": _iso(status.updated_at),
    }
    if camera is not None:
        data.update(
            {
                "location_name": camera.location_name,
                "department": camera.department,
                "latitude": camera.latitude,
                "longitude": camera.longitude,
                "camera_type": camera.camera_type,
                "registry_status": camera.status,
                "live_frame_path": f"/api/streams/{camera.camera_id}/frame.jpg",
            }
        )
    if stream is not None:
        data["stream"] = {
            k: stream.get(k)
            for k in (
                "state",
                "measured_fps",
                "source_fps",
                "frame_count",
                "reconnect_attempt",
                "next_retry_in_s",
                "uptime_s",
                "width",
                "height",
                "last_pts_ms",
            )
        }
    return data


def _ensure_row(db: Session, camera_id: str) -> CameraHealthStatus:
    row = db.get(CameraHealthStatus, camera_id)
    if row is None:
        row = CameraHealthStatus(camera_id=camera_id, state=HEALTH_UNKNOWN)
        db.add(row)
        db.flush()
    return row


def poll_once(db: Session) -> list[dict[str, Any]]:
    """One health poll across the whole dynamic registry."""
    settings = get_settings()
    cameras = list_cameras(db)
    snapshots = {s.camera_id: s.to_dict() for s in gateway.list_snapshots()}
    updated: list[dict[str, Any]] = []

    for camera in cameras:
        snap = snapshots.get(camera.camera_id)
        monitored = snap is not None
        if snap is None:
            # Registry camera with no stream worker: UNKNOWN (never monitored),
            # never OFFLINE — absence of a worker is not a camera failure.
            snap = {
                "camera_id": camera.camera_id,
                "state": HEALTH_UNKNOWN,
                "rtsp_configured": bool(camera.rtsp_url),
                "last_error": None,
            }

        row = _ensure_row(db, camera.camera_id)
        state, failures = compute_state(snap, prev_failures=row.consecutive_failures, settings=settings)
        if not monitored:
            failures = 0  # no worker → no failure streak to carry

        prev_state = row.state
        row.state = state
        row.monitored = monitored
        row.consecutive_failures = failures

        last_frame_at = _parse_iso(snap.get("last_frame_at"))
        if last_frame_at:
            row.last_frame_at = last_frame_at
            if state in (HEALTH_LIVE, HEALTH_DEGRADED):
                row.last_success_at = last_frame_at
                row.latency_ms = max(0.0, round((_utcnow() - last_frame_at).total_seconds() * 1000, 1))
        if snap.get("codec"):
            row.codec = snap["codec"]
        if snap.get("resolution"):
            row.resolution = snap["resolution"]
        if snap.get("measured_fps") is not None:
            row.observed_fps = round(float(snap["measured_fps"]), 2)
        if snap.get("last_error"):
            row.last_error = str(snap["last_error"])[:500]
        elif state in (HEALTH_LIVE,):
            row.last_error = None
        if snap.get("started_at"):
            started = _parse_iso(snap["started_at"])
            if started and started != row.stream_started_at:
                row.stream_started_at = started
        if monitored:
            row.reconnect_count = max(row.reconnect_count, int(snap.get("reconnect_attempt") or 0))
        else:
            row.reconnect_count = 0

        # State transition → log + WebSocket event + camera alert lifecycle.
        if prev_state != state:
            db.add(
                CameraHealthEvent(
                    camera_id=camera.camera_id,
                    from_state=prev_state,
                    to_state=state,
                    reason=str(snap.get("last_error") or "")[:255] or None,
                    detail=(
                        f"monitored={monitored} failures={failures} fps={snap.get('measured_fps')}"
                    ),
                )
            )
            publish(
                "camera:state",
                {
                    "camera_id": camera.camera_id,
                    "from_state": prev_state,
                    "to_state": state,
                    "timestamp": _utcnow().isoformat(),
                },
            )
            logger.info(
                "camera_health.state",
                camera_id=camera.camera_id,
                from_state=prev_state,
                to_state=state,
            )
            if settings.alert_on_camera_failure and snap.get("state") != StreamState.STOPPED.value:
                if state == HEALTH_OFFLINE:
                    alerts_service.raise_camera_alert(
                        db,
                        camera_id=camera.camera_id,
                        failure_type="CAMERA_OFFLINE",
                        detail=str(snap.get("last_error") or "stream worker down"),
                        location_name=camera.location_name,
                    )
                elif state == HEALTH_ERROR and prev_state not in (HEALTH_ERROR, HEALTH_OFFLINE):
                    alerts_service.raise_camera_alert(
                        db,
                        camera_id=camera.camera_id,
                        failure_type="CAMERA_ERROR",
                        detail=str(snap.get("last_error") or "stream error"),
                        location_name=camera.location_name,
                    )
                elif prev_state in (HEALTH_OFFLINE, HEALTH_ERROR) and state in (HEALTH_LIVE, HEALTH_DEGRADED):
                    alerts_service.resolve_camera_alerts(db, camera.camera_id)

        db.flush()
        updated.append(health_dict(row, camera=camera, stream=snap if monitored else None))

    db.commit()
    return updated


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #
def list_health(db: Session) -> list[dict[str, Any]]:
    """Health rows joined with the registry + live gateway snapshot."""
    cameras = list_cameras(db)
    snapshots = {s.camera_id: s.to_dict() for s in gateway.list_snapshots()}
    rows = {r.camera_id: r for r in db.scalars(select(CameraHealthStatus)).all()}
    out = []
    for camera in cameras:
        row = rows.get(camera.camera_id)
        if row is None:
            row = CameraHealthStatus(camera_id=camera.camera_id, state=HEALTH_UNKNOWN)
        out.append(health_dict(row, camera=camera, stream=snapshots.get(camera.camera_id)))
    out.sort(key=lambda h: h["camera_id"])
    return out


def get_health(db: Session, camera_id: str) -> dict[str, Any] | None:
    camera = db.get(Camera, camera_id)
    if camera is None:
        return None
    row = db.get(CameraHealthStatus, camera_id)
    if row is None:
        row = CameraHealthStatus(camera_id=camera_id, state=HEALTH_UNKNOWN)
    snap = None
    worker = gateway.get_worker(camera_id)
    if worker is not None:
        snap = worker.snapshot().to_dict()
    return health_dict(row, camera=camera, stream=snap)


def fleet_summary(db: Session) -> dict[str, Any]:
    rows = list_health(db)
    counts: dict[str, int] = {s: 0 for s in (
        HEALTH_LIVE, HEALTH_DEGRADED, HEALTH_RECONNECTING, HEALTH_OFFLINE, HEALTH_ERROR, HEALTH_UNKNOWN,
    )}
    for row in rows:
        counts[row["state"]] = counts.get(row["state"], 0) + 1
    total = len(rows)
    live = counts[HEALTH_LIVE] + counts[HEALTH_DEGRADED]
    return {
        "total": total,
        "live": live,
        "counts": counts,
        "online_percent": round(100.0 * live / total, 1) if total else 0.0,
        "monitored": sum(1 for r in rows if r["monitored"]),
    }


def recent_events(db: Session, *, limit: int = 50, camera_id: str | None = None) -> list[dict[str, Any]]:
    stmt = select(CameraHealthEvent).order_by(desc(CameraHealthEvent.created_at)).limit(limit)
    if camera_id:
        stmt = (
            select(CameraHealthEvent)
            .where(CameraHealthEvent.camera_id == camera_id)
            .order_by(desc(CameraHealthEvent.created_at))
            .limit(limit)
        )
    rows = db.scalars(stmt).all()
    return [
        {
            "id": e.id,
            "camera_id": e.camera_id,
            "from_state": e.from_state,
            "to_state": e.to_state,
            "reason": e.reason,
            "detail": e.detail,
            "created_at": _iso(e.created_at),
        }
        for e in rows
    ]


# --------------------------------------------------------------------------- #
# Background poller
# --------------------------------------------------------------------------- #
class HealthMonitor:
    """Periodic poller publishing ``camera:health`` frames + transitions."""

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="camera-health-monitor", daemon=True)
        self._thread.start()
        logger.info("camera_health.monitor.started")

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _run(self) -> None:
        from app.db.session import SessionLocal

        settings = get_settings()
        while not self._stop.wait(settings.camera_health_poll_seconds):
            try:
                db = SessionLocal()
                try:
                    updated = poll_once(db)
                finally:
                    db.close()
                for frame in updated:
                    publish("camera:health", frame)
            except Exception:
                logger.exception("camera_health.poll_error")


monitor = HealthMonitor()

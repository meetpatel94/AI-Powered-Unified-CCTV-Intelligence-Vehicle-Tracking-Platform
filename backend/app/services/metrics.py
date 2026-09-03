"""System monitoring + metrics aggregation.

Aggregates runtime metrics from every layer of the platform into a single,
secret-free snapshot used by ``/api/system/health``,
``/api/system/readiness`` and ``/api/system/metrics``:

* registry cameras (total / live / offline / with RTSP),
* active stream gateway workers and their state, FPS, dropped frames,
  reconnect count, codec and PTS,
* active AI pipeline workers: inference FPS, frame counters, inference and
  ANPR latency (EWMA), queue pressure,
* WebSocket clients connected to the realtime hub,
* database connectivity (and PostGIS availability),
* recent in-process errors (ring buffer — messages only, never secrets).

Nothing here returns credentials, RTSP URLs or request bodies.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque

import structlog

from app.core.config import get_settings
from app.db.session import check_database, engine
from app.services.events import hub
from app.services.pipeline import manager as pipeline_manager
from app.services.stream_gateway import gateway

logger = structlog.get_logger(__name__)


class ErrorRing:
    """Bounded, thread-safe ring buffer of recent error summaries."""

    def __init__(self, maxlen: int = 100) -> None:
        self._items: Deque[dict[str, Any]] = deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def add(self, source: str, message: str, *, path: str | None = None) -> None:
        msg = (message or "")[:300]
        with self._lock:
            self._items.append(
                {
                    "at": datetime.now(timezone.utc).isoformat(),
                    "source": source[:64],
                    "path": path[:255] if path else None,
                    "message": msg,
                }
            )

    def recent(self, limit: int | None = None) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._items)
        if limit:
            return items[-limit:]
        return items


errors = ErrorRing(maxlen=100)


def _postgis_available() -> bool:
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT 1 FROM pg_available_extensions WHERE name='postgis'")
            ).first()
        return bool(row)
    except Exception:
        return False


def database_metrics() -> dict[str, Any]:
    db_ok = check_database()
    pool = engine.pool
    try:
        checked_out = pool.checkedout()
        pool_size = pool.size()
        overflow = pool.overflow()
    except Exception:
        checked_out = pool_size = overflow = None
    return {
        "status": "connected" if db_ok else "unavailable",
        "postgis_available": _postgis_available() if db_ok else False,
        "pool": {
            "size": pool_size,
            "checked_out": checked_out,
            "overflow": overflow,
        },
    }


def stream_metrics() -> dict[str, Any]:
    snaps = gateway.list_snapshots()
    by_state: dict[str, int] = {}
    live = 0
    measured_fps: list[float] = []
    dropped = 0
    reconnects = 0
    for s in snaps:
        by_state[s.state.value if hasattr(s.state, "value") else str(s.state)] = (
            by_state.get(s.state.value if hasattr(s.state, "value") else str(s.state), 0) + 1
        )
        if (s.state.value if hasattr(s.state, "value") else str(s.state)) == "LIVE":
            live += 1
        if s.measured_fps:
            measured_fps.append(float(s.measured_fps))
        dropped += int(getattr(s, "frames_dropped", 0) or 0)
        reconnects += int(s.reconnect_attempt or 0)
    return {
        "workers_total": len(snaps),
        "live": live,
        "by_state": by_state,
        "avg_fps": round(sum(measured_fps) / len(measured_fps), 2) if measured_fps else 0.0,
        "sum_fps": round(sum(measured_fps), 2),
        "frames_dropped_total": dropped,
        "reconnect_attempts_total": reconnects,
        "max_workers_configured": get_settings().stream_max_workers,
    }


def pipeline_metrics() -> dict[str, Any]:
    workers = pipeline_manager.list_status()
    active = [w for w in workers if w.get("alive")]
    frames_processed = sum(int(w.get("frames_processed", 0)) for w in workers)
    frames_skipped = sum(int(w.get("frames_skipped", 0)) for w in workers)
    detections = sum(int(w.get("detections_total", 0)) for w in workers)
    anpr_reads = sum(int(w.get("anpr_reads", 0)) for w in workers)
    latencies = [w.get("avg_inference_ms") for w in workers if w.get("avg_inference_ms")]
    anpr_lat = [w.get("avg_anpr_ms") for w in workers if w.get("avg_anpr_ms")]
    queue_depth = sum(int(w.get("queue_depth", 0)) for w in workers)
    return {
        "workers_total": len(workers),
        "workers_active": len(active),
        "detector_ready_any": any(w.get("detector_ready") for w in workers),
        "synthetic_any": any(w.get("synthetic") for w in workers),
        "frames_processed_total": frames_processed,
        "frames_skipped_total": frames_skipped,
        "detections_total": detections,
        "anpr_reads_total": anpr_reads,
        "avg_inference_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
        "avg_anpr_ms": round(sum(anpr_lat) / len(anpr_lat), 1) if anpr_lat else None,
        "queue_depth_total": queue_depth,
        "max_workers_configured": get_settings().vehicle_pipeline_max_workers,
        "max_concurrent_inference_configured": get_settings().ai_max_concurrent_inference,
    }


def registry_metrics() -> dict[str, Any]:
    """Camera counts from the registry (DB-dependent; zeroed when unreachable)."""
    try:
        from app.db.session import SessionLocal
        from app.models.camera import Camera
        from sqlalchemy import func, select

        db = SessionLocal()
        try:
            total = int(db.scalar(select(func.count()).select_from(Camera)) or 0)
            with_rtsp = int(
                db.scalar(
                    select(func.count())
                    .select_from(Camera)
                    .where(Camera.rtsp_url.isnot(None), Camera.rtsp_url != "")
                ) or 0
            )
            return {"total": total, "with_rtsp": with_rtsp}
        finally:
            db.close()
    except Exception:
        return {"total": 0, "with_rtsp": 0}


def snapshot() -> dict[str, Any]:
    """Full secret-free metrics snapshot."""
    settings = get_settings()
    db = database_metrics()
    streams = stream_metrics()
    pipeline = pipeline_metrics()
    registry = registry_metrics()
    ws_clients = hub.subscriber_count()

    healthy = db["status"] == "connected"
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "service": settings.app_name,
        "environment": settings.app_env,
        "status": "ok" if healthy else "degraded",
        "database": db,
        "registry": registry,
        "streams": streams,
        "pipeline": pipeline,
        "websocket": {
            "clients": ws_clients,
            "history_depth": hub.history_depth(),
            "dropped_frames_total": hub.dropped_count(),
        },
        "recent_errors": errors.recent(settings.metrics_recent_errors),
    }


def readiness() -> tuple[dict[str, Any], bool]:
    """Readiness probe. Ready only when the database accepts connections."""
    db = database_metrics()
    ready = db["status"] == "connected"
    return (
        {
            "ready": ready,
            "database": db["status"],
            "postgis_available": db["postgis_available"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
        },
        ready,
    )


def liveness() -> dict[str, Any]:
    """Liveness probe — the process is up and can serve requests."""
    return {
        "status": "alive",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _START_TIME, 1),
    }


_START_TIME = time.time()

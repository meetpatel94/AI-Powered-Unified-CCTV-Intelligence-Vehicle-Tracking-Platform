"""System monitoring API — health, readiness and operational metrics.

* ``GET /api/system/health``    — liveness + a compact status summary (200).
* ``GET /api/system/readiness`` — readiness probe; 503 until the DB is ready
  (used by Docker/orchestrator health gating and dependency ordering).
* ``GET /api/system/metrics``   — full secret-free metrics snapshot (RBAC).

No endpoint here returns credentials, RTSP URLs or request bodies.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse

from app.api.deps import require_permission
from app.core.permissions import SYSTEM_METRICS_READ
from app.services import metrics as metrics_service
from app.services.auth import Principal

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
def health() -> dict:
    """Liveness: the process is up. Includes a compact status for operators."""
    snap = metrics_service.snapshot()
    return {
        "status": "ok",
        "service": snap["service"],
        "environment": snap["environment"],
        "database": snap["database"]["status"],
        "streams_live": snap["streams"]["live"],
        "pipeline_workers": snap["pipeline"]["workers_active"],
        "websocket_clients": snap["websocket"]["clients"],
    }


@router.get("/readiness")
def readiness(response: Response) -> JSONResponse:
    """Readiness: true only when the database (and core config) are ready."""
    body, ready = metrics_service.readiness()
    return JSONResponse(
        status_code=200 if ready else 503,
        content=body,
    )


@router.get("/metrics")
def metrics(
    _: Principal = Depends(require_permission(SYSTEM_METRICS_READ)),
) -> dict:
    """Full operational metrics (authenticated). Secret-free."""
    return metrics_service.snapshot()

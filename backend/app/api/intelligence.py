"""Vehicle Intelligence Pipeline control + recent activity APIs + WebSocket."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import (
    DETECTIONS_READ,
    INGEST_CONTROL,
    PIPELINE_CONTROL,
    PIPELINE_READ,
)
from app.db.session import get_db
from app.models.audit import ACTION_PIPELINE_START, ACTION_PIPELINE_STOP
from app.services import audit as audit_service
from app.schemas.vehicle import (
    JourneyPointOut,
    PipelineActionResult,
    PipelineWorkerStatus,
    SightingOut,
    TrackOut,
)
from app.services import vehicle_intel as vi
from app.services.auth import Principal
from app.services.cameras import get_camera
from app.services.events import hub
from app.services.pipeline import manager

router = APIRouter(prefix="/api", tags=["intelligence"])


# --------------------------------------------------------------------------- #
# Recent activity
# --------------------------------------------------------------------------- #
@router.get("/detections/recent", response_model=list[SightingOut])
def recent_detections(
    limit: int = Query(50, ge=1, le=500),
    camera_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DETECTIONS_READ)),
) -> list[SightingOut]:
    """Recent ANPR-confirmed detections (persisted sightings)."""
    return [SightingOut(**s) for s in vi.recent_sightings(db, limit, camera_id)]


@router.get("/anpr/recent", response_model=list[SightingOut])
def recent_anpr(
    limit: int = Query(50, ge=1, le=500),
    camera_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DETECTIONS_READ)),
) -> list[SightingOut]:
    return [SightingOut(**s) for s in vi.recent_sightings(db, limit, camera_id)]


@router.get("/tracking/recent", response_model=list[TrackOut])
def recent_tracking(
    limit: int = Query(50, ge=1, le=500),
    camera_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DETECTIONS_READ)),
) -> list[TrackOut]:
    return [TrackOut(**t) for t in vi.recent_tracks(db, limit, camera_id)]


@router.get("/journeys/recent")
def recent_journeys(
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(DETECTIONS_READ)),
) -> list[dict]:
    return vi.recent_journeys(db, limit)


# --------------------------------------------------------------------------- #
# Pipeline control
# --------------------------------------------------------------------------- #
@router.get("/pipeline", response_model=list[PipelineWorkerStatus])
def pipeline_status(
    _: Principal = Depends(require_permission(PIPELINE_READ)),
) -> list[PipelineWorkerStatus]:
    return [PipelineWorkerStatus(**s) for s in manager.list_status()]


@router.get("/pipeline/summary")
def pipeline_summary(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(PIPELINE_READ)),
) -> dict:
    return {
        "workers": manager.list_status(),
        "counts": vi.pipeline_counts(db),
    }


@router.get("/ai/status")
def ai_status(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(PIPELINE_READ)),
) -> dict:
    """Global AI health: model readiness/device/weights, ANPR provider state,
    per-camera worker trust flags, effective inference rates and DB counts.

    Never fabricates readiness: with a missing/unloadable model this returns
    ``status=MODEL_NOT_READY`` / ``model.ready=false`` while the rest of the
    platform keeps running.
    """
    from app.services.pipeline import ai_status_snapshot

    return ai_status_snapshot(db=db)


@router.post("/pipeline/{camera_id}/start", response_model=PipelineActionResult)
def pipeline_start(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(PIPELINE_CONTROL)),
) -> PipelineActionResult:
    if get_camera(db, camera_id) is None:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    try:
        status = manager.start(camera_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_PIPELINE_START,
        principal=principal,
        resource_type="pipeline_worker",
        resource_id=camera_id,
        detail=f"AI pipeline started for {camera_id}",
        context={"camera_id": camera_id},
        request=request,
    )
    return PipelineActionResult(
        camera_id=camera_id, action="start", status=PipelineWorkerStatus(**status)
    )


@router.post("/pipeline/{camera_id}/stop", response_model=PipelineActionResult)
def pipeline_stop(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(PIPELINE_CONTROL)),
) -> PipelineActionResult:
    status = manager.stop(camera_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"No pipeline worker for {camera_id}")
    audit_service.record(
        db=db,
        action=ACTION_PIPELINE_STOP,
        principal=principal,
        resource_type="pipeline_worker",
        resource_id=camera_id,
        detail=f"AI pipeline stopped for {camera_id}",
        context={"camera_id": camera_id},
        request=request,
    )
    return PipelineActionResult(
        camera_id=camera_id, action="stop", status=PipelineWorkerStatus(**status)
    )


# --------------------------------------------------------------------------- #
# WebSocket realtime feed
# --------------------------------------------------------------------------- #
@router.websocket("/ws")
async def ws_realtime(websocket: WebSocket, token: str | None = Query(None)) -> None:
    """Realtime feed of pipeline / watchlist / alert / camera-health events.

    Frames are ``{"event": <name>, "payload": {...}}`` — matching the frontend
    ``services/realtime.ts`` contract. Event topics:
    ``detection`` / ``vehicle:detected``, ``anpr:hit``, ``track`` /
    ``vehicle:tracked``, ``journey``, ``watchlist:match``, ``alert:new``,
    ``alert:update``, ``camera:state``, ``camera:health`` and the low-frequency
    global ``ai:status`` frame.

    When ``AUTH_ENABLED=true`` a valid access token must be supplied via
    ``?token=...`` (browsers cannot set WebSocket headers); the feed is open in
    development open-mode.
    """
    from app.core.config import get_settings
    from app.db.session import SessionLocal
    from app.services import auth as auth_service

    settings = get_settings()
    if settings.auth_enabled:
        if not token:
            await websocket.close(code=4401, reason="Authentication required")
            return
        db = SessionLocal()
        try:
            auth_service.resolve_principal_from_token(db, token)
        except Exception:
            await websocket.close(code=4401, reason="Invalid token")
            return
        finally:
            db.close()

    await websocket.accept()
    queue = await hub.subscribe()
    # Replay a short history so a freshly-connected client isn't blank.
    try:
        for frame in hub.recent()[-25:]:
            await websocket.send_json(frame)
        while True:
            frame = await queue.get()
            await websocket.send_json(frame)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.unsubscribe(queue)

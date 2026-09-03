"""Vehicle Intelligence Pipeline control + recent activity APIs + WebSocket."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.vehicle import (
    JourneyPointOut,
    PipelineActionResult,
    PipelineWorkerStatus,
    SightingOut,
    TrackOut,
)
from app.services import vehicle_intel as vi
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
) -> list[SightingOut]:
    """Recent ANPR-confirmed detections (persisted sightings)."""
    return [SightingOut(**s) for s in vi.recent_sightings(db, limit, camera_id)]


@router.get("/anpr/recent", response_model=list[SightingOut])
def recent_anpr(
    limit: int = Query(50, ge=1, le=500),
    camera_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[SightingOut]:
    return [SightingOut(**s) for s in vi.recent_sightings(db, limit, camera_id)]


@router.get("/tracking/recent", response_model=list[TrackOut])
def recent_tracking(
    limit: int = Query(50, ge=1, le=500),
    camera_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[TrackOut]:
    return [TrackOut(**t) for t in vi.recent_tracks(db, limit, camera_id)]


@router.get("/journeys/recent")
def recent_journeys(
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[dict]:
    return vi.recent_journeys(db, limit)


# --------------------------------------------------------------------------- #
# Pipeline control
# --------------------------------------------------------------------------- #
@router.get("/pipeline", response_model=list[PipelineWorkerStatus])
def pipeline_status() -> list[PipelineWorkerStatus]:
    return [PipelineWorkerStatus(**s) for s in manager.list_status()]


@router.get("/pipeline/summary")
def pipeline_summary(db: Session = Depends(get_db)) -> dict:
    return {
        "workers": manager.list_status(),
        "counts": vi.pipeline_counts(db),
    }


@router.post("/pipeline/{camera_id}/start", response_model=PipelineActionResult)
def pipeline_start(camera_id: str, db: Session = Depends(get_db)) -> PipelineActionResult:
    if get_camera(db, camera_id) is None:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    try:
        status = manager.start(camera_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    return PipelineActionResult(
        camera_id=camera_id, action="start", status=PipelineWorkerStatus(**status)
    )


@router.post("/pipeline/{camera_id}/stop", response_model=PipelineActionResult)
def pipeline_stop(camera_id: str) -> PipelineActionResult:
    status = manager.stop(camera_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"No pipeline worker for {camera_id}")
    return PipelineActionResult(
        camera_id=camera_id, action="stop", status=PipelineWorkerStatus(**status)
    )


# --------------------------------------------------------------------------- #
# WebSocket realtime feed
# --------------------------------------------------------------------------- #
@router.websocket("/ws")
async def ws_realtime(websocket: WebSocket) -> None:
    """Realtime feed of detection / anpr:hit / track / journey events.

    Frames are ``{"event": <name>, "payload": {...}}`` — matching the frontend
    ``services/realtime.ts`` contract.
    """
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

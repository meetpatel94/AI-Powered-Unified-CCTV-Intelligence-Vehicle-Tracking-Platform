"""Camera Health API — fleet status, per-camera detail, events, control."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import CAMERAS_CONTROL, HEALTH_READ
from app.db.session import get_db
from app.models.audit import (
    ACTION_CAMERA_REFRESH,
    ACTION_CAMERA_RESTART,
)
from app.schemas.stream import StreamActionResult, StreamStatus
from app.services import audit as audit_service
from app.services import camera_health as health_service
from app.services.auth import Principal
from app.services.cameras import get_camera
from app.services.demo_stream import demo_stream_status, is_demo_camera
from app.services.stream_gateway import gateway

router = APIRouter(prefix="/api/cameras", tags=["camera-health"])


@router.get("/health")
def fleet_health(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(HEALTH_READ)),
) -> dict:
    """Health snapshot for every registry camera + fleet summary."""
    rows = health_service.list_health(db)
    return {"items": rows, "summary": health_service.fleet_summary(db)}


@router.get("/health/events")
def health_events(
    limit: int = Query(50, ge=1, le=500),
    camera_id: str | None = Query(None, max_length=64),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(HEALTH_READ)),
) -> list[dict]:
    return health_service.recent_events(db, limit=limit, camera_id=camera_id)


@router.get("/{camera_id}/health")
def camera_health(
    camera_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(HEALTH_READ)),
) -> dict:
    data = health_service.get_health(db, camera_id)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Camera {camera_id} not found")
    return data


@router.post("/{camera_id}/stream/restart", response_model=StreamActionResult)
def restart_stream(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(CAMERAS_CONTROL)),
) -> StreamActionResult:
    """Restart a camera stream (stop + start from the Camera Registry URL)."""
    camera = get_camera(db, camera_id)
    if camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Camera {camera_id} not found")
    if is_demo_camera(camera_id):
        # Demo cameras have no FFmpeg worker (shared local playback feed), so
        # restart is a worker-less no-op returning the demo playback status.
        return StreamActionResult(
            camera_id=camera_id,
            action="demo-playback",
            stream=StreamStatus(**demo_stream_status(camera_id)),
        )
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Camera has no RTSP URL from the Sentinel catalogue",
        )
    # Prefer an in-place restart (preserves worker + stats); fall back to a
    # full stop/start when no worker exists yet.
    snap = gateway.restart(camera_id, camera.rtsp_url) if gateway.get_worker(camera_id) else None
    if snap is None:
        gateway.stop(camera_id)
        try:
            snap = gateway.start(camera.camera_id, camera.rtsp_url, camera.hls_url)
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_CAMERA_RESTART,
        principal=principal,
        resource_type="camera",
        resource_id=camera_id,
        detail=f"Stream restarted for {camera_id} ({camera.location_name})",
        context={"camera_id": camera_id, "location": camera.location_name},
        request=request,
    )
    return StreamActionResult(
        camera_id=camera_id,
        action="restart",
        stream=StreamStatus(**snap.to_dict()),
    )


@router.post("/{camera_id}/stream/refresh", response_model=StreamActionResult)
def refresh_stream(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(CAMERAS_CONTROL)),
) -> StreamActionResult:
    """Re-read the camera's RTSP URL from the registry and restart the worker."""
    camera = get_camera(db, camera_id)
    if camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Camera {camera_id} not found")
    if is_demo_camera(camera_id):
        # Demo cameras have no FFmpeg worker (shared local playback feed).
        return StreamActionResult(
            camera_id=camera_id,
            action="demo-playback",
            stream=StreamStatus(**demo_stream_status(camera_id)),
        )
    if not camera.rtsp_url:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Camera has no RTSP URL")
    worker = gateway.get_worker(camera_id)
    if worker is not None:
        worker.update_url(camera.rtsp_url)
        snap = gateway.restart(camera_id, camera.rtsp_url)
    else:
        try:
            snap = gateway.start(camera.camera_id, camera.rtsp_url, camera.hls_url)
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_CAMERA_REFRESH,
        principal=principal,
        resource_type="camera",
        resource_id=camera_id,
        detail=f"Stream URL refreshed/restarted for {camera_id}",
        context={"camera_id": camera_id},
        request=request,
    )
    return StreamActionResult(
        camera_id=camera_id,
        action="refresh",
        stream=StreamStatus(**snap.to_dict()),
    )

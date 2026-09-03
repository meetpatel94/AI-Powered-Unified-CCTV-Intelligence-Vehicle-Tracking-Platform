"""Stream gateway HTTP API."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from fastapi import Request

from app.api.deps import require_permission
from app.core.permissions import CAMERAS_CONTROL, STREAMS_READ
from app.db.session import get_db
from app.models.audit import (
    ACTION_CAMERA_START,
    ACTION_CAMERA_STOP,
    RESULT_FAILURE,
    RESULT_SUCCESS,
)
from app.schemas.stream import StreamActionResult, StreamStatus
from app.services import audit as audit_service
from app.services.auth import Principal
from app.services.cameras import get_camera, list_cameras
from app.services.stream_gateway import StreamState, gateway

router = APIRouter(prefix="/api/streams", tags=["streams"])


def _status_or_idle(camera_id: str, rtsp_configured: bool) -> StreamStatus:
    worker = gateway.get_worker(camera_id)
    if worker:
        return StreamStatus(**worker.snapshot().to_dict())
    return StreamStatus(
        camera_id=camera_id,
        state=StreamState.OFFLINE.value,
        rtsp_configured=rtsp_configured,
        live_frame_path=f"/api/streams/{camera_id}/frame.jpg",
        live_mjpeg_path=f"/api/streams/{camera_id}/live",
    )


@router.get("", response_model=list[StreamStatus])
def list_streams(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(STREAMS_READ)),
) -> list[StreamStatus]:
    cameras = list_cameras(db)
    known = {c.camera_id: bool(c.rtsp_url) for c in cameras}
    out: list[StreamStatus] = []
    seen: set[str] = set()
    for snap in gateway.list_snapshots():
        seen.add(snap.camera_id)
        out.append(StreamStatus(**snap.to_dict()))
    for camera_id, has_rtsp in known.items():
        if camera_id not in seen:
            out.append(_status_or_idle(camera_id, has_rtsp))
    out.sort(key=lambda s: s.camera_id)
    return out


@router.get("/{camera_id}/status", response_model=StreamStatus)
def stream_status(
    camera_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(STREAMS_READ)),
) -> StreamStatus:
    camera = get_camera(db, camera_id)
    if camera is None and gateway.get_worker(camera_id) is None:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return _status_or_idle(camera_id, bool(camera.rtsp_url) if camera else False)


@router.post("/{camera_id}/start", response_model=StreamActionResult)
def start_stream(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(CAMERAS_CONTROL)),
) -> StreamActionResult:
    camera = get_camera(db, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=409,
            detail="Camera has no RTSP URL from the Sentinel catalogue",
        )
    try:
        snap = gateway.start(camera.camera_id, camera.rtsp_url)
    except RuntimeError as exc:
        audit_service.record(
            db=db,
            action=ACTION_CAMERA_START,
            principal=principal,
            resource_type="camera",
            resource_id=camera_id,
            result=RESULT_FAILURE,
            detail=f"Stream start failed: {exc}",
            request=request,
        )
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_CAMERA_START,
        principal=principal,
        resource_type="camera",
        resource_id=camera_id,
        detail=f"Stream started for {camera_id} ({camera.location_name})",
        context={"camera_id": camera_id, "location": camera.location_name},
        request=request,
    )
    return StreamActionResult(
        camera_id=camera_id,
        action="start",
        stream=StreamStatus(**snap.to_dict()),
    )


@router.post("/{camera_id}/stop", response_model=StreamActionResult)
def stop_stream(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(CAMERAS_CONTROL)),
) -> StreamActionResult:
    snap = gateway.stop(camera_id)
    if snap is None:
        raise HTTPException(status_code=404, detail=f"No active stream for {camera_id}")
    audit_service.record(
        db=db,
        action=ACTION_CAMERA_STOP,
        principal=principal,
        resource_type="camera",
        resource_id=camera_id,
        detail=f"Stream stopped for {camera_id}",
        context={"camera_id": camera_id},
        request=request,
    )
    return StreamActionResult(
        camera_id=camera_id,
        action="stop",
        stream=StreamStatus(**snap.to_dict()),
    )


@router.get("/{camera_id}/frame.jpg")
def live_frame(camera_id: str) -> Response:
    jpeg = gateway.latest_jpeg(camera_id)
    if not jpeg:
        raise HTTPException(status_code=404, detail="No live frame yet")
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )


@router.get("/{camera_id}/live")
async def live_mjpeg(camera_id: str) -> StreamingResponse:
    if gateway.get_worker(camera_id) is None:
        raise HTTPException(status_code=404, detail=f"No active stream for {camera_id}")

    async def generate():
        while True:
            jpeg = gateway.latest_jpeg(camera_id)
            if jpeg:
                yield (
                    b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                    + str(len(jpeg)).encode()
                    + b"\r\n\r\n"
                    + jpeg
                    + b"\r\n"
                )
            await asyncio.sleep(0.08)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )

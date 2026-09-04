"""Stream gateway HTTP API."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
import structlog

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from fastapi import Request

from app.api.deps import require_permission
from app.core.config import get_settings
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
from app.services.demo_stream import demo_playback_available, demo_stream_status, is_demo_camera
from app.services.stream_gateway import StreamState, gateway

logger = structlog.get_logger(__name__)


async def _sentinel_get(url: str) -> bytes:
    """Server-side fetch against the Sentinel origin (credentials stay here)."""
    settings = get_settings()
    auth = (
        (settings.sentinel_email.strip(), settings.sentinel_password.strip())
        if settings.sentinel_credentials_configured
        else None
    )
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(settings.sentinel_timeout_seconds),
        verify=settings.sentinel_verify_tls,
        follow_redirects=True,
        auth=auth,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content

router = APIRouter(prefix="/api/streams", tags=["streams"])


def _status_or_idle(
    camera_id: str, rtsp_configured: bool, hls_configured: bool = False
) -> StreamStatus:
    worker = gateway.get_worker(camera_id)
    if worker:
        return StreamStatus(**worker.snapshot().to_dict())
    if demo_playback_available(camera_id):
        # Seeded demo camera: no FFmpeg worker is ever created (its URLs are
        # non-routable by design); the frontend plays the shared local demo
        # feed through the same per-camera frame/MJPEG endpoints instead.
        return StreamStatus(**demo_stream_status(camera_id))
    return StreamStatus(
        camera_id=camera_id,
        state=StreamState.OFFLINE.value,
        rtsp_configured=rtsp_configured,
        hls_configured=hls_configured,
        availability="OFFLINE",
        hls_path=f"/api/streams/{camera_id}/hls/index.m3u8" if hls_configured else None,
        live_frame_path=f"/api/streams/{camera_id}/frame.jpg",
        live_mjpeg_path=f"/api/streams/{camera_id}/live",
    )


@router.get("", response_model=list[StreamStatus])
def list_streams(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(STREAMS_READ)),
) -> list[StreamStatus]:
    cameras = list_cameras(db)
    known = {c.camera_id: (bool(c.rtsp_url), bool(c.hls_url)) for c in cameras}
    out: list[StreamStatus] = []
    seen: set[str] = set()
    for snap in gateway.list_snapshots():
        seen.add(snap.camera_id)
        out.append(StreamStatus(**snap.to_dict()))
    for camera_id, (has_rtsp, has_hls) in known.items():
        if camera_id not in seen:
            out.append(_status_or_idle(camera_id, has_rtsp, has_hls))
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
    return _status_or_idle(
        camera_id,
        bool(camera.rtsp_url) if camera else False,
        bool(camera.hls_url) if camera else False,
    )


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
    if is_demo_camera(camera_id):
        # Demo cameras resolve to the shared local playback feed — spawning an
        # FFmpeg worker against their non-routable demo-cctv.invalid URLs
        # would only burn reconnect loops, so start is a worker-less no-op.
        return StreamActionResult(
            camera_id=camera_id,
            action="demo-playback",
            stream=StreamStatus(**demo_stream_status(camera_id)),
        )
    if not camera.rtsp_url and not camera.hls_url:
        raise HTTPException(
            status_code=409,
            detail="Camera has no RTSP or HLS URL from the Sentinel catalogue",
        )
    try:
        snap = gateway.start(camera.camera_id, camera.rtsp_url, camera.hls_url)
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


@router.get("/{camera_id}/hls/index.m3u8")
async def hls_playlist(camera_id: str, db: Session = Depends(get_db)) -> Response:
    """Credential-free HLS proxy for the browser.

    The dashboard never talks to the Sentinel origin directly and never sees
    RTSP/WHEP credentials — the backend fetches the playlist and rewrites its
    segment URIs onto this same-origin proxy.
    """
    camera = get_camera(db, camera_id)
    if camera is None or not camera.hls_url:
        raise HTTPException(status_code=404, detail=f"No HLS source for {camera_id}")
    if is_demo_camera(camera_id):
        # Seeded demo HLS URLs are non-routable placeholders; demo playback is
        # served through the frame.jpg / MJPEG endpoints instead.
        raise HTTPException(status_code=404, detail=f"No HLS source for {camera_id}")
    try:
        body = await _sentinel_get(camera.hls_url)
    except httpx.HTTPError as exc:
        logger.warning(
            "stream.hls.playlist_failed",
            camera_id=camera_id,
            error=str(exc),
            ts=datetime.now(timezone.utc).isoformat(),
        )
        raise HTTPException(status_code=502, detail="Sentinel HLS unreachable") from exc

    base = camera.hls_url.rsplit("/", 1)[0]
    rewritten: list[str] = []
    for line in body.decode("utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            target = stripped if stripped.startswith("http") else f"{base}/{stripped}"
            rewritten.append(
                f"/api/streams/{camera_id}/hls/segment?u={quote(target, safe='')}"
            )
        else:
            rewritten.append(line)
    return Response(
        content="\n".join(rewritten) + "\n",
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/{camera_id}/hls/segment")
async def hls_segment(camera_id: str, u: str, db: Session = Depends(get_db)) -> Response:
    """Proxy a single HLS segment/child-playlist referenced by the playlist above."""
    camera = get_camera(db, camera_id)
    if camera is None or not camera.hls_url:
        raise HTTPException(status_code=404, detail=f"No HLS source for {camera_id}")
    if is_demo_camera(camera_id):
        raise HTTPException(status_code=404, detail=f"No HLS source for {camera_id}")
    # Only allow URLs under the camera's own Sentinel HLS origin.
    origin = camera.hls_url.rsplit("/", 1)[0]
    if not u.startswith(origin):
        raise HTTPException(status_code=400, detail="Segment outside camera origin")
    try:
        body = await _sentinel_get(u)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Sentinel HLS unreachable") from exc
    media = (
        "application/vnd.apple.mpegurl" if u.endswith(".m3u8") else "video/mp2t"
    )
    return Response(content=body, media_type=media, headers={"Cache-Control": "no-store"})


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
    # Demo cameras have no FFmpeg worker by design; their MJPEG preview reads
    # the shared local demo feed through the same per-camera endpoint.
    if gateway.get_worker(camera_id) is None and not demo_playback_available(camera_id):
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

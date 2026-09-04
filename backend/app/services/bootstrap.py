"""Startup: optionally ingest Sentinel and start the first camera with an RTSP URL."""

from __future__ import annotations

import structlog

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.camera import Camera
from app.services.cameras import ingest_from_sentinel
from app.services.demo_stream import is_demo_camera
from app.services.sentinel import SentinelError
from app.services.stream_gateway import gateway

logger = structlog.get_logger(__name__)


def bootstrap_streams() -> None:
    settings = get_settings()
    if not settings.stream_auto_start:
        logger.info("stream.bootstrap.skipped", reason="STREAM_AUTO_START=false")
        return

    db = SessionLocal()
    try:
        try:
            ingest_from_sentinel(db)
        except SentinelError as exc:
            logger.warning("stream.bootstrap.ingest_failed", error=str(exc))

        cameras = (
            db.query(Camera)
            .filter(Camera.rtsp_url.isnot(None))
            .filter(Camera.rtsp_url != "")
            .order_by(Camera.camera_id)
            .all()
        )
        if not cameras:
            logger.warning(
                "stream.bootstrap.no_rtsp",
                hint="Ingest the Sentinel catalogue so cameras have rtsp_url values",
            )
            return

        limit = max(1, settings.stream_auto_start_limit)
        started = 0
        for camera in cameras:
            if started >= limit:
                break
            if is_demo_camera(camera.camera_id):
                # Seeded demo cameras resolve to the shared local playback feed
                # (no FFmpeg worker); never auto-start workers against their
                # non-routable demo-cctv.invalid URLs.
                logger.info(
                    "stream.bootstrap.demo_skipped",
                    camera_id=camera.camera_id,
                    reason="demo-playback (no worker required)",
                )
                continue
            try:
                gateway.start(camera.camera_id, camera.rtsp_url, camera.hls_url)  # type: ignore[arg-type]
                started += 1
                logger.info(
                    "stream.bootstrap.started",
                    camera_id=camera.camera_id,
                    location=camera.location_name,
                )
            except Exception as exc:
                logger.error("stream.bootstrap.start_failed", camera_id=camera.camera_id, error=str(exc))
    finally:
        db.close()

from pydantic import BaseModel


class StreamStatus(BaseModel):
    camera_id: str
    state: str
    rtsp_configured: bool
    codec: str | None = None
    width: int | None = None
    height: int | None = None
    resolution: str | None = None
    source_fps: float | None = None
    measured_fps: float = 0.0
    frame_count: int = 0
    last_pts_ms: float | None = None
    last_frame_at: str | None = None
    last_error: str | None = None
    reconnect_attempt: int = 0
    next_retry_in_s: float | None = None
    started_at: str | None = None
    uptime_s: float = 0.0
    jpeg_bytes: int = 0
    ai_width: int | None = None
    ai_height: int | None = None
    live_frame_path: str
    live_mjpeg_path: str
    # Backend-owned capability flag: True when the camera is served by the
    # local demo playback feed (seeded DEMO-CAM-* ids). The frontend shows
    # demo video with a DEMO badge when True; the physical-camera health
    # state above is intentionally left untouched.
    demo_playback: bool = False
    # Sentinel Grid additions (credential-free).
    transport: str = "rtsp"
    hls_configured: bool = False
    availability: str = "OFFLINE"
    hls_path: str | None = None


class StreamActionResult(BaseModel):
    camera_id: str
    action: str
    stream: StreamStatus | None = None
    detail: str | None = None

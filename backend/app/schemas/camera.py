from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CameraRead(BaseModel):
    """Camera Registry projection for API clients.

    Stream URLs (which may embed credentials) are NEVER serialized — clients
    see only whether a stream source is configured. The backend keeps the URLs
    server-side and hands them to FFmpeg internally.
    """

    model_config = ConfigDict(from_attributes=True)

    camera_id: str
    department: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    camera_type: str | None = None
    codec: str | None = None
    resolution: str | None = None
    status: str | None = None
    connectivity: str | None = None
    vms: str | None = None
    owner: str | None = None
    # Capability flags — never the URLs themselves.
    rtsp_configured: bool = False
    webrtc_configured: bool = False
    hls_configured: bool = False
    # Credential-free playback paths served by this backend.
    hls_path: str | None = None
    live_frame_path: str | None = None
    live_mjpeg_path: str | None = None
    created_at: datetime
    updated_at: datetime


class IngestResult(BaseModel):
    source: str = Field(description="Official catalogue URL that was queried")
    fetched: int
    upserted: int
    skipped: int
    errors: list[str] = Field(default_factory=list)

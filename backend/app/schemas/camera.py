from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CameraRead(BaseModel):
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
    rtsp_url: str | None = None
    webrtc_url: str | None = None
    hls_url: str | None = None
    created_at: datetime
    updated_at: datetime


class IngestResult(BaseModel):
    source: str = Field(description="Official catalogue URL that was queried")
    fetched: int
    upserted: int
    skipped: int
    errors: list[str] = Field(default_factory=list)

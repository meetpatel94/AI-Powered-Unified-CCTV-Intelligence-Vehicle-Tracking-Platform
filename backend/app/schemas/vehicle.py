"""Pydantic response models for the Vehicle Intelligence APIs.

These are intentionally permissive (``extra='allow'`` via dict passthrough is
avoided; instead we expose the concrete fields the services already return).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class BBox(BaseModel):
    x: float | None = None
    y: float | None = None
    w: float | None = None
    h: float | None = None


class SightingOut(BaseModel):
    id: int
    plate: str
    plate_raw: str | None = None
    camera_id: str
    track_id: int | None = None
    vehicle_class: str | None = None
    ocr_confidence: float | None = None
    detection_confidence: float | None = None
    # Reliability / observation metadata (see services/vehicle_intel.py).
    plate_valid: bool = False
    plate_uncertain: bool = True
    source: str = "live_rtsp"
    bbox: BBox | None = None
    pts_ms: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_name: str | None = None
    evidence_path: str | None = None
    seen_at: str | None = None


class VehicleOut(BaseModel):
    id: int
    plate: str
    vehicle_class: str | None = None
    first_seen: str | None = None
    last_seen: str | None = None
    last_camera_id: str | None = None
    total_sightings: int = 0
    camera_count: int = 0
    best_confidence: float | None = None
    recent_sightings: list[SightingOut] | None = None


class JourneyPointOut(BaseModel):
    vehicle_id: int | None = None
    journey_id: int
    sequence: int
    camera_id: str
    timestamp: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_name: str | None = None
    confidence: float | None = None
    distance_km: float | None = None
    interval_seconds: float | None = None
    speed_kph: float | None = None
    anomaly: bool = False
    anomaly_reason: str | None = None


class JourneyOut(BaseModel):
    plate: str
    point_count: int
    segment_count: int
    anomaly_count: int
    points: list[JourneyPointOut]


class TrackOut(BaseModel):
    id: int
    camera_id: str
    track_id: int
    vehicle_class: str | None = None
    plate: str | None = None
    first_seen: str | None = None
    last_seen: str | None = None
    first_pts_ms: float | None = None
    last_pts_ms: float | None = None
    frame_count: int = 0
    trajectory: list[dict[str, Any]] = []


class PipelineWorkerStatus(BaseModel):
    camera_id: str
    alive: bool
    # Trust flags: detector_ready is True only for a genuine (non-synthetic)
    # loaded model; synthetic is True when the dev random-weight fallback is
    # active (its detections are never persisted).
    detector_ready: bool = False
    synthetic: bool = False
    frames_processed: int = 0
    frames_skipped: int = 0
    frames_dropped: int = 0
    inference_throttled: int = 0
    detections_total: int = 0
    anpr_reads: int = 0
    avg_inference_ms: float | None = None
    avg_anpr_ms: float | None = None
    # Trustworthy measured rate (processed frames / worker uptime), never the
    # camera's reported FPS.
    effective_infer_fps: float = 0.0
    anpr_ready: bool = False
    queue_depth: int = 0
    last_error: str | None = None
    last_infer_at: str | None = None
    detector: dict[str, Any] | None = None
    anpr: dict[str, Any] | None = None


class PipelineActionResult(BaseModel):
    camera_id: str
    action: str
    status: PipelineWorkerStatus | None = None
    detail: str | None = None

"""Environment-based application configuration. Secrets never live in code."""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "GP CCTV Intelligence API"
    app_env: str = "development"
    app_debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str = "postgresql+psycopg2://cctv:cctv@localhost:5432/cctv_intelligence"

    sentinel_base_url: str = "https://sentinel.gujarat.gov.in"
    sentinel_ingest_path: str = "/api/ingest"
    sentinel_api_key: str = ""
    sentinel_api_secret: str = ""
    sentinel_timeout_seconds: float = 15.0
    sentinel_verify_tls: bool = True

    # Stream gateway — RTSP URLs always come from the Camera Registry / Sentinel.
    ffmpeg_path: str = "ffmpeg"
    stream_rtsp_transport: str = "tcp"
    stream_connect_timeout_seconds: float = 10.0
    stream_stale_seconds: float = 8.0
    stream_backoff_min_seconds: float = 2.0
    stream_backoff_max_seconds: float = 30.0
    stream_jpeg_quality: int = 5
    stream_ai_max_width: int = 1280
    stream_auto_start: bool = True
    stream_auto_start_limit: int = 1
    stream_max_workers: int = 32

    # ------------------------------------------------------------------ #
    # Vehicle Intelligence Pipeline
    # ------------------------------------------------------------------ #
    # Dev convenience: create ORM tables on startup when Alembic is not run.
    # Production uses `alembic upgrade head`; leave this False there.
    auto_create_tables: bool = False

    # Master switch for the YOLO/ANPR/tracking/journey pipeline.
    vehicle_pipeline_enabled: bool = True
    # Auto-attach the pipeline to cameras the stream gateway brings LIVE.
    vehicle_pipeline_auto_attach: bool = True
    vehicle_pipeline_max_workers: int = 16

    # --- Detection (YOLO / Ultralytics) --------------------------------- #
    # Point this at a GENUINE pretrained Ultralytics vehicle-weights file
    # (e.g. yolov8n.pt trained on COCO, or a custom vehicle model). This is the
    # only source of real detections. If the path is missing/unloadable the
    # detector reports MODEL_NOT_READY and produces NO detections — it never
    # fabricates output. The pipeline stays up (streams keep flowing) so the
    # rest of the system is unaffected, but nothing is presented as a real
    # detection until genuine weights are supplied here.
    vehicle_model_path: str = "yolov8n.pt"

    # DEVELOPMENT-ONLY escape hatch. When True AND real weights cannot be
    # loaded, build a runnable model from an architecture YAML so the pipeline
    # can be exercised offline. Such a model has RANDOM / untrained weights and
    # its detections are meaningless — they are hard-labelled synthetic=True at
    # every layer (Detection, WebSocket payload, pipeline status) so they can
    # never be mistaken for genuine government-feed results. MUST stay False in
    # production. Env: VEHICLE_ALLOW_SYNTHETIC_FALLBACK.
    vehicle_allow_synthetic_fallback: bool = False
    # Architecture YAML used ONLY when the synthetic fallback above is enabled.
    vehicle_model_fallback_yaml: str = "yolov8n.yaml"
    vehicle_conf_threshold: float = 0.35
    vehicle_iou_threshold: float = 0.45
    vehicle_infer_fps: float = 5.0
    vehicle_infer_imgsz: int = 640
    # "cpu", "cuda", "cuda:0", or "auto" (use CUDA when available).
    vehicle_device: str = "auto"
    # COCO class names treated as vehicles. Override for custom models.
    vehicle_classes: str = "car,motorcycle,bus,truck,bicycle"

    # --- Tracking (ByteTrack / BoT-SORT) -------------------------------- #
    # "bytetrack.yaml" or "botsort.yaml" (Ultralytics tracker configs), or an
    # absolute path to a custom tracker YAML.
    tracker_config: str = "bytetrack.yaml"
    track_trajectory_max_points: int = 240

    # --- ANPR / number-plate recognition -------------------------------- #
    anpr_enabled: bool = True
    # OCR provider: "rapidocr" (bundled, offline) or "none".
    anpr_ocr_provider: str = "rapidocr"
    # Plate detector: "region" runs OCR over the whole vehicle crop; a path to
    # a plate-detection weights file switches to a dedicated plate detector.
    anpr_plate_detector: str = "region"
    anpr_min_ocr_confidence: float = 0.40
    # Persist at most one ANPR sighting per (plate, camera) within this window
    # to avoid flooding the DB with duplicate reads of a stationary vehicle.
    anpr_dedupe_seconds: float = 20.0

    # --- Evidence frames ------------------------------------------------- #
    # Optional: store a small JPEG crop per ANPR hit. No continuous video.
    evidence_frames_enabled: bool = True
    evidence_frames_dir: str = "shots/evidence"
    # Evidence Snapshot service — individual JPEG frames only, never video.
    # Capture a full frame from the live-frame buffer on watchlist matches.
    evidence_capture_on_watchlist: bool = True
    # Retention window for evidence snapshots (days). Expired evidence is
    # deleted (file + row) by a background cleanup task.
    evidence_retention_days: int = 30

    # --- Real-time alerts ------------------------------------------------ #
    # Suppress a new alert when an unresolved alert for the same watchlist
    # entry + camera exists within this window (duplicate suppression).
    alert_dedupe_seconds: float = 300.0
    # Also raise alerts when a camera sustains an ERROR/OFFLINE state.
    alert_on_camera_failure: bool = True

    # --- Cross-camera journey ------------------------------------------- #
    # A gap larger than this (seconds) starts a fresh journey segment.
    journey_max_gap_seconds: float = 3600.0
    # Speeds above this km/h between consecutive cameras are flagged as an
    # obviously impossible travel interval (anomaly), not silently accepted.
    journey_max_speed_kph: float = 200.0
    # Minimum seconds between two distinct cameras before speed is meaningful.
    journey_min_interval_seconds: float = 2.0

    # --- Camera health monitoring ---------------------------------------- #
    # Poll the stream gateway + registry this often (seconds) for health.
    camera_health_poll_seconds: float = 5.0
    # A LIVE stream whose measured FPS falls below this is DEGRADED.
    camera_health_degraded_fps: float = 1.0
    # Consecutive failed polls before a camera is reported OFFLINE (never from
    # a single transient decoder warning — those stay at DEBUG in the gateway).
    camera_health_offline_grace_polls: int = 2

    # --- Authentication / RBAC ------------------------------------------- #
    # When False (development default) the API runs in open mode: an implicit
    # admin principal is attached to every request so the existing dashboard
    # keeps working without a login screen. Production MUST set AUTH_ENABLED=true.
    auth_enabled: bool = False
    # JWT signing secret. Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # Optional first-run bootstrap admin (created only when no users exist).
    bootstrap_admin_username: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_full_name: str = "System Administrator"
    bootstrap_admin_email: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def vehicle_class_list(self) -> List[str]:
        return [c.strip().lower() for c in self.vehicle_classes.split(",") if c.strip()]

    @property
    def sentinel_ingest_url(self) -> str:
        base = self.sentinel_base_url.rstrip("/")
        path = self.sentinel_ingest_path if self.sentinel_ingest_path.startswith("/") else f"/{self.sentinel_ingest_path}"
        return f"{base}{path}"

    @field_validator("sentinel_ingest_path")
    @classmethod
    def _normalize_path(cls, v: str) -> str:
        v = v.strip() or "/api/ingest"
        return v if v.startswith("/") else f"/{v}"


@lru_cache
def get_settings() -> Settings:
    return Settings()

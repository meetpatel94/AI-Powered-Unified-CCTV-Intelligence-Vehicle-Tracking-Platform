"""Environment-based application configuration. Secrets never live in code.

All deployment-specific values (database credentials, JWT secret, Sentinel
keys, RTSP URLs) come from environment variables / ``.env`` — nothing secret is
ever committed. ``validate_startup()`` is invoked once at boot and fails fast
on an unsafe production configuration.
"""

from functools import lru_cache
from typing import List

import structlog
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = structlog.get_logger(__name__)


class ConfigError(RuntimeError):
    """Fatal configuration problem detected at startup validation."""


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

    # --- Database pool / query hardening --------------------------------- #
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: float = 30.0
    db_pool_recycle_seconds: int = 1800
    # Abort any single statement running longer than this (ms) — protects the
    # API from runaway queries. 0 disables.
    db_statement_timeout_ms: int = 15000

    sentinel_base_url: str = "https://sentinel.gujarat.gov.in"
    sentinel_ingest_path: str = "/api/ingest"
    sentinel_api_key: str = ""
    sentinel_api_secret: str = ""
    sentinel_timeout_seconds: float = 15.0
    sentinel_verify_tls: bool = True

    # ------------------------------------------------------------------ #
    # Sentinel CCTV Camera Grid (authorized integrator access).
    # The camera CATALOGUE is always fetched dynamically from
    # ``SENTINEL_CATALOGUE_URL`` — camera ids/coordinates are NEVER hard-coded.
    # Credentials live only here (environment) and never reach the browser.
    # ------------------------------------------------------------------ #
    sentinel_catalogue_url: str = "https://cctv.corp8.cloud/cameras.json"
    sentinel_email: str = ""
    sentinel_password: str = ""
    # Per-camera stream endpoint templates. ``{camera_id}`` is substituted with
    # the id read from the catalogue; ``{email}``/``{password}`` are injected
    # URL-encoded (server-side only).
    sentinel_hls_url_template: str = "https://cctv.corp8.cloud/{camera_id}/index.m3u8"
    sentinel_rtsp_url_template: str = (
        "rtsp://{email}:{password}@103.250.160.189:8554/stream/{camera_id}"
    )
    sentinel_webrtc_url_template: str = (
        "http://{email}:{password}@103.250.160.189:8889/stream/{camera_id}/whep"
    )

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

    # --- Multi-camera concurrency / back-pressure ------------------------ #
    # Max number of cameras running inference SIMULTANEOUSLY across the whole
    # process (a global semaphore). Bounded to keep CPU/GPU within limits even
    # when many more streams are live; frame *sampling* (vehicle_infer_fps)
    # limits per-camera load. Important events (ANPR/watchlist) are never
    # dropped — this only limits how many models run at once.
    ai_max_concurrent_inference: int = 4
    # Max frames buffered between the gateway and a consumer before the oldest
    # are discarded for *live display* only (the DB/AI path is unaffected).
    stream_frame_queue_max: int = 32
    # Interval (seconds) at which worker stats are rolled up for /metrics.
    stats_rollup_seconds: float = 5.0

    # --- Rate limiting (sensitive endpoints) ----------------------------- #
    # Fixed-window, in-memory limiter (per client IP). 0 disables a given
    # limiter. Scales horizontally with a shared store (e.g. Redis) if needed.
    rate_limit_enabled: bool = True
    rate_limit_login_per_minute: int = 10
    rate_limit_token_per_minute: int = 30
    rate_limit_write_per_minute: int = 120
    rate_limit_generic_per_minute: int = 600

    # --- Reports ---------------------------------------------------------- #
    reports_enabled: bool = True
    # Directory where generated report files (CSV) are stored.
    reports_dir: str = "shots/reports"
    reports_max_rows: int = 50_000
    reports_retention_days: int = 90

    # --- Audit logging ---------------------------------------------------- #
    audit_enabled: bool = True
    # Retention for audit rows (days). 0 keeps forever. Cleanup is best-effort.
    audit_retention_days: int = 365

    # --- System metrics / monitoring ------------------------------------- #
    metrics_recent_errors: int = 100

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
    # A read is only "reliable" (drives Vehicle Identity + watchlist matching)
    # when it is grammar-valid AND at least this OCR confidence. Lower-reads are
    # persisted but flagged uncertain — characters are never invented.
    anpr_reliable_confidence: float = 0.75
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

    # --- AI status / health --------------------------------------------- #
    # How often (seconds) the pipeline publishes a global ``ai:status`` frame
    # on the realtime hub (bounded/low-frequency; also published on every
    # worker start/stop and at startup).
    ai_status_publish_seconds: float = 15.0

    # --- Cross-camera matching ------------------------------------------ #
    # Plate identity is ALWAYS the primary (deterministic) match. This flag
    # additionally allows a clearly-labelled, LOW-CONFIDENCE metadata-only
    # association (same vehicle class + plausible travel time between nearby
    # cameras) when no plate is available. It is OFF by default because no
    # visual-embedding architecture exists yet; when enabled results are
    # marked ``certain=false`` / ``method=visual_metadata`` and are never
    # persisted as a vehicle identity.
    cross_camera_visual_match_enabled: bool = False

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

    @property
    def sentinel_credentials_configured(self) -> bool:
        """True when SENTINEL_EMAIL and SENTINEL_PASSWORD are both present."""
        return bool(self.sentinel_email.strip() and self.sentinel_password.strip())

    @field_validator("sentinel_ingest_path")
    @classmethod
    def _normalize_path(cls, v: str) -> str:
        v = v.strip() or "/api/ingest"
        return v if v.startswith("/") else f"/{v}"

    # ------------------------------------------------------------------ #
    # Derived helpers
    # ------------------------------------------------------------------ #
    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() in ("production", "prod")

    # ------------------------------------------------------------------ #
    # Startup validation — fail fast on unsafe configuration.
    # ------------------------------------------------------------------ #
    def validate_startup(self) -> list[str]:
        """Validate configuration at boot.

        Raises :class:`ConfigError` on fatal problems (unsafe *production*
        configuration). Non-fatal issues are logged as warnings and their
        messages returned so the operator can see them. Never blocks local
        development.
        """
        warnings: list[str] = []
        errors: list[str] = []

        if not self.database_url or "://" not in self.database_url:
            errors.append("DATABASE_URL is missing or malformed")
        elif self.database_url.startswith("sqlite"):
            warnings.append(
                "DATABASE_URL uses SQLite — PostGIS/PostgreSQL is the production "
                "database; SQLite is a development-only fallback."
            )

        if self.auth_enabled:
            if not self.jwt_secret_key or self.jwt_secret_key in ("CHANGE-ME-IN-PRODUCTION", ""):
                errors.append(
                    "AUTH_ENABLED=true but JWT_SECRET_KEY is unset/default — "
                    "generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
                )
            elif len(self.jwt_secret_key) < 32:
                errors.append("JWT_SECRET_KEY must be at least 32 characters")
            if self.access_token_expire_minutes > 24 * 60:
                warnings.append("ACCESS_TOKEN_EXPIRE_MINUTES is unusually long (>24h)")
        else:
            warnings.append(
                "AUTH_ENABLED=false — running in OPEN MODE (implicit admin). "
                "Set AUTH_ENABLED=true in production."
            )

        if self.is_production:
            if not self.auth_enabled:
                errors.append("APP_ENV=production requires AUTH_ENABLED=true")
            if self.app_debug:
                errors.append("APP_DEBUG must be false in production")
            if self.vehicle_allow_synthetic_fallback:
                errors.append(
                    "VEHICLE_ALLOW_SYNTHETIC_FALLBACK must be false in production "
                    "(synthetic/random-weight detections are development-only)"
                )
            if "*" in self.cors_origin_list:
                errors.append("CORS_ORIGINS must not contain '*' in production")
            if self.auto_create_tables:
                warnings.append(
                    "AUTO_CREATE_TABLES=true in production — prefer `alembic upgrade head`"
                )
            if not self.cors_origins.strip():
                errors.append("CORS_ORIGINS must be explicitly configured in production")
            if "cctv:cctv@" in self.database_url and "localhost" not in self.database_url:
                warnings.append("DATABASE_URL uses the default cctv/cctv credentials")

        if self.vehicle_infer_fps <= 0:
            errors.append("VEHICLE_INFER_FPS must be > 0")
        if self.stream_max_workers < 1:
            errors.append("STREAM_MAX_WORKERS must be >= 1")
        if self.ai_max_concurrent_inference < 1:
            errors.append("AI_MAX_CONCURRENT_INFERENCE must be >= 1")
        if not (0.0 <= self.anpr_min_ocr_confidence <= 1.0):
            errors.append("ANPR_MIN_OCR_CONFIDENCE must be between 0 and 1")
        if not (0.0 < self.anpr_reliable_confidence <= 1.0):
            errors.append("ANPR_RELIABLE_CONFIDENCE must be in (0, 1]")
        if self.ai_status_publish_seconds <= 0:
            errors.append("AI_STATUS_PUBLISH_SECONDS must be > 0")

        for msg in warnings:
            logger.warning("config.startup_warning", warning=msg)
        if errors:
            for msg in errors:
                logger.error("config.startup_error", error=msg)
            raise ConfigError(
                "Invalid startup configuration:\n  - " + "\n  - ".join(errors)
            )
        return warnings


@lru_cache
def get_settings() -> Settings:
    return Settings()

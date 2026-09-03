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

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

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

"""Camera health monitoring models.

State comes from the Stream Gateway + Camera Registry — the dynamic, Sentinel-
fed fleet. A camera is never marked OFFLINE from a single transient decoder
warning (the gateway logs those at DEBUG); OFFLINE requires ``grace`` sustained
failed polls or an explicit worker stop.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Health states surfaced by the API/WebSocket.
HEALTH_LIVE = "LIVE"
HEALTH_DEGRADED = "DEGRADED"
HEALTH_RECONNECTING = "RECONNECTING"
HEALTH_OFFLINE = "OFFLINE"
HEALTH_ERROR = "ERROR"
# Registry camera the gateway has never been asked to pull (no worker yet).
HEALTH_UNKNOWN = "UNKNOWN"
HEALTH_STATES = (
    HEALTH_LIVE,
    HEALTH_DEGRADED,
    HEALTH_RECONNECTING,
    HEALTH_OFFLINE,
    HEALTH_ERROR,
    HEALTH_UNKNOWN,
)


class CameraHealthStatus(Base):
    """Latest health snapshot per camera (one row per registry camera)."""

    __tablename__ = "camera_health_status"

    camera_id: Mapped[str] = mapped_column(
        ForeignKey("cameras.camera_id", ondelete="CASCADE"), primary_key=True
    )
    state: Mapped[str] = mapped_column(String(16), nullable=False, default=HEALTH_UNKNOWN, index=True)
    # True when a stream worker exists for this camera (i.e. it is monitored).
    monitored: Mapped[bool] = mapped_column(default=False, nullable=False)

    last_frame_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reconnect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Frame age at last poll (ms) — the operational latency proxy.
    latency_ms: Mapped[int | None] = mapped_column(Float, nullable=True)
    codec: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(32), nullable=True)
    observed_fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Consecutive polls reporting a failed/absent stream (OFFLINE grace).
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stream_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CameraHealthEvent(Base):
    """State-transition log — the health-event timeline shown to operators."""

    __tablename__ = "camera_health_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    camera_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    from_state: Mapped[str | None] = mapped_column(String(16), nullable=True)
    to_state: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_camera_health_events_camera_time", "camera_id", "created_at"),
    )

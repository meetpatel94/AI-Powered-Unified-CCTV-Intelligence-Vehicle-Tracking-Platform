"""Real-Time Alert Engine persistence model.

Alerts are raised from **confirmed, persisted** events only — watchlist matches
(on genuine ANPR sightings), sustained camera failures and journey anomalies.
Nothing here is ever fabricated. ``dedupe_key`` (unique) plus an unresolved
same-source window suppress duplicates.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

ALERT_STATUS_NEW = "NEW"
ALERT_STATUS_ACKNOWLEDGED = "ACKNOWLEDGED"
ALERT_STATUS_INVESTIGATING = "INVESTIGATING"
ALERT_STATUS_ESCALATED = "ESCALATED"
ALERT_STATUS_RESOLVED = "RESOLVED"
ALERT_STATUSES = (
    ALERT_STATUS_NEW,
    ALERT_STATUS_ACKNOWLEDGED,
    ALERT_STATUS_INVESTIGATING,
    ALERT_STATUS_ESCALATED,
    ALERT_STATUS_RESOLVED,
)
OPEN_STATUSES = (ALERT_STATUS_NEW, ALERT_STATUS_ACKNOWLEDGED, ALERT_STATUS_INVESTIGATING, ALERT_STATUS_ESCALATED)

# Event types the engine currently raises. Watchlist matches are the primary
# source; camera failures and journey anomalies come from real computed events.
ALERT_TYPE_WATCHLIST_MATCH = "WATCHLIST_MATCH"
ALERT_TYPE_CAMERA_OFFLINE = "CAMERA_OFFLINE"
ALERT_TYPE_CAMERA_ERROR = "CAMERA_ERROR"
ALERT_TYPE_JOURNEY_ANOMALY = "JOURNEY_ANOMALY"
ALERT_TYPES = (
    ALERT_TYPE_WATCHLIST_MATCH,
    ALERT_TYPE_CAMERA_OFFLINE,
    ALERT_TYPE_CAMERA_ERROR,
    ALERT_TYPE_JOURNEY_ANOMALY,
)

SEVERITIES = ("critical", "high", "medium", "info")


class Alert(Base):
    """One operational alert with its lifecycle (NEW → … → RESOLVED)."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Human-facing id, e.g. ALR-20260903-000042 (backfilled from the PK).
    alert_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ALERT_STATUS_NEW, index=True)

    plate: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    camera_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Provenance: which module raised the alert (never fabricated).
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # Reference to the triggering record, e.g. "watchlist_match:12".
    source_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Optional evidence snapshot reference.
    evidence_id: Mapped[int | None] = mapped_column(
        ForeignKey("evidence_snapshots.id", ondelete="SET NULL"), nullable=True
    )

    # Duplicate suppression: unique per source (match id / camera failure key).
    dedupe_key: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_alerts_status_created", "status", "created_at"),
        Index("ix_alerts_plate_created", "plate", "created_at"),
        Index("ix_alerts_camera_created", "camera_id", "created_at"),
    )

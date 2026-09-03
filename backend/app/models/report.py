"""Intelligence Reports persistence model.

A report is a generated, filter-scoped document over REAL PostgreSQL data
(ANPR sightings / vehicle journeys, watchlist alerts, camera health,
investigation cases). Metadata + filter parameters are stored in the row; the
rendered document (CSV, plus a JSON preview) is stored on disk under the
configured reports directory and referenced — never raw video.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

REPORT_STATUS_COMPLETED = "completed"
REPORT_STATUS_GENERATING = "generating"
REPORT_STATUS_FAILED = "failed"

REPORT_FORMAT_CSV = "CSV"
REPORT_FORMAT_JSON = "JSON"

# Supported report families.
REPORT_TYPE_VEHICLE_JOURNEY = "vehicle_journey"
REPORT_TYPE_ANPR_ACTIVITY = "anpr_activity"
REPORT_TYPE_WATCHLIST_ALERTS = "watchlist_alerts"
REPORT_TYPE_CAMERA_HEALTH = "camera_health"
REPORT_TYPE_INVESTIGATION = "investigation"
REPORT_TYPES = (
    REPORT_TYPE_VEHICLE_JOURNEY,
    REPORT_TYPE_ANPR_ACTIVITY,
    REPORT_TYPE_WATCHLIST_ALERTS,
    REPORT_TYPE_CAMERA_HEALTH,
    REPORT_TYPE_INVESTIGATION,
)


class Report(Base):
    """One generated intelligence report (metadata + document reference)."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Human-facing id, e.g. RPT-20260903-000007 (backfilled from the PK).
    report_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=REPORT_STATUS_GENERATING, index=True
    )
    format: Mapped[str] = mapped_column(String(8), nullable=False, default=REPORT_FORMAT_CSV)
    classification: Mapped[str] = mapped_column(String(32), nullable=False, default="internal")

    # Filter scope (all optional — a null filter means "all").
    date_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    date_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    camera_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    plate: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    alert_type: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Provenance + statistics.
    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_by_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    camera_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Secret-free summary used by GET .../preview.
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_reports_type_created", "type", "created_at"),
    )

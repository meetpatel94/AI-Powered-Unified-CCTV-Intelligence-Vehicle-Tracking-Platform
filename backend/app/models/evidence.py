"""Evidence Snapshot model — individual JPEG frames only, never video.

An evidence snapshot is a single still frame (vehicle crop or full live frame)
captured from the in-memory live-frame buffer when an important event happens
(genuine ANPR hit, watchlist match, alert). Metadata + SHA-256 hash are stored
for chain-of-custody; the JPEG lives under the configured evidence directory.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EvidenceSnapshot(Base):
    """One still-frame evidence record with integrity metadata."""

    __tablename__ = "evidence_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Provenance: e.g. "anpr_sighting:42", "watchlist_match:7", "alert:ALR-...".
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    camera_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    plate: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # Bounding box of the subject in the source frame (pixels), when known.
    bbox: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Object-store-safe relative path under EVIDENCE_DIR (never absolute).
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False, default="image/jpeg")
    # Optional notes (e.g. "full live frame" vs "vehicle crop").
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Retention window; the cleanup task deletes evidence past this point.
    retention_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_evidence_camera_time", "camera_id", "captured_at"),
        Index("ix_evidence_plate_time", "plate", "captured_at"),
        Index("ix_evidence_event", "event_type", "event_id"),
    )

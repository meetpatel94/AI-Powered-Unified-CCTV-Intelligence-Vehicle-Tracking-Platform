"""Watchlist models — normalized plate books with categories and priority.

A watchlist entry is an operator-curated subject (vehicle plate, person or
other descriptor). Matching runs against **genuine, persisted** ANPR sightings
only — a match row is created exactly once per (sighting, entry) pair via a
unique constraint, so a stationary vehicle re-read by OCR can never fan out
into duplicate match events.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
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
# NOTE: uniqueness of *active* plates is enforced in the service layer so that
# historic (inactive) entries with the same plate remain queryable.
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Operator-facing categories (free-form string; these are the seeded defaults).
CATEGORY_STOLEN = "stolen"
CATEGORY_WANTED = "wanted"
CATEGORY_SUSPECT = "suspect"
CATEGORY_MISSING = "missing"
CATEGORY_TRAFFIC = "traffic"
CATEGORY_OTHERS = "others"

PRIORITY_LEVELS = ("critical", "high", "medium", "low")
ENTRY_TYPES = ("vehicle", "person", "other")


class WatchlistEntry(Base):
    """One watchlist subject. Vehicle entries match on normalized plate."""

    __tablename__ = "watchlist_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Normalized Indian plate (join key with anpr_sightings.plate). Unique among
    # ACTIVE vehicle entries — enforced in the service layer so history is kept.
    plate: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    plate_raw: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entry_type: Mapped[str] = mapped_column(String(16), nullable=False, default="vehicle")
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    alias: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default=CATEGORY_OTHERS, index=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Denormalized match stats (cheap list rendering).
    match_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_match_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    matches: Mapped[list["WatchlistMatch"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        Index("ix_watchlist_active_plate", "is_active", "plate"),
        Index("ix_watchlist_category_active", "category", "is_active"),
    )


class WatchlistMatch(Base):
    """Exactly one match event per genuine ANPR sighting ↔ active entry.

    Created only by the pipeline from a persisted (non-synthetic) ANPR sighting.
    The (sighting_id, entry_id) unique constraint guarantees de-duplication even
    under concurrent workers.
    """

    __tablename__ = "watchlist_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(
        ForeignKey("watchlist_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plate: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    camera_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # The genuine ANPR sighting that triggered this match.
    sighting_id: Mapped[int] = mapped_column(
        ForeignKey("anpr_sightings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Alert raised by the Real-Time Alert Engine for this match (nullable —
    # duplicate suppression may have folded it into an earlier alert).
    alert_id: Mapped[int | None] = mapped_column(
        ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True
    )
    # Evidence snapshot captured from the live-frame buffer, if enabled.
    evidence_id: Mapped[int | None] = mapped_column(
        ForeignKey("evidence_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    entry: Mapped[WatchlistEntry] = relationship(back_populates="matches")

    __table_args__ = (
        UniqueConstraint("sighting_id", "entry_id", name="uq_watchlist_match_sighting_entry"),
        Index("ix_watchlist_matches_plate_time", "plate", "matched_at"),
        Index("ix_watchlist_matches_camera_time", "camera_id", "matched_at"),
        Index("ix_watchlist_matches_matched_at", "matched_at"),
    )

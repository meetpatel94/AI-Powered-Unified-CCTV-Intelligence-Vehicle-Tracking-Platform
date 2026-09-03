"""Vehicle Intelligence Pipeline persistence models.

Only detection / ANPR / tracking / journey **metadata** is stored — never
continuous video. Optional evidence-frame references (small JPEG crops) may be
recorded when the deployment enables them.

Tables
------
- ``anpr_sightings``  : one row per persisted number-plate read.
- ``vehicle_tracks``  : one row per stable multi-frame track (ByteTrack/BoT-SORT).
- ``vehicles``        : the Vehicle Identity aggregate, keyed by normalized plate.
- ``journey_points``  : ordered cross-camera journey stops for a vehicle.

Indexes are tuned for the plate / time / camera queries the APIs run.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Vehicle(Base):
    """Vehicle Identity aggregate — the fast plate-search anchor."""

    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Normalized (Indian) plate text — the join key for the whole pipeline.
    plate: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    vehicle_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_camera_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    total_sightings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    camera_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sightings: Mapped[list["AnprSighting"]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan", passive_deletes=True
    )
    journey_points: Mapped[list["JourneyPoint"]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        Index("ix_vehicles_last_seen", "last_seen"),
    )


class AnprSighting(Base):
    """One persisted number-plate read on one camera at one instant."""

    __tablename__ = "anpr_sightings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    plate: Mapped[str] = mapped_column(String(16), nullable=False)
    plate_raw: Mapped[str | None] = mapped_column(String(64), nullable=True)
    camera_id: Mapped[str] = mapped_column(String(64), nullable=False)
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vehicle_class: Mapped[str | None] = mapped_column(String(32), nullable=True)

    ocr_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    detection_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Vehicle bbox in the normalized (AI) frame, pixels.
    bbox_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_w: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_h: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Presentation-time (ms) of the source frame, from the stream gateway.
    pts_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Denormalized camera location for fast journey/geo queries.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Optional evidence-frame reference (small JPEG crop). No continuous video.
    evidence_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    vehicle: Mapped[Vehicle | None] = relationship(back_populates="sightings")

    __table_args__ = (
        Index("ix_anpr_plate_time", "plate", "seen_at"),
        Index("ix_anpr_camera_time", "camera_id", "seen_at"),
        Index("ix_anpr_seen_at", "seen_at"),
    )


class VehicleTrack(Base):
    """A stable multi-frame track produced by ByteTrack / BoT-SORT."""

    __tablename__ = "vehicle_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # (camera_id, track_id) is unique per gateway session; track_id is stable
    # within a camera as long as the object is continuously tracked.
    camera_id: Mapped[str] = mapped_column(String(64), nullable=False)
    track_id: Mapped[int] = mapped_column(Integer, nullable=False)
    vehicle_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    plate: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)

    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    first_pts_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_pts_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    frame_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # bbox trajectory: JSON list of {pts_ms, x, y, w, h, conf}. Capped length.
    trajectory: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_tracks_camera_track", "camera_id", "track_id", unique=True),
        Index("ix_tracks_last_seen", "last_seen"),
    )


class JourneyPoint(Base):
    """One ordered stop in a vehicle's cross-camera journey."""

    __tablename__ = "journey_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plate: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    # Journey segment id — increments when a large time gap splits the route.
    journey_id: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    camera_id: Mapped[str] = mapped_column(String(64), nullable=False)
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Distance / interval / speed to the previous stop, and anomaly flag.
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    interval_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_kph: Mapped[float | None] = mapped_column(Float, nullable=True)
    anomaly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    anomaly_reason: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    vehicle: Mapped[Vehicle] = relationship(back_populates="journey_points")

    __table_args__ = (
        Index("ix_journey_plate_seq", "plate", "journey_id", "sequence"),
        Index("ix_journey_camera_time", "camera_id", "seen_at"),
    )

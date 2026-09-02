"""Camera Registry — source of truth for the Gujarat Police CCTV fleet."""

from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Camera(Base):
    __tablename__ = "cameras"

    camera_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    department: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    camera_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    codec: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    connectivity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vms: Mapped[str | None] = mapped_column(String(128), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rtsp_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    webrtc_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    hls_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

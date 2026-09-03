"""Investigation workflow models — case files built from real records.

A case aggregates the vehicle identity, ANPR sightings, journeys, watchlist
events and alerts already persisted by the pipeline; the case itself only
stores operator metadata (case number, subject plate, notes, status) plus
references to evidence snapshots.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

CASE_STATUS_OPEN = "OPEN"
CASE_STATUS_IN_PROGRESS = "IN_PROGRESS"
CASE_STATUS_CLOSED = "CLOSED"
CASE_STATUSES = (CASE_STATUS_OPEN, CASE_STATUS_IN_PROGRESS, CASE_STATUS_CLOSED)


class InvestigationCase(Base):
    """One investigation case file."""

    __tablename__ = "investigation_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Human-facing case number, e.g. GP-CASE-20260903-000007.
    case_number: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    subject_plate: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CASE_STATUS_OPEN, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    officer: Mapped[str | None] = mapped_column(String(128), nullable=True)
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
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    evidence: Mapped[list["CaseEvidence"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", passive_deletes=True
    )


class CaseEvidence(Base):
    """Link between a case and the evidence snapshots it references."""

    __tablename__ = "case_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("investigation_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_id: Mapped[int] = mapped_column(
        ForeignKey("evidence_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    case: Mapped[InvestigationCase] = relationship(back_populates="evidence")

    __table_args__ = (
        UniqueConstraint("case_id", "evidence_id", name="uq_case_evidence"),
    )

"""Pydantic schemas for the Reports module."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ReportGenerateRequest(BaseModel):
    name: str | None = Field(None, max_length=255)
    type: str = Field(..., description="Report family", max_length=32)
    format: str = Field("CSV", max_length=8)
    classification: str = Field("internal", max_length=32)
    date_from: datetime | None = None
    date_to: datetime | None = None
    camera_id: str | None = Field(None, max_length=64)
    plate: str | None = Field(None, max_length=16)
    alert_type: str | None = Field(None, max_length=32)


class ReportSummary(BaseModel):
    model_config = {"extra": "allow"}


class ReportOut(BaseModel):
    model_config = {"extra": "ignore"}

    id: int
    report_id: str
    name: str
    type: str
    status: str
    format: str
    classification: str
    date_from: datetime | None = None
    date_to: datetime | None = None
    camera_id: str | None = None
    plate: str | None = None
    alert_type: str | None = None
    created_by: str | None = None
    created_by_role: str | None = None
    row_count: int = 0
    camera_count: int = 0
    file_size_bytes: int | None = None
    error: str | None = None
    summary: dict[str, Any] | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: datetime | None = None
    download_url: str | None = None
    preview_url: str | None = None


class ReportListResponse(BaseModel):
    items: list[ReportOut]
    total: int
    limit: int
    offset: int


class ReportPreviewResponse(ReportOut):
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    row_preview_count: int = 0

"""Security audit log persistence model.

Every security-relevant action (login attempts, camera control, watchlist
changes, alert lifecycle, investigation/evidence access, user/role changes,
configuration/report actions) is recorded with the acting principal, the
target resource, request metadata and the result.

The table NEVER stores secrets: passwords, JWTs, API keys and RTSP URLs
(which may embed credentials) are stripped by the audit service before a row
is written.
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

# Action verbs recorded in the audit trail.
ACTION_LOGIN_SUCCESS = "login_success"
ACTION_LOGIN_FAILED = "login_failed"
ACTION_LOGOUT = "logout"
ACTION_TOKEN_REFRESH = "token_refresh"
ACTION_PASSWORD_CHANGE = "password_change"

ACTION_CAMERA_START = "camera_start"
ACTION_CAMERA_STOP = "camera_stop"
ACTION_CAMERA_RESTART = "camera_restart"
ACTION_CAMERA_REFRESH = "camera_refresh"
ACTION_CAMERA_INGEST = "camera_ingest"

ACTION_PIPELINE_START = "pipeline_start"
ACTION_PIPELINE_STOP = "pipeline_stop"

ACTION_WATCHLIST_CREATE = "watchlist_create"
ACTION_WATCHLIST_UPDATE = "watchlist_update"
ACTION_WATCHLIST_DELETE = "watchlist_delete"

ACTION_ALERT_ACKNOWLEDGE = "alert_acknowledge"
ACTION_ALERT_RESOLVE = "alert_resolve"
ACTION_ALERT_STATUS = "alert_status_change"

ACTION_CASE_CREATE = "case_create"
ACTION_CASE_STATUS = "case_status_change"
ACTION_INVESTIGATION_ACCESS = "investigation_access"

ACTION_EVIDENCE_ACCESS = "evidence_access"
ACTION_EVIDENCE_DOWNLOAD = "evidence_download"
ACTION_EVIDENCE_VERIFY = "evidence_verify"

ACTION_USER_CREATE = "user_create"
ACTION_USER_UPDATE = "user_update"
ACTION_USER_PASSWORD_RESET = "user_password_reset"
ACTION_ROLE_VIEW = "role_view"

ACTION_REPORT_GENERATE = "report_generate"
ACTION_REPORT_DOWNLOAD = "report_download"
ACTION_REPORT_PREVIEW = "report_preview"

ACTION_CONFIG_CHANGE = "config_change"

RESULT_SUCCESS = "success"
RESULT_FAILURE = "failure"
RESULT_DENIED = "denied"


class AuditLog(Base):
    """One immutable security audit entry."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Acting principal. For a failed login the user may not resolve to an id.
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    username: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    action: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(48), nullable=True, index=True)
    resource_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    result: Mapped[str] = mapped_column(String(16), nullable=False, default=RESULT_SUCCESS, index=True)
    # Human-readable, secret-free summary.
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Request metadata (no secrets / no full URLs with credentials).
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    method: Mapped[str | None] = mapped_column(String(8), nullable=True)
    path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Secret-free structured context (resource attributes before/after, etc.).
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_audit_action_time", "action", "created_at"),
        Index("ix_audit_resource", "resource_type", "resource_id"),
    )

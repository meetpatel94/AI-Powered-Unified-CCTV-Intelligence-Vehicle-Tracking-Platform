"""audit logging, intelligence reports, hardening indexes

Revision ID: 0004_audit_reports
Revises: 0003_intelligence_ops
Create Date: 2026-09-03

Production-hardening phase:
* ``audit_logs`` — immutable security audit trail (actor, action, resource,
  result, request/IP metadata). Secrets are stripped by the application before
  insert.
* ``reports`` — generated intelligence reports over real PostgreSQL data
  (vehicle journeys, ANPR activity, watchlist alerts, camera health,
  investigations), with filter scope + on-disk document reference.
* A small set of additional indexes for the reports/monitoring query paths.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_audit_reports"
down_revision: Union[str, None] = "0003_intelligence_ops"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- Security audit log ------------------------------------------------ #
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(length=64), nullable=True),
        sa.Column("username", sa.String(length=128), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=True),
        sa.Column("action", sa.String(length=48), nullable=False),
        sa.Column("resource_type", sa.String(length=48), nullable=True),
        sa.Column("resource_id", sa.String(length=128), nullable=True),
        sa.Column("result", sa.String(length=16), nullable=False, server_default="success"),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("method", sa.String(length=8), nullable=True),
        sa.Column("path", sa.String(length=255), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_username", "audit_logs", ["username"])
    op.create_index("ix_audit_logs_role", "audit_logs", ["role"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_result", "audit_logs", ["result"])
    op.create_index("ix_audit_logs_ip_address", "audit_logs", ["ip_address"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_action_time", "audit_logs", ["action", "created_at"])
    op.create_index("ix_audit_resource", "audit_logs", ["resource_type", "resource_id"])

    # ---- Intelligence reports --------------------------------------------- #
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="generating"),
        sa.Column("format", sa.String(length=8), nullable=False, server_default="CSV"),
        sa.Column("classification", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("date_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("date_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("camera_id", sa.String(length=64), nullable=True),
        sa.Column("plate", sa.String(length=16), nullable=True),
        sa.Column("alert_type", sa.String(length=32), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("created_by_role", sa.String(length=32), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("camera_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_reports_report_id", "reports", ["report_id"], unique=True)
    op.create_index("ix_reports_type", "reports", ["type"])
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_camera_id", "reports", ["camera_id"])
    op.create_index("ix_reports_plate", "reports", ["plate"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])
    op.create_index("ix_reports_type_created", "reports", ["type", "created_at"])

    # ---- Additional hardening / reporting indexes ------------------------- #
    # Use IF NOT EXISTS so the migration is safe on databases whose tables were
    # created via Base.metadata.create_all (auto-index) rather than 0001–0003.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_camera_health_events_created_at "
        "ON camera_health_events (created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_watchlist_entries_last_match "
        "ON watchlist_entries (last_match_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_watchlist_entries_last_match")
    op.execute("DROP INDEX IF EXISTS ix_camera_health_events_created_at")
    op.drop_table("reports")
    op.drop_table("audit_logs")

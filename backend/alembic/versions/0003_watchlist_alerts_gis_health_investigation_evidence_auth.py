"""watchlist, alerts, camera health, investigation, evidence, auth/RBAC

Revision ID: 0003_intelligence_ops
Revises: 0002_vehicle_intelligence
Create Date: 2026-09-03

Adds the operational layer on top of the Vehicle Intelligence Pipeline:
watchlist entries + match events, the alert engine, camera health monitoring,
investigation cases, evidence snapshots (individual JPEG frames only — never
video) and the auth/RBAC tables (roles, users, sessions). PostGIS geography
points are added for alerts / watchlist matches when the extension is present
(the established pattern from 0001/0002).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_intelligence_ops"
down_revision: Union[str, None] = "0002_vehicle_intelligence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_postgis(conn) -> bool:
    try:
        available = conn.exec_driver_sql(
            "SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'"
        ).first()
    except Exception:
        return False
    return bool(available)


def upgrade() -> None:
    # ---- Evidence snapshots (referenced by alerts/matches) ---------------- #
    op.create_table(
        "evidence_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column("plate", sa.String(length=16), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("bbox", sa.JSON(), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(length=32), nullable=False, server_default="image/jpeg"),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_evidence_snapshots_event_type", "evidence_snapshots", ["event_type"])
    op.create_index("ix_evidence_snapshots_event_id", "evidence_snapshots", ["event_id"])
    op.create_index("ix_evidence_snapshots_camera_id", "evidence_snapshots", ["camera_id"])
    op.create_index("ix_evidence_snapshots_plate", "evidence_snapshots", ["plate"])
    op.create_index("ix_evidence_snapshots_captured_at", "evidence_snapshots", ["captured_at"])
    op.create_index("ix_evidence_snapshots_sha256", "evidence_snapshots", ["sha256"])
    op.create_index("ix_evidence_camera_time", "evidence_snapshots", ["camera_id", "captured_at"])
    op.create_index("ix_evidence_plate_time", "evidence_snapshots", ["plate", "captured_at"])
    op.create_index("ix_evidence_event", "evidence_snapshots", ["event_type", "event_id"])

    # ---- Alerts ----------------------------------------------------------- #
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("alert_id", sa.String(length=32), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="NEW"),
        sa.Column("plate", sa.String(length=16), nullable=True),
        sa.Column("camera_id", sa.String(length=64), nullable=True),
        sa.Column("location_name", sa.String(length=255), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_ref", sa.String(length=64), nullable=True),
        sa.Column(
            "evidence_id",
            sa.Integer(),
            sa.ForeignKey("evidence_snapshots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("dedupe_key", sa.String(length=96), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(length=128), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(length=128), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_alerts_alert_id", "alerts", ["alert_id"], unique=True)
    op.create_index("ix_alerts_type", "alerts", ["type"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_plate", "alerts", ["plate"])
    op.create_index("ix_alerts_camera_id", "alerts", ["camera_id"])
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])
    op.create_index("ix_alerts_dedupe_key", "alerts", ["dedupe_key"], unique=True)
    op.create_index("ix_alerts_status_created", "alerts", ["status", "created_at"])
    op.create_index("ix_alerts_plate_created", "alerts", ["plate", "created_at"])
    op.create_index("ix_alerts_camera_created", "alerts", ["camera_id", "created_at"])

    # ---- Watchlist -------------------------------------------------------- #
    op.create_table(
        "watchlist_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plate", sa.String(length=16), nullable=True),
        sa.Column("plate_raw", sa.String(length=64), nullable=True),
        sa.Column("entry_type", sa.String(length=16), nullable=False, server_default="vehicle"),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("alias", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=False, server_default="others"),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("match_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_match_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_watchlist_entries_plate", "watchlist_entries", ["plate"])
    op.create_index("ix_watchlist_entries_category", "watchlist_entries", ["category"])
    op.create_index("ix_watchlist_entries_is_active", "watchlist_entries", ["is_active"])
    op.create_index("ix_watchlist_active_plate", "watchlist_entries", ["is_active", "plate"])
    op.create_index("ix_watchlist_category_active", "watchlist_entries", ["category", "is_active"])

    op.create_table(
        "watchlist_matches",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "entry_id",
            sa.Integer(),
            sa.ForeignKey("watchlist_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plate", sa.String(length=16), nullable=False),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column(
            "sighting_id",
            sa.Integer(),
            sa.ForeignKey("anpr_sightings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location_name", sa.String(length=255), nullable=True),
        sa.Column("matched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "alert_id",
            sa.Integer(),
            sa.ForeignKey("alerts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "evidence_id",
            sa.Integer(),
            sa.ForeignKey("evidence_snapshots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("sighting_id", "entry_id", name="uq_watchlist_match_sighting_entry"),
    )
    op.create_index("ix_watchlist_matches_entry_id", "watchlist_matches", ["entry_id"])
    op.create_index("ix_watchlist_matches_plate", "watchlist_matches", ["plate"])
    op.create_index("ix_watchlist_matches_sighting_id", "watchlist_matches", ["sighting_id"])
    op.create_index("ix_watchlist_matches_alert_id", "watchlist_matches", ["alert_id"])
    op.create_index("ix_watchlist_matches_matched_at", "watchlist_matches", ["matched_at"])
    op.create_index("ix_watchlist_matches_plate_time", "watchlist_matches", ["plate", "matched_at"])
    op.create_index("ix_watchlist_matches_camera_time", "watchlist_matches", ["camera_id", "matched_at"])

    # ---- Camera health ---------------------------------------------------- #
    op.create_table(
        "camera_health_status",
        sa.Column(
            "camera_id",
            sa.String(length=64),
            sa.ForeignKey("cameras.camera_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("state", sa.String(length=16), nullable=False, server_default="UNKNOWN"),
        sa.Column("monitored", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_frame_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reconnect_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("codec", sa.String(length=32), nullable=True),
        sa.Column("resolution", sa.String(length=32), nullable=True),
        sa.Column("observed_fps", sa.Float(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stream_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_camera_health_status_state", "camera_health_status", ["state"])

    op.create_table(
        "camera_health_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column("from_state", sa.String(length=16), nullable=True),
        sa.Column("to_state", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_camera_health_events_camera_id", "camera_health_events", ["camera_id"])
    op.create_index("ix_camera_health_events_created_at", "camera_health_events", ["created_at"])
    op.create_index("ix_camera_health_events_camera_time", "camera_health_events", ["camera_id", "created_at"])

    # ---- Investigation ---------------------------------------------------- #
    op.create_table(
        "investigation_cases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("case_number", sa.String(length=32), nullable=False),
        sa.Column("subject_plate", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="OPEN"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("officer", sa.String(length=128), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_investigation_cases_case_number", "investigation_cases", ["case_number"], unique=True)
    op.create_index("ix_investigation_cases_subject_plate", "investigation_cases", ["subject_plate"])
    op.create_index("ix_investigation_cases_status", "investigation_cases", ["status"])

    op.create_table(
        "case_evidence",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "case_id",
            sa.Integer(),
            sa.ForeignKey("investigation_cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evidence_id",
            sa.Integer(),
            sa.ForeignKey("evidence_snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("case_id", "evidence_id", name="uq_case_evidence"),
    )
    op.create_index("ix_case_evidence_case_id", "case_evidence", ["case_id"])
    op.create_index("ix_case_evidence_evidence_id", "case_evidence", ["evidence_id"])

    # ---- Auth / RBAC ------------------------------------------------------ #
    op.create_table(
        "roles",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=128), nullable=False),
        sa.Column("rank", sa.String(length=64), nullable=True),
        sa.Column("employee_id", sa.String(length=64), nullable=True),
        sa.Column("department", sa.String(length=128), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role_id",
            sa.String(length=32),
            sa.ForeignKey("roles.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role_id", "users", ["role_id"])
    op.create_index("ix_users_is_active", "users", ["is_active"])

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("client_ip", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_refresh_token_hash", "user_sessions", ["refresh_token_hash"], unique=True)
    op.create_index("ix_user_sessions_expires_at", "user_sessions", ["expires_at"])
    op.create_index("ix_user_sessions_user_expires", "user_sessions", ["user_id", "expires_at"])

    # ---- Optional PostGIS geography points -------------------------------- #
    conn = op.get_bind()
    if _has_postgis(conn):
        for table in ("alerts", "watchlist_matches"):
            op.execute(
                f"""
                ALTER TABLE {table}
                ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
                GENERATED ALWAYS AS (
                    CASE
                        WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                        THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                        ELSE NULL
                    END
                ) STORED
                """
            )
            op.execute(
                f"CREATE INDEX IF NOT EXISTS ix_{table}_geom ON {table} USING GIST (geom)"
            )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_postgis(conn):
        for table in ("watchlist_matches", "alerts"):
            op.execute(f"DROP INDEX IF EXISTS ix_{table}_geom")

    op.drop_table("user_sessions")
    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_role_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    op.drop_table("roles")
    op.drop_table("case_evidence")
    op.drop_table("investigation_cases")
    op.drop_table("camera_health_events")
    op.drop_table("camera_health_status")
    op.drop_table("watchlist_matches")
    op.drop_table("watchlist_entries")
    op.drop_table("alerts")
    op.drop_table("evidence_snapshots")

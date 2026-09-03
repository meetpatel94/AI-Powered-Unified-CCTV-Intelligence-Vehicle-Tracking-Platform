"""vehicle intelligence pipeline tables

Revision ID: 0002_vehicle_intelligence
Revises: 0001_create_cameras
Create Date: 2026-09-03

Adds ANPR sightings, vehicle identity, multi-frame tracks and cross-camera
journey points. Indexes are tuned for plate / time / camera queries. PostGIS
geography points are added for sightings/journey coordinates when the extension
is available (it is enabled by 0001).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_vehicle_intelligence"
down_revision: Union[str, None] = "0001_create_cameras"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_postgis(conn) -> bool:
    try:
        return bool(
            conn.exec_driver_sql(
                "SELECT 1 FROM pg_extension WHERE extname = 'postgis'"
            ).first()
        )
    except Exception:
        return False


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plate", sa.String(length=16), nullable=False),
        sa.Column("vehicle_class", sa.String(length=32), nullable=True),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_camera_id", sa.String(length=64), nullable=True),
        sa.Column("total_sightings", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("camera_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_vehicles_plate", "vehicles", ["plate"], unique=True)
    op.create_index("ix_vehicles_last_seen", "vehicles", ["last_seen"])

    op.create_table(
        "anpr_sightings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=True),
        sa.Column("plate", sa.String(length=16), nullable=False),
        sa.Column("plate_raw", sa.String(length=64), nullable=True),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column("track_id", sa.Integer(), nullable=True),
        sa.Column("vehicle_class", sa.String(length=32), nullable=True),
        sa.Column("ocr_confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("detection_confidence", sa.Float(), nullable=True),
        sa.Column("bbox_x", sa.Float(), nullable=True),
        sa.Column("bbox_y", sa.Float(), nullable=True),
        sa.Column("bbox_w", sa.Float(), nullable=True),
        sa.Column("bbox_h", sa.Float(), nullable=True),
        sa.Column("pts_ms", sa.Float(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location_name", sa.String(length=255), nullable=True),
        sa.Column("evidence_path", sa.Text(), nullable=True),
        sa.Column("seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_anpr_sightings_vehicle_id", "anpr_sightings", ["vehicle_id"])
    op.create_index("ix_anpr_plate_time", "anpr_sightings", ["plate", "seen_at"])
    op.create_index("ix_anpr_camera_time", "anpr_sightings", ["camera_id", "seen_at"])
    op.create_index("ix_anpr_seen_at", "anpr_sightings", ["seen_at"])

    op.create_table(
        "vehicle_tracks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_class", sa.String(length=32), nullable=True),
        sa.Column("plate", sa.String(length=16), nullable=True),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_pts_ms", sa.Float(), nullable=True),
        sa.Column("last_pts_ms", sa.Float(), nullable=True),
        sa.Column("frame_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("trajectory", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tracks_camera_track", "vehicle_tracks", ["camera_id", "track_id"], unique=True)
    op.create_index("ix_tracks_last_seen", "vehicle_tracks", ["last_seen"])
    op.create_index("ix_vehicle_tracks_plate", "vehicle_tracks", ["plate"])

    op.create_table(
        "journey_points",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plate", sa.String(length=16), nullable=False),
        sa.Column("journey_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("camera_id", sa.String(length=64), nullable=False),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location_name", sa.String(length=255), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("interval_seconds", sa.Float(), nullable=True),
        sa.Column("speed_kph", sa.Float(), nullable=True),
        sa.Column("anomaly", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("anomaly_reason", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_journey_points_vehicle_id", "journey_points", ["vehicle_id"])
    op.create_index("ix_journey_points_plate", "journey_points", ["plate"])
    op.create_index("ix_journey_plate_seq", "journey_points", ["plate", "journey_id", "sequence"])
    op.create_index("ix_journey_camera_time", "journey_points", ["camera_id", "seen_at"])

    # Optional PostGIS geography points for geo queries (mirrors cameras.geom).
    conn = op.get_bind()
    if _has_postgis(conn):
        for table in ("anpr_sightings", "journey_points"):
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
        for table in ("anpr_sightings", "journey_points"):
            op.execute(f"DROP INDEX IF EXISTS ix_{table}_geom")
    op.drop_table("journey_points")
    op.drop_table("vehicle_tracks")
    op.drop_table("anpr_sightings")
    op.drop_index("ix_vehicles_last_seen", table_name="vehicles")
    op.drop_index("ix_vehicles_plate", table_name="vehicles")
    op.drop_table("vehicles")

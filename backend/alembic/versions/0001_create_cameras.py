"""create camera registry

Revision ID: 0001_create_cameras
Revises:
Create Date: 2026-09-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_create_cameras"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "cameras",
        sa.Column("camera_id", sa.String(length=64), primary_key=True),
        sa.Column("department", sa.String(length=128), nullable=True),
        sa.Column("location_name", sa.String(length=255), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("camera_type", sa.String(length=64), nullable=True),
        sa.Column("codec", sa.String(length=32), nullable=True),
        sa.Column("resolution", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("connectivity", sa.String(length=64), nullable=True),
        sa.Column("vms", sa.String(length=128), nullable=True),
        sa.Column("owner", sa.String(length=128), nullable=True),
        sa.Column("rtsp_url", sa.Text(), nullable=True),
        sa.Column("webrtc_url", sa.Text(), nullable=True),
        sa.Column("hls_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_cameras_department", "cameras", ["department"])
    op.create_index("ix_cameras_location_name", "cameras", ["location_name"])
    op.create_index("ix_cameras_status", "cameras", ["status"])
    # PostGIS geography point for later GIS queries (populated from lat/lng).
    op.execute(
        """
        ALTER TABLE cameras
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
    op.execute("CREATE INDEX IF NOT EXISTS ix_cameras_geom ON cameras USING GIST (geom)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_cameras_geom")
    op.drop_index("ix_cameras_status", table_name="cameras")
    op.drop_index("ix_cameras_location_name", table_name="cameras")
    op.drop_index("ix_cameras_department", table_name="cameras")
    op.drop_table("cameras")

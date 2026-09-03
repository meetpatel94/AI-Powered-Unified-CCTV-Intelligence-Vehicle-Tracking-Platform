"""ANPR observation reliability + source metadata

Revision ID: 0005_anpr_reliability_source
Revises: 0004_audit_reports
Create Date: 2026-09-03

Adds the ANPR reliability contract to ``anpr_sightings``:

* ``plate_valid``      — normalized text matched the Indian plate grammar.
* ``plate_uncertain``  — True when the read must NOT drive Vehicle Identity /
                         journey / watchlist matching (grammar failure or OCR
                         confidence below ANPR_RELIABLE_CONFIDENCE).
* ``source``           — observation provenance (``live_rtsp``).

Existing rows are backfilled from their OCR confidence + plate grammar on
PostgreSQL (the regex backfill is dialect-specific; SQLite/dev migrations are
no-ops and the app treats missing flags as reliable for legacy rows).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings

revision: str = "0005_anpr_reliability_source"
down_revision: Union[str, None] = "0004_audit_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "anpr_sightings",
        sa.Column("plate_valid", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "anpr_sightings",
        sa.Column("plate_uncertain", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "anpr_sightings",
        sa.Column("source", sa.String(length=32), nullable=False, server_default="live_rtsp"),
    )

    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        threshold = get_settings().anpr_reliable_confidence
        op.execute(
            sa.text(
                """
                UPDATE anpr_sightings
                SET plate_valid = (
                        ocr_confidence >= :threshold
                        AND plate ~ '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$'
                    ),
                    plate_uncertain = NOT (
                        ocr_confidence >= :threshold
                        AND plate ~ '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$'
                    )
                """
            ).bindparams(threshold=float(threshold))
        )
        # Legacy rows originated exclusively from the live RTSP pipeline.
        op.execute(sa.text("UPDATE anpr_sightings SET source = 'live_rtsp' WHERE source IS NULL OR source = ''"))


def downgrade() -> None:
    op.drop_column("anpr_sightings", "source")
    op.drop_column("anpr_sightings", "plate_uncertain")
    op.drop_column("anpr_sightings", "plate_valid")

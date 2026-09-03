"""Shared pytest fixtures.

The app is designed to run without heavy ML extras in tests: ultralytics /
torch / cv2 / rapidocr are all lazily imported, so this suite validates the
platform logic (normalization, reliability contract, tracker lifecycle, DB
services, watchlist matching, alert dedupe, journeys, AI health) on a
deterministic in-memory SQLite database with stub model/OCR units.

Production runtime never uses these fixtures — real model inference and OCR
remain the only source of detections there.
"""

from __future__ import annotations

import os

# MUST be set before any ``app.*`` import (app.db.session builds its engine at
# import time). SQLite keeps the suite self-contained; PostgreSQL production
# uses the same service code paths (dialect-aware INSERT..ON CONFLICT).
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AUTH_ENABLED", "false")
os.environ.setdefault("VEHICLE_ALLOW_SYNTHETIC_FALLBACK", "false")
# RapidOCR is not required for unit tests; the engine reports not-ready and the
# reliability logic is tested directly with PlateRead fixtures.
os.environ.setdefault("ANPR_OCR_PROVIDER", "none")
os.environ.setdefault("VEHICLE_PIPELINE_ENABLED", "false")
os.environ.setdefault("AI_STATUS_PUBLISH_SECONDS", "3600.0")
os.environ.setdefault("CROSS_CAMERA_VISUAL_MATCH_ENABLED", "false")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 — register all ORM metadata
from app.db.base import Base


@pytest.fixture()
def db():
    """Isolated in-memory SQLite schema per test (deterministic, no leakage)."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    session = sessionmaker(bind=eng, autocommit=False, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(eng)
        eng.dispose()

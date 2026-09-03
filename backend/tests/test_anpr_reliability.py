"""ANPR reliability contract + engine lifecycle tests (deterministic, no OCR)."""

from __future__ import annotations

import numpy as np

from app.vision.anpr import AnprEngine, PlateRead, _RapidOcrProvider
from app.vision.plate_utils import is_valid_indian_plate


def test_plate_read_reliability_thresholds():
    # Reliable: grammar-valid AND >= ANPR_RELIABLE_CONFIDENCE (default 0.75).
    assert PlateRead("GJ01AB1234", "GJ01AB1234", 0.90, valid=True).reliable is True
    assert PlateRead("GJ01AB1234", "GJ01AB1234", 0.90, valid=True).uncertain is False

    # Valid grammar but low confidence → uncertain.
    low = PlateRead("GJ01AB1234", "GJ01AB1234", 0.45, valid=True)
    assert low.reliable is False
    assert low.uncertain is True

    # Grammar-failed candidate must never be treated as reliable even at
    # high OCR confidence (no invented characters).
    junk = PlateRead("ZZZ123456", "ZZZ123456", 0.98, valid=False)
    assert is_valid_indian_plate(junk.plate) is False
    assert junk.reliable is False
    assert junk.uncertain is True


def test_plate_read_dict_contract():
    data = PlateRead("GJ01AB1234", "GJ-01-AB-1234", 0.88, valid=True).to_dict()
    assert set(data) == {"plate", "plate_raw", "confidence", "valid", "uncertain", "reliable", "source"}
    assert data["reliable"] is True
    assert data["uncertain"] is False
    assert data["source"] == "live_rtsp"


def test_anpr_engine_disabled_provider_is_not_ready():
    # ANPR_OCR_PROVIDER=none (test env) → engine startup is honest, not ready.
    engine = AnprEngine()
    status = engine.status()
    assert status["ready"] is False
    assert status["enabled"] is True or status["enabled"] is False
    assert engine.read_plate(np.zeros((32, 64, 3), dtype=np.uint8)) is None


def test_rapidocr_provider_unavailable_is_graceful():
    provider = _RapidOcrProvider.__new__(_RapidOcrProvider)
    provider._engine = None
    provider._lock = type("Lock", (), {"__enter__": lambda s: None, "__exit__": lambda *a: False})()
    provider.error = "rapidocr unavailable: test"
    assert provider.ready is False
    assert provider.read(np.zeros((32, 64, 3), dtype=np.uint8)) is None


def test_tiny_crop_never_reads():
    """Sub-12px crops are rejected before the provider is touched."""
    from app.core.config import get_settings

    class _FakeProvider:
        ready = True

        def read(self, crop):  # pragma: no cover - must never be called
            raise AssertionError("provider must not be called for tiny crops")

    engine = AnprEngine.__new__(AnprEngine)
    engine.settings = get_settings()
    engine.provider_name = "fake"
    engine._provider = _FakeProvider()
    engine.error = None
    assert engine.ready is True
    assert engine.read_plate(np.zeros((8, 8, 3), dtype=np.uint8)) is None
    assert engine.read_plate(np.zeros((32, 8, 3), dtype=np.uint8)) is None

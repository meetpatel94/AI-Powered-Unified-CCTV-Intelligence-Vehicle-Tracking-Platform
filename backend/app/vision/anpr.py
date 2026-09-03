"""ANPR / number-plate recognition on detected vehicle regions.

Runs OCR *only* over the vehicle bounding boxes produced by the detector — never
the whole frame — then normalizes the text to the Indian plate grammar. The OCR
provider is configurable (``rapidocr`` bundled/offline, or ``none`` to disable).
Every OCR failure is caught and returns "no read", never crashing the worker.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

import numpy as np
import structlog

from app.core.config import get_settings
from app.vision.plate_utils import normalize_plate

logger = structlog.get_logger(__name__)


@dataclass
class PlateRead:
    plate: str  # normalized
    plate_raw: str  # original OCR text (best line)
    confidence: float
    valid: bool
    # Provenance of the read: always the live RTSP pipeline today.
    source: str = "live_rtsp"
    # True when the OCR text cannot be trusted as an exact plate string: either
    # it failed the Indian plate grammar OR its confidence is below
    # ANPR_RELIABLE_CONFIDENCE. Such reads are persisted with a marker but are
    # NEVER used to create a Vehicle Identity, extend a journey or trigger a
    # watchlist alert (no characters are invented for them).
    @property
    def uncertain(self) -> bool:
        return not self.valid or not self.reliable

    @property
    def reliable(self) -> bool:
        return self.valid and self.confidence >= get_settings().anpr_reliable_confidence

    def to_dict(self) -> dict[str, Any]:
        return {
            "plate": self.plate,
            "plate_raw": self.plate_raw,
            "confidence": round(self.confidence, 4),
            "valid": self.valid,
            "uncertain": self.uncertain,
            "reliable": self.reliable,
            "source": self.source,
        }


class _RapidOcrProvider:
    """Bundled, offline OCR (RapidOCR / PP-OCR ONNX models)."""

    def __init__(self) -> None:
        self._engine = None
        self._lock = threading.Lock()
        self.error: str | None = None
        try:
            from rapidocr_onnxruntime import RapidOCR  # type: ignore

            self._engine = RapidOCR()
            logger.info("anpr.rapidocr.loaded")
        except Exception as exc:  # pragma: no cover
            self.error = f"rapidocr unavailable: {exc}"
            logger.error("anpr.rapidocr.load_failed", error=str(exc))

    @property
    def ready(self) -> bool:
        return self._engine is not None

    def read(self, crop_bgr: "np.ndarray") -> tuple[str, float] | None:
        if self._engine is None:
            return None
        try:
            with self._lock:
                result, _ = self._engine(crop_bgr)
        except Exception as exc:
            logger.debug("anpr.rapidocr.read_failed", error=str(exc))
            return None
        if not result:
            return None
        # result: list of [box, text, score]. Merge candidate lines, keep the
        # highest-scoring text as the primary read.
        best_text = ""
        best_score = 0.0
        for item in result:
            try:
                _, text, score = item
                score = float(score)
            except Exception:
                continue
            if score > best_score:
                best_score = score
                best_text = text
        if not best_text:
            return None
        return best_text, best_score


class AnprEngine:
    """Shared ANPR engine — one instance for the whole process."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.provider_name = (self.settings.anpr_ocr_provider or "none").lower()
        self._provider: Any | None = None
        self.error: str | None = None
        if not self.settings.anpr_enabled:
            self.error = "ANPR disabled by configuration"
            return
        if self.provider_name == "rapidocr":
            self._provider = _RapidOcrProvider()
            self.error = self._provider.error
        elif self.provider_name == "none":
            self.error = "OCR provider set to 'none'"
        else:
            self.error = f"unknown OCR provider '{self.provider_name}'"
            logger.warning("anpr.unknown_provider", provider=self.provider_name)

    @property
    def ready(self) -> bool:
        return self._provider is not None and getattr(self._provider, "ready", False)

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.settings.anpr_enabled,
            "provider": self.provider_name,
            "ready": self.ready,
            "error": self.error,
            "plate_detector": self.settings.anpr_plate_detector,
        }

    def read_plate(self, vehicle_crop_bgr: "np.ndarray") -> PlateRead | None:
        """Read a plate from a vehicle crop. Returns ``None`` on no/failed read.

        The normalized text is reported even when it fails the Indian plate
        grammar (best-effort, positional-repaired): the read is then marked
        ``uncertain`` so downstream never treats it as a confirmed plate.
        Characters are never invented; invalid candidates are only ever
        persisted with the uncertainty flag.
        """
        if not self.ready or vehicle_crop_bgr is None:
            return None
        if vehicle_crop_bgr.size == 0:
            return None
        h, w = vehicle_crop_bgr.shape[:2]
        if h < 12 or w < 12:
            return None

        raw = self._provider.read(vehicle_crop_bgr)
        if raw is None:
            return None
        text, ocr_conf = raw
        plate, valid = normalize_plate(text)
        if plate is None:
            return None
        if ocr_conf < self.settings.anpr_min_ocr_confidence:
            # Below the minimum OCR confidence there is no usable read at all.
            return None
        return PlateRead(
            plate=plate,
            plate_raw=text,
            confidence=ocr_conf,
            valid=valid,
            source="live_rtsp",
        )


_engine: AnprEngine | None = None
_engine_lock = threading.Lock()


def get_anpr_engine() -> AnprEngine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = AnprEngine()
    return _engine

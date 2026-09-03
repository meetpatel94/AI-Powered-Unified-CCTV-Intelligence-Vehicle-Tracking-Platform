"""YOLO / Ultralytics vehicle detector + integrated ByteTrack/BoT-SORT tracker.

Model-loading integrity contract
--------------------------------
The detector loads GENUINE pretrained Ultralytics weights from a configurable
path (``VEHICLE_MODEL_PATH``). This is the ONLY source of real detections.

If those weights cannot be loaded:

* By default the detector reports ``MODEL_NOT_READY`` (``ready`` is False) and
  produces **no detections at all**. It never fabricates output and never
  presents anything as a real government-feed result. The surrounding pipeline
  stays alive (streams keep flowing) but emits nothing until real weights are
  supplied.
* Only when ``VEHICLE_ALLOW_SYNTHETIC_FALLBACK`` is explicitly enabled (a
  development-only switch, default False) does it build a runnable model from an
  architecture YAML. That model has RANDOM / untrained weights, so every
  detection it produces is hard-labelled ``synthetic=True`` and the detector
  reports ``using_fallback=True`` / ``synthetic=True`` so nothing downstream can
  mistake it for a genuine detection.

Tracking uses Ultralytics' ``model.track(persist=True, ...)`` which runs
ByteTrack or BoT-SORT depending on ``TRACKER_CONFIG`` and returns stable
``track_id`` values across frames. One detector instance is created per camera
so tracker state never leaks between cameras.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import structlog

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# Import torch/ultralytics lazily so the API can boot even if the ML extras are
# not installed in a given environment.
try:  # pragma: no cover - import guard
    import torch  # type: ignore
    from ultralytics import YOLO  # type: ignore

    _ULTRALYTICS_AVAILABLE = True
    _IMPORT_ERROR: str | None = None
except Exception as exc:  # pragma: no cover
    torch = None  # type: ignore
    YOLO = None  # type: ignore
    _ULTRALYTICS_AVAILABLE = False
    _IMPORT_ERROR = str(exc)


@dataclass
class Detection:
    camera_id: str
    track_id: int | None
    cls_name: str
    confidence: float
    # bbox in normalized (AI) frame pixels: top-left + size.
    x: float
    y: float
    w: float
    h: float
    pts_ms: float | None = None
    # True when produced by an architecture-only (random-weight) dev fallback
    # model. Such detections are meaningless and must never be treated as a
    # genuine result. Always False for detections from real pretrained weights.
    synthetic: bool = False

    def bbox_xyxy(self) -> tuple[int, int, int, int]:
        return int(self.x), int(self.y), int(self.x + self.w), int(self.y + self.h)

    def to_dict(self) -> dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "track_id": self.track_id,
            "class": self.cls_name,
            "confidence": round(self.confidence, 4),
            "bbox": {
                "x": round(self.x, 1),
                "y": round(self.y, 1),
                "w": round(self.w, 1),
                "h": round(self.h, 1),
            },
            "pts_ms": self.pts_ms,
            "synthetic": self.synthetic,
        }


def resolve_device(requested: str) -> str:
    req = (requested or "auto").strip().lower()
    if req in ("auto", ""):
        if _ULTRALYTICS_AVAILABLE and torch is not None and torch.cuda.is_available():
            return "cuda:0"
        return "cpu"
    return req


# --------------------------------------------------------------------------- #
# Startup pre-flight / global AI health
# --------------------------------------------------------------------------- #
# One model load at startup validates that genuine weights are available and
# reports them via /api/ai/status + the ``ai:status`` realtime frame. Per-camera
# workers keep their OWN detector instance so ByteTrack/BoT-SORT tracker state
# never leaks between cameras (the shared pre-flight is discarded afterwards,
# leaving the OS page cache warm for the per-camera loads).
_preflight: dict[str, Any] | None = None
_preflight_lock = threading.Lock()


def preflight_detector(force: bool = False) -> dict[str, Any]:
    """Load (once) and return the genuine-weights health probe.

    Never raises: a missing/unloadable model simply reports MODEL_NOT_READY so
    upstream health endpoints can surface it honestly.
    """
    global _preflight
    if _preflight is not None and not force:
        return dict(_preflight)
    with _preflight_lock:
        if _preflight is not None and not force:
            return dict(_preflight)
        settings = get_settings()
        probe: VehicleDetector | None = None
        try:
            # Instantiate + load once at startup (temp id, no tracker events).
            probe = VehicleDetector("__ai_preflight__")
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("ai.preflight_failed", error=str(exc))
        status: dict[str, Any] = {
            "ultralytics_available": _ULTRALYTICS_AVAILABLE,
            "torch_available": torch is not None,
            "import_error": _IMPORT_ERROR,
            "configured_weights_path": settings.vehicle_model_path,
            "configured_device": settings.vehicle_device,
            "configured_conf_threshold": settings.vehicle_conf_threshold,
            "configured_infer_fps": settings.vehicle_infer_fps,
            "configured_infer_imgsz": settings.vehicle_infer_imgsz,
            "configured_vehicle_classes": settings.vehicle_class_list,
            "preflight_status": "ERROR",
        }
        if probe is not None:
            status.update(probe.status())
            status["preflight_status"] = "READY" if probe.ready else probe.status().get("status", "ERROR")
        _preflight = status
        logger.info(
            "ai.preflight",
            status=status.get("status"),
            device=status.get("device"),
            source=status.get("model_source"),
            error=status.get("model_error"),
        )
        return dict(_preflight)


def preflight_health() -> dict[str, Any]:
    """Latest pre-flight health without re-loading (per-camera workers can
    still differ: this is the startup probe)."""
    if _preflight is None:
        # No pre-flight performed (pipeline disabled / pre-import call): report
        # the raw environment facts without claiming a loaded model.
        settings = get_settings()
        return {
            "ultralytics_available": _ULTRALYTICS_AVAILABLE,
            "torch_available": torch is not None,
            "import_error": _IMPORT_ERROR,
            "configured_weights_path": settings.vehicle_model_path,
            "configured_device": settings.vehicle_device,
            "ready": False,
            "model_loaded": False,
            "status": "NOT_PREFLIGHTED",
            "preflight_status": "NOT_PREFLIGHTED",
            "synthetic": False,
            "using_fallback": False,
        }
    return dict(_preflight)


class VehicleDetector:
    """Per-camera YOLO detector with integrated multi-object tracking."""

    # A single shared class map is fine; each camera gets its own YOLO instance
    # so ByteTrack/BoT-SORT internal state is isolated.
    def __init__(self, camera_id: str) -> None:
        self.camera_id = camera_id
        self.settings = get_settings()
        self.device = resolve_device(self.settings.vehicle_device)
        self.model: Any | None = None
        self.model_source: str | None = None
        self.model_error: str | None = None
        self.using_fallback = False
        # True only when running the architecture-only (random-weight) dev
        # fallback. Detections from such a model are labelled synthetic.
        self.synthetic = False
        self._names: dict[int, str] = {}
        self._vehicle_class_ids: set[int] = set()
        self._lock = threading.Lock()
        self._load_model()

    # ------------------------------------------------------------------ #
    # Model lifecycle
    # ------------------------------------------------------------------ #
    def _load_model(self) -> None:
        if not _ULTRALYTICS_AVAILABLE:
            self.model_error = f"ultralytics/torch unavailable: {_IMPORT_ERROR}"
            logger.error("detector.import_failed", camera_id=self.camera_id, error=self.model_error)
            return

        path = self.settings.vehicle_model_path

        # 1) Preferred path: load GENUINE weights. A ``.pt`` file on disk, or a
        #    name Ultralytics can resolve to a real cached checkpoint.
        try:
            if path and os.path.exists(path):
                self.model = YOLO(path)
                self.model_source = path
                logger.info(
                    "detector.loaded", camera_id=self.camera_id, source=path, device=self.device
                )
            else:
                # Not a local file — try resolving by name (a genuine cached
                # checkpoint). This must NOT silently build random weights.
                self.model = YOLO(path)
                self.model_source = path
                logger.info("detector.loaded_by_name", camera_id=self.camera_id, source=path)
        except Exception as load_exc:
            # 2) Real weights unavailable. Do NOT fabricate detections. Only fall
            #    back to an architecture-only (random-weight) model when the
            #    development escape hatch is explicitly enabled — and label it.
            self.model = None
            if self.settings.vehicle_allow_synthetic_fallback:
                fallback = self.settings.vehicle_model_fallback_yaml
                try:
                    self.model = YOLO(fallback)
                    self.model_source = fallback
                    self.using_fallback = True
                    self.synthetic = True
                    self.model_error = (
                        f"MODEL_NOT_READY: genuine weights '{path}' unavailable "
                        f"({load_exc}); DEV synthetic fallback '{fallback}' active "
                        f"— detections are random/untrained and flagged synthetic"
                    )
                    logger.warning(
                        "detector.synthetic_fallback",
                        camera_id=self.camera_id,
                        weights=path,
                        fallback=fallback,
                        note="DEV ONLY - detections are synthetic/random-weight",
                    )
                except Exception as fb_exc:
                    self.model_error = (
                        f"MODEL_NOT_READY: genuine weights '{path}' unavailable "
                        f"({load_exc}); synthetic fallback also failed ({fb_exc})"
                    )
                    logger.error(
                        "detector.model_not_ready",
                        camera_id=self.camera_id,
                        error=self.model_error,
                    )
                    return
            else:
                # Production/default: fail safe. No model, no detections.
                self.model_error = (
                    f"MODEL_NOT_READY: could not load genuine vehicle weights from "
                    f"VEHICLE_MODEL_PATH='{path}' ({load_exc}). No detections will be "
                    f"produced. Provide real pretrained weights, or enable "
                    f"VEHICLE_ALLOW_SYNTHETIC_FALLBACK for development only."
                )
                logger.error(
                    "detector.model_not_ready",
                    camera_id=self.camera_id,
                    weights=path,
                    error=str(load_exc),
                )
                return

        # Build class name map + vehicle-class id set.
        try:
            names = getattr(self.model, "names", {}) or {}
            if isinstance(names, dict):
                self._names = {int(k): str(v) for k, v in names.items()}
            else:  # list-like
                self._names = {i: str(v) for i, v in enumerate(names)}
            wanted = set(self.settings.vehicle_class_list)
            self._vehicle_class_ids = {
                cid for cid, name in self._names.items() if name.lower() in wanted
            }
            if not self._vehicle_class_ids:
                logger.warning(
                    "detector.no_vehicle_classes",
                    camera_id=self.camera_id,
                    wanted=sorted(wanted),
                    have=sorted(set(self._names.values()))[:20],
                )
        except Exception:
            logger.exception("detector.names_failed", camera_id=self.camera_id)

    @property
    def ready(self) -> bool:
        """True only when a model is loaded and producing trustworthy output.

        A synthetic (architecture-only, random-weight) dev fallback is NOT
        considered ready: it must never be relied on as a genuine detector.
        """
        return self.model is not None and not self.synthetic

    def status(self) -> dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            # Genuine, trustworthy detector.
            "ready": self.ready,
            # Model object exists at all (may be the synthetic dev fallback).
            "model_loaded": self.model is not None,
            "device": self.device,
            "model_source": self.model_source,
            "using_fallback": self.using_fallback,
            # Detections (if any) come from random/untrained weights.
            "synthetic": self.synthetic,
            "status": (
                "READY"
                if self.ready
                else ("SYNTHETIC_FALLBACK" if self.synthetic else "MODEL_NOT_READY")
            ),
            "model_error": self.model_error,
            "vehicle_class_ids": sorted(self._vehicle_class_ids),
        }

    # ------------------------------------------------------------------ #
    # Inference
    # ------------------------------------------------------------------ #
    def detect_and_track(self, frame_bgr: "np.ndarray", pts_ms: float | None) -> list[Detection]:
        """Run detection + tracking on a single BGR frame.

        Returns only vehicle-class detections. Never raises — model/inference
        errors are logged and yield an empty list so the stream keeps running.
        """
        if self.model is None or frame_bgr is None:
            return []

        s = self.settings
        try:
            with self._lock:
                results = self.model.track(
                    frame_bgr,
                    persist=True,
                    tracker=s.tracker_config,
                    conf=s.vehicle_conf_threshold,
                    iou=s.vehicle_iou_threshold,
                    imgsz=s.vehicle_infer_imgsz,
                    device=self.device,
                    classes=sorted(self._vehicle_class_ids) or None,
                    verbose=False,
                )
        except Exception as exc:
            logger.warning("detector.infer_failed", camera_id=self.camera_id, error=str(exc))
            return []

        if not results:
            return []

        res = results[0]
        boxes = getattr(res, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return []

        detections: list[Detection] = []
        try:
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            clses = boxes.cls.cpu().numpy().astype(int)
            ids = (
                boxes.id.cpu().numpy().astype(int)
                if getattr(boxes, "id", None) is not None
                else np.full(len(xyxy), -1)
            )
        except Exception as exc:
            logger.warning("detector.box_parse_failed", camera_id=self.camera_id, error=str(exc))
            return []

        for i in range(len(xyxy)):
            cid = int(clses[i])
            if self._vehicle_class_ids and cid not in self._vehicle_class_ids:
                continue
            x1, y1, x2, y2 = (float(v) for v in xyxy[i])
            tid = int(ids[i]) if ids[i] >= 0 else None
            detections.append(
                Detection(
                    camera_id=self.camera_id,
                    track_id=tid,
                    cls_name=self._names.get(cid, str(cid)),
                    confidence=float(confs[i]),
                    x=x1,
                    y=y1,
                    w=x2 - x1,
                    h=y2 - y1,
                    pts_ms=pts_ms,
                    synthetic=self.synthetic,
                )
            )
        return detections

    def reset_tracker(self) -> None:
        """Drop tracker state (e.g. after a stream reconnect)."""
        if self.model is not None:
            try:
                # Ultralytics stores trackers on the predictor; clearing forces
                # a fresh tracker on the next track() call.
                predictor = getattr(self.model, "predictor", None)
                if predictor is not None and hasattr(predictor, "trackers"):
                    predictor.trackers = []
            except Exception:
                logger.debug("detector.tracker_reset_noop", camera_id=self.camera_id)

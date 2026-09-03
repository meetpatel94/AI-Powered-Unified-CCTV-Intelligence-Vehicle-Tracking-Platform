"""YOLO model lifecycle / detection schema / tracker isolation tests.

Uses deterministic stub model objects — production runtime always uses real
Ultralytics inference; these fixtures only exercise the contract.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.vision import detector as det


class _FakeTorchNoCuda:
    class cuda:  # noqa: N801 - mirrors torch.cuda
        @staticmethod
        def is_available() -> bool:
            return False


class _FakeTorchWithCuda:
    class cuda:  # noqa: N801
        @staticmethod
        def is_available() -> bool:
            return True


class _FakeBoxes:
    def __init__(self, xyxy, conf, cls, ids=None):
        self._n = len(xyxy)
        self.xyxy = type("T", (), {"cpu": lambda self: self, "numpy": lambda self: np.asarray(xyxy)})()
        self.conf = type("T", (), {"cpu": lambda self: self, "numpy": lambda self: np.asarray(conf)})()
        self.cls = type("T", (), {"cpu": lambda self: self, "numpy": lambda self: np.asarray(cls)})()
        self.id = None if ids is None else type("T", (), {"cpu": lambda self: self, "numpy": lambda self: np.asarray(ids)})()

    def __len__(self):
        return self._n


class _FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


class _FakePredictor:
    def __init__(self):
        self.trackers = ["tracker-state"]


class _FakeModel:
    def __init__(self, results):
        self._results = results
        self.predictor = None
        self.names = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

    def track(self, *args, **kwargs):
        return self._results


def _stub_detector(monkeypatch, *, model=None, synthetic=False):
    monkeypatch.setattr(det, "_ULTRALYTICS_AVAILABLE", True)
    monkeypatch.setattr(det, "torch", _FakeTorchNoCuda())
    obj = det.VehicleDetector.__new__(det.VehicleDetector)
    obj.camera_id = "cam-001"
    obj.settings = det.get_settings()
    obj.device = "cpu"
    obj.model = model
    obj.model_source = "fake-weights.pt"
    obj.model_error = None
    obj.using_fallback = synthetic
    obj.synthetic = synthetic
    obj._names = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
    obj._vehicle_class_ids = {2, 3, 5, 7}
    obj._lock = __import__("threading").Lock()
    return obj


def test_resolve_device_cpu_when_no_cuda(monkeypatch):
    monkeypatch.setattr(det, "_ULTRALYTICS_AVAILABLE", True)
    monkeypatch.setattr(det, "torch", _FakeTorchNoCuda())
    assert det.resolve_device("auto") == "cpu"
    assert det.resolve_device("cpu") == "cpu"
    assert det.resolve_device("cuda:0") == "cuda:0"


def test_resolve_device_cuda_when_available(monkeypatch):
    monkeypatch.setattr(det, "_ULTRALYTICS_AVAILABLE", True)
    monkeypatch.setattr(det, "torch", _FakeTorchWithCuda())
    assert det.resolve_device("auto") == "cuda:0"


def test_model_not_ready_when_ml_unavailable(monkeypatch):
    monkeypatch.setattr(det, "_ULTRALYTICS_AVAILABLE", False)
    monkeypatch.setattr(det, "torch", None)
    monkeypatch.setattr(det, "_IMPORT_ERROR", "no ultralytics")
    obj = det.VehicleDetector.__new__(det.VehicleDetector)
    obj.camera_id = "cam-001"
    obj.settings = det.get_settings()
    obj.device = "cpu"
    obj.model = None
    obj.model_source = None
    obj.model_error = "MODEL_NOT_READY: no ultralytics"
    obj.using_fallback = False
    obj.synthetic = False
    obj._names = {}
    obj._vehicle_class_ids = set()
    obj._lock = __import__("threading").Lock()
    status = obj.status()
    assert status["ready"] is False
    assert status["status"] == "MODEL_NOT_READY"
    assert "MODEL_NOT_READY" in (status["model_error"] or "")
    # No model → no detections (never fabricates).
    assert obj.detect_and_track(np.zeros((10, 10, 3), dtype=np.uint8), pts_ms=123.0) == []


def test_detection_output_schema_and_filtering(monkeypatch):
    boxes = _FakeBoxes(
        xyxy=[[10, 20, 50, 80], [5, 5, 30, 40], [1, 1, 8, 8]],
        conf=[0.9, 0.7, 0.99],
        cls=[2, 3, 0],  # car, motorcycle, person (excluded)
        ids=[7, 8, 9],
    )
    obj = _stub_detector(monkeypatch, model=_FakeModel([_FakeResult(boxes)]))
    out = obj.detect_and_track(np.zeros((100, 100, 3), dtype=np.uint8), pts_ms=456.0)
    assert len(out) == 2  # person filtered out
    first = out[0]
    assert first.camera_id == "cam-001"
    assert first.cls_name == "car"
    assert first.track_id == 7
    assert first.confidence == pytest.approx(0.9)
    assert first.pts_ms == 456.0
    assert first.synthetic is False
    d = first.to_dict()
    assert set(d) == {"camera_id", "track_id", "class", "confidence", "bbox", "pts_ms", "synthetic"}
    assert set(d["bbox"]) == {"x", "y", "w", "h"}


def test_detector_never_raises_on_inference_failure(monkeypatch):
    class _BoomModel(_FakeModel):
        def track(self, *args, **kwargs):
            raise RuntimeError("gpu oom")

    obj = _stub_detector(monkeypatch, model=_BoomModel([]))
    assert obj.detect_and_track(np.zeros((64, 64, 3), dtype=np.uint8), pts_ms=1.0) == []


def test_tracker_reset_clears_predictor_state(monkeypatch):
    """reset_tracker() must delete ``predictor.trackers`` entirely.

    Regression test for a real bug found during live E2E testing: setting
    ``predictor.trackers = []`` (instead of removing the attribute) left the
    attribute present-but-empty. Ultralytics' own
    ``on_predict_start(persist=True)`` hook only rebuilds trackers when the
    attribute is *absent* (``if hasattr(predictor, "trackers") and persist:
    return``), so every ``track()`` call after a reconnect indexed into an
    empty list and crashed the whole camera's detection with
    ``IndexError: list index out of range`` — silently killing vehicle
    detection on every camera after its first RTSP reconnect.
    """
    predictor = _FakePredictor()
    model = _FakeModel([])
    model.predictor = predictor
    obj = _stub_detector(monkeypatch, model=model)
    assert predictor.trackers == ["tracker-state"]
    obj.reset_tracker()
    assert not hasattr(predictor, "trackers"), (
        "reset_tracker() must delattr, not set to [], or Ultralytics' "
        "persist=True guard will skip rebuilding the tracker and crash "
        "with IndexError on the next track() call"
    )
    # Never raises when no predictor exists.
    obj.model.predictor = None
    obj.reset_tracker()


def test_synthetic_detector_status_is_never_ready(monkeypatch):
    obj = _stub_detector(monkeypatch, model=_FakeModel([]), synthetic=True)
    status = obj.status()
    assert status["synthetic"] is True
    assert status["using_fallback"] is True
    assert status["ready"] is False
    assert status["status"] == "SYNTHETIC_FALLBACK"


def test_preflight_health_reports_environment_without_loading(monkeypatch):
    monkeypatch.setattr(det, "_preflight", None)
    health = det.preflight_health()
    assert health["status"] == "NOT_PREFLIGHTED"
    assert health["ready"] is False
    assert "configured_weights_path" in health

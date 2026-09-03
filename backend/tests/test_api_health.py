"""API health / AI status endpoint tests (TestClient, no lifespan side-effects)."""

from __future__ import annotations

from fastapi.testclient import TestClient


class _StubManager:
    def list_status(self):
        return [
            {
                "camera_id": "cam-001",
                "alive": True,
                "detector_ready": True,
                "synthetic": False,
                "frames_processed": 100,
                "frames_skipped": 10,
                "frames_dropped": 0,
                "inference_throttled": 0,
                "detections_total": 30,
                "anpr_reads": 4,
                "avg_inference_ms": 12.5,
                "avg_anpr_ms": 8.0,
                "effective_infer_fps": 5.0,
                "anpr_ready": True,
                "queue_depth": 1,
                "last_error": None,
                "last_infer_at": "2026-09-03T10:00:00+00:00",
                "detector": {
                    "camera_id": "cam-001",
                    "ready": True,
                    "model_loaded": True,
                    "device": "cpu",
                    "model_source": "/models/yolov8n.pt",
                    "using_fallback": False,
                    "synthetic": False,
                    "status": "READY",
                    "model_error": None,
                    "vehicle_class_ids": [2, 3, 5, 7],
                },
                "anpr": {"enabled": True, "provider": "none", "ready": False},
            }
        ]


class _StubAnprEngine:
    def status(self):
        return {"enabled": True, "provider": "rapidocr", "ready": True, "error": None}


class _StubVi:
    @staticmethod
    def pipeline_counts(db):
        return {
            "vehicles": 12,
            "anpr_sightings": 55,
            "tracks": 20,
            "journey_points": 8,
        }


def test_health_endpoint(monkeypatch):
    from app.main import app

    import app.api.health as health_api

    monkeypatch.setattr(health_api, "check_database", lambda: True)
    monkeypatch.setattr(health_api, "probe_catalogue", lambda: False)
    monkeypatch.setattr(health_api.gateway, "list_snapshots", lambda: [])

    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["sentinel"] == "unreachable"
    assert body["live_streams"] == "0"


def test_ai_status_endpoint(monkeypatch):
    from app.main import app

    import app.services.pipeline as pipeline_mod
    import app.vision.anpr as anpr_mod
    import app.vision.detector as det_mod

    monkeypatch.setattr(pipeline_mod, "manager", _StubManager())
    monkeypatch.setattr(pipeline_mod, "vehicle_intel_service", _StubVi())
    monkeypatch.setattr(anpr_mod, "get_anpr_engine", lambda: _StubAnprEngine())
    monkeypatch.setattr(
        det_mod,
        "preflight_health",
        lambda: {
            "ultralytics_available": True,
            "torch_available": True,
            "import_error": None,
            "configured_weights_path": "/models/yolov8n.pt",
            "configured_device": "auto",
            "ready": True,
            "model_loaded": True,
            "model_source": "/models/yolov8n.pt",
            "using_fallback": False,
            "synthetic": False,
            "status": "READY",
            "model_error": None,
            "vehicle_class_ids": [2, 3, 5, 7],
            "device": "cpu",
            "preflight_status": "READY",
        },
    )

    client = TestClient(app)
    r = client.get("/api/ai/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "READY"
    assert body["device"] == "cpu"
    assert body["model"]["ready"] is True
    assert body["model"]["status"] == "READY"
    assert body["anpr"]["ready"] is True
    assert body["workers"]["total"] == 1
    assert body["workers"]["ready"] == 1
    assert body["counts"]["vehicles"] == 12


def test_ai_status_reports_model_not_ready_honestly(monkeypatch):
    """A missing model is reported, never faked."""
    from app.main import app

    import app.services.pipeline as pipeline_mod
    import app.vision.anpr as anpr_mod
    import app.vision.detector as det_mod

    monkeypatch.setattr(
        pipeline_mod, "manager", type("M", (), {"list_status": lambda self: []})()
    )
    monkeypatch.setattr(pipeline_mod, "vehicle_intel_service", _StubVi())
    monkeypatch.setattr(anpr_mod, "get_anpr_engine", lambda: _StubAnprEngine())
    monkeypatch.setattr(
        det_mod,
        "preflight_health",
        lambda: {
            "ultralytics_available": True,
            "torch_available": True,
            "import_error": None,
            "configured_weights_path": "/models/missing.pt",
            "configured_device": "auto",
            "ready": False,
            "model_loaded": False,
            "using_fallback": False,
            "synthetic": False,
            "status": "MODEL_NOT_READY",
            "model_error": "MODEL_NOT_READY: no weights",
            "device": "cpu",
            "preflight_status": "MODEL_NOT_READY",
        },
    )

    client = TestClient(app)
    r = client.get("/api/ai/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "MODEL_NOT_READY"
    assert body["model"]["ready"] is False
    assert "MODEL_NOT_READY" in body["model"]["error"]
    assert body["workers"]["total"] == 0

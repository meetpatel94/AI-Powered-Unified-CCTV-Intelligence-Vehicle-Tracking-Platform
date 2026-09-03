"""Vehicle Intelligence Pipeline orchestrator.

One :class:`PipelineWorker` per camera pulls the latest normalized JPEG from the
Stream Gateway at the configured inference FPS, then runs::

    frame -> YOLO detection + ByteTrack/BoT-SORT tracking
          -> ANPR/OCR on each vehicle crop
          -> persist tracks / ANPR sightings / vehicle identity / journey
          -> publish detection / anpr / track / journey WebSocket events

The pipeline consumes cameras **dynamically** from the Stream Gateway (whose
RTSP URLs come from the Sentinel Camera Registry) — no camera URL is ever
hard-coded here. Model, OCR, dropped-frame and stream-loss failures are all
handled gracefully: the worker logs and keeps polling.
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import structlog

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.events import publish
from app.services.stream_gateway import StreamState, gateway
from app.services.vehicle_intel import record_anpr_sighting, upsert_track
from app.vision.anpr import get_anpr_engine
from app.vision.detector import VehicleDetector

logger = structlog.get_logger(__name__)

try:  # cv2 is used for JPEG decode + crops
    import cv2  # type: ignore

    _CV2 = True
except Exception as exc:  # pragma: no cover
    cv2 = None  # type: ignore
    _CV2 = False
    _CV2_ERR = str(exc)


def _decode_jpeg(jpeg: bytes) -> "np.ndarray | None":
    if not _CV2 or not jpeg:
        return None
    try:
        arr = np.frombuffer(jpeg, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


class PipelineWorker:
    """Per-camera inference loop."""

    def __init__(self, camera_id: str) -> None:
        self.camera_id = camera_id
        self.settings = get_settings()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._detector: VehicleDetector | None = None
        self._last_jpeg_id: int | None = None
        self._last_infer_ts = 0.0

        # Stats
        self.frames_processed = 0
        self.frames_skipped = 0
        self.detections_total = 0
        self.anpr_reads = 0
        self.last_error: str | None = None
        self.started_at: float | None = None
        self.last_infer_at: float | None = None

    # -------------------------------------------------------------- #
    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name=f"pipeline-{self.camera_id}", daemon=True
        )
        self._thread.start()
        logger.info("pipeline.worker.started", camera_id=self.camera_id)

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("pipeline.worker.stopped", camera_id=self.camera_id)

    def is_alive(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def status(self) -> dict[str, Any]:
        det = (
            self._detector.status()
            if self._detector
            else {"ready": False, "status": "MODEL_NOT_READY", "synthetic": False}
        )
        return {
            "camera_id": self.camera_id,
            "alive": self.is_alive(),
            # Surface trust state at the top level for easy monitoring:
            # True only when a genuine (non-synthetic) model is loaded.
            "detector_ready": bool(det.get("ready")),
            "synthetic": bool(det.get("synthetic")),
            "frames_processed": self.frames_processed,
            "frames_skipped": self.frames_skipped,
            "detections_total": self.detections_total,
            "anpr_reads": self.anpr_reads,
            "last_error": self.last_error,
            "last_infer_at": (
                datetime.fromtimestamp(self.last_infer_at, tz=timezone.utc).isoformat()
                if self.last_infer_at
                else None
            ),
            "detector": det,
        }

    # -------------------------------------------------------------- #
    def _run(self) -> None:
        self.started_at = time.time()
        # Build the detector lazily inside the thread (model load is heavy).
        try:
            self._detector = VehicleDetector(self.camera_id)
        except Exception as exc:  # pragma: no cover
            self.last_error = f"detector init failed: {exc}"
            logger.exception("pipeline.detector_init_failed", camera_id=self.camera_id)
            return

        if not _CV2:
            self.last_error = f"opencv unavailable: {_CV2_ERR}"
            logger.error("pipeline.no_cv2", camera_id=self.camera_id)
            return

        anpr = get_anpr_engine()
        interval = 1.0 / max(0.5, self.settings.vehicle_infer_fps)
        prev_state: str | None = None

        while not self._stop.is_set():
            worker = gateway.get_worker(self.camera_id)
            if worker is None:
                # Stream not started yet — wait for the gateway to bring it up.
                if self._stop.wait(1.0):
                    break
                continue

            snap = worker.snapshot()
            # Handle stream loss / reconnect: reset tracker so IDs don't leak
            # across a discontinuity.
            if prev_state == StreamState.LIVE.value and snap.state != StreamState.LIVE.value:
                if self._detector:
                    self._detector.reset_tracker()
                logger.info("pipeline.stream_lost", camera_id=self.camera_id, state=snap.state)
            prev_state = snap.state

            if snap.state != StreamState.LIVE.value:
                if self._stop.wait(0.5):
                    break
                continue

            now = time.monotonic()
            if now - self._last_infer_ts < interval:
                if self._stop.wait(min(0.02, interval)):
                    break
                continue

            jpeg = worker.latest_jpeg()
            if not jpeg:
                self.frames_skipped += 1
                if self._stop.wait(0.05):
                    break
                continue

            # Skip if we've already processed this exact frame (dropped/stale).
            jpeg_id = id(jpeg)
            if jpeg_id == self._last_jpeg_id:
                self.frames_skipped += 1
                if self._stop.wait(0.03):
                    break
                continue
            self._last_jpeg_id = jpeg_id
            self._last_infer_ts = now

            pts_ms = snap.last_pts_ms
            try:
                self._process_frame(jpeg, pts_ms, anpr)
            except Exception as exc:  # never let one frame kill the loop
                self.last_error = str(exc)
                logger.exception("pipeline.frame_failed", camera_id=self.camera_id)

    # -------------------------------------------------------------- #
    def _process_frame(self, jpeg: bytes, pts_ms: float | None, anpr) -> None:
        frame = _decode_jpeg(jpeg)
        if frame is None:
            self.frames_skipped += 1
            return

        assert self._detector is not None
        detections = self._detector.detect_and_track(frame, pts_ms)
        self.frames_processed += 1
        self.last_infer_at = time.time()

        if not detections:
            return

        self.detections_total += len(detections)
        seen_at = datetime.now(timezone.utc)

        # If the detector is running the development-only synthetic fallback
        # (architecture-only, random weights), its detections are meaningless.
        # We broadcast them for dev overlays — hard-labelled synthetic so the UI
        # can badge/hide them — but we NEVER persist them to the database or run
        # ANPR / journey logic. This guarantees no fabricated data can ever be
        # served by the vehicle-identity / sightings / journey APIs or presented
        # as a genuine government-feed result.
        is_synthetic = bool(self._detector and self._detector.synthetic)

        # Broadcast raw detections for live overlays.
        publish(
            "detection",
            {
                "camera_id": self.camera_id,
                "pts_ms": pts_ms,
                "timestamp": seen_at.isoformat(),
                "synthetic": is_synthetic,
                "detections": [d.to_dict() for d in detections],
            },
        )

        if is_synthetic:
            # Do not persist or ANPR-process untrusted synthetic detections.
            return

        db = SessionLocal()
        try:
            for det in detections:
                # Persist / update the track.
                if det.track_id is not None:
                    try:
                        upsert_track(
                            db,
                            camera_id=self.camera_id,
                            track_id=det.track_id,
                            vehicle_class=det.cls_name,
                            seen_at=seen_at,
                            pts_ms=pts_ms,
                            bbox=(det.x, det.y, det.w, det.h),
                            confidence=det.confidence,
                        )
                    except Exception:
                        db.rollback()
                        logger.exception("pipeline.track_persist_failed", camera_id=self.camera_id)

                # ANPR only on the vehicle region.
                plate_read = None
                if anpr.ready:
                    crop = self._crop(frame, det)
                    if crop is not None:
                        try:
                            plate_read = anpr.read_plate(crop)
                        except Exception:
                            logger.exception("pipeline.anpr_failed", camera_id=self.camera_id)

                if plate_read is not None:
                    self.anpr_reads += 1
                    evidence_path = self._save_evidence(frame, det, plate_read.plate, seen_at)
                    try:
                        result = record_anpr_sighting(
                            db,
                            plate=plate_read.plate,
                            plate_raw=plate_read.plate_raw,
                            camera_id=self.camera_id,
                            seen_at=seen_at,
                            ocr_confidence=plate_read.confidence,
                            detection_confidence=det.confidence,
                            vehicle_class=det.cls_name,
                            track_id=det.track_id,
                            bbox=(det.x, det.y, det.w, det.h),
                            pts_ms=pts_ms,
                            evidence_path=evidence_path,
                        )
                        db.commit()
                    except Exception:
                        db.rollback()
                        logger.exception("pipeline.anpr_persist_failed", camera_id=self.camera_id)
                        result = None

                    if result is not None:
                        publish(
                            "anpr:hit",
                            {
                                "camera_id": self.camera_id,
                                "plate": result["plate"],
                                "plate_raw": result["plate_raw"],
                                "confidence": result["ocr_confidence"],
                                "vehicle_class": result["vehicle_class"],
                                "track_id": result["track_id"],
                                "location_name": result["location_name"],
                                "evidence_path": result["evidence_path"],
                                "timestamp": result["seen_at"],
                            },
                        )
                        if result.get("journey"):
                            publish(
                                "journey",
                                {
                                    "plate": result["plate"],
                                    "vehicle_id": result["vehicle_id"],
                                    **result["journey"],
                                },
                            )
                        # Tag the track with the plate for cross-linking.
                        if det.track_id is not None:
                            try:
                                upsert_track(
                                    db,
                                    camera_id=self.camera_id,
                                    track_id=det.track_id,
                                    vehicle_class=det.cls_name,
                                    seen_at=seen_at,
                                    pts_ms=pts_ms,
                                    bbox=(det.x, det.y, det.w, det.h),
                                    confidence=det.confidence,
                                    plate=result["plate"],
                                )
                                db.commit()
                            except Exception:
                                db.rollback()

            # Broadcast track summary for this frame.
            tracked = [d for d in detections if d.track_id is not None]
            if tracked:
                publish(
                    "track",
                    {
                        "camera_id": self.camera_id,
                        "timestamp": seen_at.isoformat(),
                        "tracks": [
                            {
                                "track_id": d.track_id,
                                "class": d.cls_name,
                                "confidence": round(d.confidence, 4),
                                "bbox": {"x": d.x, "y": d.y, "w": d.w, "h": d.h},
                                "pts_ms": d.pts_ms,
                            }
                            for d in tracked
                        ],
                    },
                )
            db.commit()
        finally:
            db.close()

    # -------------------------------------------------------------- #
    @staticmethod
    def _crop(frame: "np.ndarray", det) -> "np.ndarray | None":
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = det.bbox_xyxy()
        x1 = max(0, min(x1, w - 1))
        y1 = max(0, min(y1, h - 1))
        x2 = max(0, min(x2, w))
        y2 = max(0, min(y2, h))
        if x2 - x1 < 8 or y2 - y1 < 8:
            return None
        return frame[y1:y2, x1:x2].copy()

    def _save_evidence(self, frame, det, plate: str, seen_at: datetime) -> str | None:
        if not self.settings.evidence_frames_enabled or not _CV2:
            return None
        crop = self._crop(frame, det)
        if crop is None:
            return None
        try:
            base = self.settings.evidence_frames_dir
            os.makedirs(base, exist_ok=True)
            ts = seen_at.strftime("%Y%m%d_%H%M%S_%f")
            fname = f"{self.camera_id}_{plate}_{ts}.jpg"
            path = os.path.join(base, fname)
            cv2.imwrite(path, crop, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            return path
        except Exception:
            logger.debug("pipeline.evidence_save_failed", camera_id=self.camera_id)
            return None


class PipelineManager:
    """Owns all pipeline workers and (optionally) auto-attaches to live cameras."""

    def __init__(self) -> None:
        self._workers: dict[str, PipelineWorker] = {}
        self._lock = threading.Lock()
        self._monitor: threading.Thread | None = None
        self._stop = threading.Event()

    def start(self, camera_id: str) -> dict[str, Any]:
        settings = get_settings()
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker and worker.is_alive():
                return worker.status()
            if worker is None:
                if len(self._workers) >= settings.vehicle_pipeline_max_workers:
                    raise RuntimeError(
                        f"Pipeline worker limit reached ({settings.vehicle_pipeline_max_workers})"
                    )
                worker = PipelineWorker(camera_id)
                self._workers[camera_id] = worker
        worker.start()
        return worker.status()

    def stop(self, camera_id: str) -> dict[str, Any] | None:
        with self._lock:
            worker = self._workers.get(camera_id)
        if not worker:
            return None
        worker.stop()
        return worker.status()

    def stop_all(self) -> None:
        self._stop.set()
        with self._lock:
            workers = list(self._workers.values())
        for w in workers:
            w.stop()

    def status(self, camera_id: str) -> dict[str, Any] | None:
        with self._lock:
            worker = self._workers.get(camera_id)
        return worker.status() if worker else None

    def list_status(self) -> list[dict[str, Any]]:
        with self._lock:
            workers = list(self._workers.values())
        return [w.status() for w in workers]

    def start_auto_monitor(self) -> None:
        settings = get_settings()
        if not settings.vehicle_pipeline_enabled or not settings.vehicle_pipeline_auto_attach:
            logger.info("pipeline.auto_attach.disabled")
            return
        if self._monitor and self._monitor.is_alive():
            return
        self._stop.clear()
        self._monitor = threading.Thread(
            target=self._monitor_loop, name="pipeline-monitor", daemon=True
        )
        self._monitor.start()
        logger.info("pipeline.auto_attach.started")

    def _monitor_loop(self) -> None:
        settings = get_settings()
        while not self._stop.wait(3.0):
            try:
                for snap in gateway.list_snapshots():
                    if snap.state == StreamState.LIVE.value:
                        with self._lock:
                            existing = self._workers.get(snap.camera_id)
                        if existing is None or not existing.is_alive():
                            if len(self._workers) < settings.vehicle_pipeline_max_workers:
                                try:
                                    self.start(snap.camera_id)
                                except Exception:
                                    logger.exception(
                                        "pipeline.auto_attach.failed", camera_id=snap.camera_id
                                    )
            except Exception:
                logger.exception("pipeline.monitor_loop_error")


manager = PipelineManager()

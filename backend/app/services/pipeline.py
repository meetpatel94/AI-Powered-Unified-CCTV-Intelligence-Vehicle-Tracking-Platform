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

import threading
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import structlog
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.vehicle import AnprSighting
from app.services import alerts as alerts_service
from app.services import evidence as evidence_service
from app.services import watchlist as watchlist_service
from app.services.events import publish
from app.services.stream_gateway import StreamState, gateway
from app.services import vehicle_intel as vehicle_intel_service
from app.services.vehicle_intel import record_anpr_sighting, upsert_track
from app.vision.anpr import get_anpr_engine
from app.vision.detector import VehicleDetector

logger = structlog.get_logger(__name__)

# Global concurrency limiter: bounds how many cameras run YOLO inference at the
# SAME instant (CPU/GPU limit). Frame *sampling* (vehicle_infer_fps) limits
# per-camera load; this bounds fleet-wide load. Acquisition is timed out and
# skipped-with-count rather than blocking indefinitely so a wedged model can
# never stall the whole fleet. Important events (persisted ANPR/watchlist) are
# never dropped — the limiter only delays/throttles the inference cadence.
_inference_semaphore: threading.BoundedSemaphore | None = None
_semaphore_lock = threading.Lock()


def _get_semaphore() -> threading.BoundedSemaphore:
    global _inference_semaphore
    if _inference_semaphore is None:
        with _semaphore_lock:
            if _inference_semaphore is None:
                _inference_semaphore = threading.BoundedSemaphore(
                    max(1, get_settings().ai_max_concurrent_inference)
                )
    return _inference_semaphore

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
        self.frames_dropped = 0
        self.inference_throttled = 0
        self.detections_total = 0
        self.anpr_reads = 0
        self.avg_inference_ms: float | None = None
        self.avg_anpr_ms: float | None = None
        self.last_error: str | None = None
        self.started_at: float | None = None
        self.last_infer_at: float | None = None
        # queue_depth mirrors how many NEW frames the gateway has produced
        # since we last consumed one — the consumer lag / back-pressure state.
        # The stream gateway is a latest-wins (bounded) design so this never
        # grows unbounded; it stays ~1 when inference keeps up and climbs when
        # the AI stage falls behind.
        self.queue_depth = 0
        self._last_seen_frame_count = 0

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
        now = time.time()
        uptime = (now - self.started_at) if self.started_at else 0.0
        effective_fps = round(self.frames_processed / uptime, 2) if uptime > 0 else 0.0
        anpr = None
        try:
            anpr = get_anpr_engine().status()
        except Exception:
            anpr = None
        return {
            "camera_id": self.camera_id,
            "alive": self.is_alive(),
            # Surface trust state at the top level for easy monitoring:
            # True only when a genuine (non-synthetic) model is loaded.
            "detector_ready": bool(det.get("ready")),
            "synthetic": bool(det.get("synthetic")),
            "frames_processed": self.frames_processed,
            "frames_skipped": self.frames_skipped,
            "frames_dropped": self.frames_dropped,
            "inference_throttled": self.inference_throttled,
            "detections_total": self.detections_total,
            "anpr_reads": self.anpr_reads,
            "avg_inference_ms": round(self.avg_inference_ms, 1) if self.avg_inference_ms else None,
            "avg_anpr_ms": round(self.avg_anpr_ms, 1) if self.avg_anpr_ms else None,
            # Trustworthy effective rate (frames processed / process uptime) —
            # never derived from the camera's reported FPS.
            "effective_infer_fps": effective_fps,
            "anpr_ready": bool(anpr and anpr.get("ready")),
            "queue_depth": self.queue_depth,
            "last_error": self.last_error,
            "last_infer_at": (
                datetime.fromtimestamp(self.last_infer_at, tz=timezone.utc).isoformat()
                if self.last_infer_at
                else None
            ),
            "detector": det,
            "anpr": anpr,
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

            # Consumer lag: frames produced by the gateway minus the count at
            # which we last consumed. Bounded to a small positive number because
            # the gateway keeps only the latest JPEG (latest-wins queue).
            produced = snap.frame_count
            if self._last_seen_frame_count == 0 and produced:
                self._last_seen_frame_count = produced
            if produced >= self._last_seen_frame_count:
                self.queue_depth = min(produced - self._last_seen_frame_count, 32)

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

            # Fleet-wide concurrency limit: acquire an inference slot. On
            # timeout we skip this *sampling* tick (frame sampling, not an
            # event — no ANPR data is lost, the same plate is read on a later
            # tick) and count the throttle for observability.
            semaphore = _get_semaphore()
            acquired = semaphore.acquire(timeout=0.1)
            if not acquired:
                self.inference_throttled += 1
                if self._stop.wait(0.02):
                    break
                continue
            try:
                self._last_jpeg_id = jpeg_id
                self._last_infer_ts = now

                pts_ms = snap.last_pts_ms
                try:
                    self._process_frame(jpeg, pts_ms, anpr)
                except Exception as exc:  # never let one frame kill the loop
                    self.last_error = str(exc)
                    self.frames_dropped += 1
                    logger.exception("pipeline.frame_failed", camera_id=self.camera_id)
            finally:
                semaphore.release()

    # -------------------------------------------------------------- #
    def _process_frame(self, jpeg: bytes, pts_ms: float | None, anpr) -> None:
        frame = _decode_jpeg(jpeg)
        if frame is None:
            self.frames_skipped += 1
            return

        assert self._detector is not None
        infer_start = time.monotonic()
        detections = self._detector.detect_and_track(frame, pts_ms)
        infer_ms = (time.monotonic() - infer_start) * 1000.0
        self.avg_inference_ms = (
            0.8 * self.avg_inference_ms + 0.2 * infer_ms
            if self.avg_inference_ms is not None else infer_ms
        )
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

        # Broadcast raw detections for live overlays. Kept at the configured
        # inference FPS (frame sampling), so this is inherently bounded — never
        # raw-frame-rate. ``detection`` is the legacy topic; ``vehicle:detected``
        # is the canonical structured topic (same payload, so both clients keep
        # working).
        h, w = frame.shape[:2]
        frame_meta = {
            "width": int(w),
            "height": int(h),
            "inference_ms": round(infer_ms, 1),
        }
        detected_payload: dict[str, Any] = {
            "camera_id": self.camera_id,
            "pts_ms": pts_ms,
            "timestamp": seen_at.isoformat(),
            "synthetic": is_synthetic,
            "frame": frame_meta,
            "detections": [
                {**d.to_dict(), "frame": frame_meta, "seen_at": seen_at.isoformat()}
                for d in detections
            ],
        }
        publish("detection", detected_payload)
        publish("vehicle:detected", detected_payload)

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
                            anpr_start = time.monotonic()
                            plate_read = anpr.read_plate(crop)
                            anpr_ms = (time.monotonic() - anpr_start) * 1000.0
                            if plate_read is not None:
                                self.avg_anpr_ms = (
                                    0.8 * self.avg_anpr_ms + 0.2 * anpr_ms
                                    if self.avg_anpr_ms is not None else anpr_ms
                                )
                        except Exception:
                            logger.exception("pipeline.anpr_failed", camera_id=self.camera_id)

                if plate_read is not None:
                    self.anpr_reads += 1
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
                            plate_valid=plate_read.valid,
                            plate_uncertain=plate_read.uncertain,
                            source=plate_read.source,
                        )
                        db.commit()
                    except Exception:
                        db.rollback()
                        logger.exception("pipeline.anpr_persist_failed", camera_id=self.camera_id)
                        result = None

                    if result is not None:
                        # Evidence Snapshot: one JPEG crop of the vehicle,
                        # referenced to the persisted sighting. No video.
                        evidence = self._capture_evidence(db, frame, det, result, seen_at)

                        publish(
                            "anpr:hit",
                            {
                                "camera_id": self.camera_id,
                                "plate": result["plate"],
                                "plate_raw": result["plate_raw"],
                                "confidence": result["ocr_confidence"],
                                "valid": result.get("plate_valid", False),
                                "uncertain": result.get("plate_uncertain", True),
                                "reliable": result.get("reliable", False),
                                "source": result.get("source", "live_rtsp"),
                                "pts_ms": pts_ms,
                                "vehicle_class": result["vehicle_class"],
                                "track_id": result["track_id"],
                                "location_name": result["location_name"],
                                "evidence_path": result["evidence_path"],
                                "evidence_id": evidence.id if evidence else None,
                                "evidence_url": f"/api/evidence/{evidence.id}/image" if evidence else None,
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
                            journey_info = result["journey"]
                            if journey_info.get("anomaly"):
                                self._raise_journey_anomaly(db, result, journey_info)

                        # Watchlist matching + Real-Time Alert Engine. Only
                        # genuine (persisted) sightings reach this point.
                        self._process_watchlist(db, result, jpeg, seen_at)

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

            # Broadcast track summary for this frame (``track`` legacy +
            # canonical ``vehicle:tracked``).
            tracked = [d for d in detections if d.track_id is not None]
            if tracked:
                track_payload = {
                    "camera_id": self.camera_id,
                    "timestamp": seen_at.isoformat(),
                    "pts_ms": pts_ms,
                    "frame": frame_meta,
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
                }
                publish("track", track_payload)
                publish("vehicle:tracked", track_payload)

            # Structured per-frame stats (DEBUG to avoid log flood): latency,
            # counts and trustworthy effective rate — all keyed by camera.
            uptime_s = time.time() - self.started_at if self.started_at else 0.0
            logger.debug(
                "pipeline.frame.stats",
                camera_id=self.camera_id,
                inference_ms=round(infer_ms, 1),
                anpr_ms=round(self.avg_anpr_ms, 1) if self.avg_anpr_ms is not None else None,
                detections=len(detections),
                tracked=len(tracked),
                queue_depth=self.queue_depth,
                effective_infer_fps=round(self.frames_processed / uptime_s, 2) if uptime_s > 0 else 0.0,
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

    def _capture_evidence(self, db, frame, det, result: dict, seen_at: datetime):
        """Store one JPEG crop of the detected vehicle for the ANPR hit."""
        if not self.settings.evidence_frames_enabled:
            return None
        snapshot = evidence_service.capture_crop_evidence(
            db,
            event_type="anpr_sighting",
            event_id=str(result["sighting_id"]),
            camera_id=self.camera_id,
            frame=frame,
            bbox=(det.x, det.y, det.w, det.h),
            plate=result["plate"],
            captured_at=seen_at,
            commit=False,
        )
        if snapshot is not None:
            try:
                sighting = db.get(AnprSighting, result["sighting_id"])
                if sighting is not None:
                    sighting.evidence_path = snapshot.file_path
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("pipeline.evidence_link_failed", camera_id=self.camera_id)
        return snapshot

    def _process_watchlist(self, db, result: dict, jpeg: bytes, seen_at: datetime) -> None:
        """Watchlist match + alert pipeline for one genuine ANPR hit.

        Creates exactly one match event (watchlist service enforces uniqueness
        per sighting+entry), optionally captures a full live-frame evidence
        snapshot, raises one alert (with duplicate suppression) and publishes a
        single ``watchlist:match`` WebSocket frame.
        """
        try:
            matched = watchlist_service.process_anpr_hit(db, result)
        except Exception:
            db.rollback()
            logger.exception("pipeline.watchlist_failed", camera_id=self.camera_id)
            return
        if matched is None:
            return
        match, entry = matched

        # Full live-frame evidence snapshot from the current buffer (a single
        # JPEG still — never video).
        evidence_id = None
        if self.settings.evidence_frames_enabled and self.settings.evidence_capture_on_watchlist and jpeg:
            snapshot = evidence_service.capture_evidence(
                db,
                event_type="watchlist_match",
                event_id=str(match.id),
                camera_id=self.camera_id,
                jpeg=jpeg,
                plate=match.plate,
                captured_at=seen_at,
                note="full live frame",
                commit=False,
            )
            if snapshot is not None:
                match.evidence_id = snapshot.id
                evidence_id = snapshot.id
                db.commit()

        # Real-Time Alert Engine: confirmed match → alert (suppressed when a
        # recent unresolved alert for the same entry+camera exists).
        try:
            alerts_service.raise_watchlist_alert(db, match, entry=entry, evidence_id=evidence_id)
        except Exception:
            db.rollback()
            logger.exception("pipeline.alert_failed", camera_id=self.camera_id)

        publish(
            "watchlist:match",
            watchlist_service.match_dict(match, entry=entry),
        )

    def _raise_journey_anomaly(self, db, result: dict, journey_info: dict) -> None:
        """Flag an impossible-travel interval computed by the journey builder."""
        try:
            alerts_service.create_alert(
                db,
                type="JOURNEY_ANOMALY",
                severity="medium",
                message=(
                    f"Journey anomaly for {result['plate']}: {journey_info.get('anomaly_reason') or 'impossible travel interval'} "
                    f"after {journey_info.get('camera_id')}"
                ),
                source_type="journey",
                dedupe_key=f"journey:{result['plate']}:{journey_info.get('journey_id')}:{journey_info.get('sequence')}",
                plate=result["plate"],
                camera_id=journey_info.get("camera_id") or self.camera_id,
                location_name=result.get("location_name"),
                source_ref=f"journey:{result['plate']}:{journey_info.get('journey_id')}",
                suppress_window_seconds=0,
            )
        except Exception:
            db.rollback()
            logger.exception("pipeline.journey_alert_failed", camera_id=self.camera_id)


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
        _safe_publish_ai_status()
        return worker.status()

    def stop(self, camera_id: str) -> dict[str, Any] | None:
        with self._lock:
            worker = self._workers.get(camera_id)
        if not worker:
            return None
        worker.stop()
        _safe_publish_ai_status()
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
        # Cameras whose worker died on a fatal init error (e.g. OpenCV/model
        # unavailable) are NOT respawned on every poll — retry on a slow
        # backoff instead so logs/stats aren't flooded.
        retry_backoff = 300.0
        last_attempt: dict[str, float] = {}
        # Periodic low-frequency ``ai:status`` realtime frame (bounded — never
        # per frame). Also published at startup + every worker start/stop.
        status_tick = 0.0
        while not self._stop.wait(3.0):
            now_mono = time.monotonic()
            if now_mono - status_tick >= settings.ai_status_publish_seconds:
                status_tick = now_mono
                _safe_publish_ai_status()
            try:
                for snap in gateway.list_snapshots():
                    if snap.state != StreamState.LIVE.value:
                        continue
                    with self._lock:
                        existing = self._workers.get(snap.camera_id)
                    if existing is not None and existing.is_alive():
                        continue
                    # A worker object exists but its thread exited — it logged
                    # a fatal init error. Retry only after the backoff window.
                    if existing is not None and not existing.is_alive():
                        last = last_attempt.get(snap.camera_id, 0.0)
                        if now_mono - last < retry_backoff:
                            continue
                    if len(self._workers) < settings.vehicle_pipeline_max_workers:
                        last_attempt[snap.camera_id] = now_mono
                        try:
                            self.start(snap.camera_id)
                        except Exception:
                            logger.exception(
                                "pipeline.auto_attach.failed", camera_id=snap.camera_id
                            )
            except Exception:
                logger.exception("pipeline.monitor_loop_error")


manager = PipelineManager()


# --------------------------------------------------------------------------- #
# AI health / status (global snapshot + bounded realtime ``ai:status`` frame)
# --------------------------------------------------------------------------- #
def ai_status_snapshot(db: Session | None = None) -> dict[str, Any]:
    """Aggregate global AI health: model pre-flight, per-camera workers, ANPR.

    ``db`` is optional so the pipeline monitor can publish without opening a
    database session in the hot path.
    """
    from app.vision.anpr import get_anpr_engine
    from app.vision.detector import preflight_health

    settings = get_settings()
    workers = manager.list_status()
    ready_workers = [w for w in workers if w.get("detector_ready")]
    synthetic_workers = [w for w in workers if w.get("synthetic")]
    unhealthy = [w for w in workers if w.get("alive") and not w.get("detector_ready")]

    anpr_status: dict[str, Any] = {"enabled": settings.anpr_enabled, "ready": False}
    try:
        anpr_status = get_anpr_engine().status()
    except Exception as exc:
        anpr_status = {
            "enabled": settings.anpr_enabled,
            "provider": settings.anpr_ocr_provider,
            "ready": False,
            "error": f"ANPR engine unavailable: {exc}",
        }

    pre = preflight_health()
    counts: dict[str, int] | None = None
    if db is not None:
        try:
            counts = vehicle_intel_service.pipeline_counts(db)
        except Exception as exc:
            logger.debug("ai.status_counts_unavailable", error=str(exc))

    global_status = "READY"
    if not pre.get("ready", False) and not ready_workers:
        global_status = pre.get("status") or "MODEL_NOT_READY"
    elif synthetic_workers and not ready_workers:
        global_status = "SYNTHETIC_FALLBACK"
    elif unhealthy:
        global_status = "DEGRADED"

    return {
        "status": global_status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "device": _resolved_device(pre, workers),
        "model": {
            "ready": bool(pre.get("ready")) or bool(ready_workers),
            "model_loaded": bool(pre.get("model_loaded")) or bool(ready_workers),
            "status": pre.get("status") or ("READY" if ready_workers else "MODEL_NOT_READY"),
            "source": pre.get("model_source"),
            "weights_path": settings.vehicle_model_path,
            "synthetic": bool(pre.get("synthetic")),
            "using_fallback": bool(pre.get("using_fallback")),
            "error": pre.get("model_error"),
            "vehicle_class_ids": pre.get("vehicle_class_ids", []),
        },
        "runtime": {
            "ultralytics_available": bool(pre.get("ultralytics_available")),
            "torch_available": bool(pre.get("torch_available")),
            "import_error": pre.get("import_error"),
            "config": {
                "conf_threshold": settings.vehicle_conf_threshold,
                "iou_threshold": settings.vehicle_iou_threshold,
                "infer_fps": settings.vehicle_infer_fps,
                "infer_imgsz": settings.vehicle_infer_imgsz,
                "classes": settings.vehicle_class_list,
                "allow_synthetic_fallback": settings.vehicle_allow_synthetic_fallback,
            },
        },
        "anpr": anpr_status,
        "workers": {
            "total": len(workers),
            "ready": len(ready_workers),
            "synthetic": len(synthetic_workers),
            "not_ready": len(unhealthy),
            "alive": sum(1 for w in workers if w.get("alive")),
        },
        "counts": counts,
    }


def _resolved_device(pre: dict[str, Any], workers: list[dict[str, Any]]) -> str | None:
    for w in workers:
        det = w.get("detector") or {}
        if det.get("device"):
            return det["device"]
    return pre.get("device")


def publish_ai_status() -> None:
    """Publish one ``ai:status`` realtime frame (low-frequency, bounded)."""
    snapshot = ai_status_snapshot(db=None)
    publish("ai:status", snapshot)
    logger.info(
        "ai.status",
        status=snapshot["status"],
        device=snapshot["device"],
        workers_ready=snapshot["workers"]["ready"],
        workers_total=snapshot["workers"]["total"],
        anpr_ready=bool(snapshot["anpr"].get("ready")),
    )


def _safe_publish_ai_status() -> None:
    try:
        publish_ai_status()
    except Exception:
        logger.exception("ai.status_publish_failed")

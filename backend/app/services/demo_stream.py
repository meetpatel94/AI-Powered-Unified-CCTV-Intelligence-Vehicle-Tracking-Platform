"""Local demo playback feed for ``DEMO-CAM-*`` registry cameras.

Why this module exists
---------------------
The seeded demo cameras (``scripts/seed_demo_data.py``) intentionally carry
non-routable stream URLs on the RFC-2606 reserved host ``demo-cctv.invalid``,
so the FFmpeg stream gateway can never pull frames for them — and browsers
cannot play RTSP directly anyway. Rather than touching the seeded database
rows (which must stay byte-identical), this module resolves demo cameras
**server-side** to one shared, locally-generated synthetic motion feed.

Architecture (production-shaped, offline-capable)
------------------------------------------------
* PostgreSQL still stores only camera metadata/configuration (``cameras`` row
  with its original ``demo-cctv.invalid`` URLs). No video bytes, no files.
* :func:`is_demo_camera` is the single centralized demo-vs-real decision
  point. Real camera ids (Sentinel ``camNN`` fleet, any non ``DEMO-CAM-``
  id) always return ``False`` and keep flowing through the real
  RTSP → FFmpeg → MJPEG/HLS path untouched.
* One daemon producer thread renders synthetic CCTV motion frames (Pillow —
  already a runtime dependency) at a modest frame rate into a single shared
  in-memory JPEG buffer. All 25 demo cameras reuse that buffer through their
  own per-camera logical endpoints (``/api/streams/{id}/frame.jpg`` and
  ``/api/streams/{id}/live``), so there is **no** 25-way FFmpeg fan-out and
  **no** FFmpeg process is ever spawned for a demo camera.
* No gateway worker is created for demo cameras, so the camera-health
  monitor keeps reporting the seeded physical-camera states (LIVE/DEGRADED/
  OFFLINE/…) and demo playability never rewrites ``camera_health_status``.
* No network access is required (loopback-only, no external hosts) and no
  new environment variables or database columns are needed.

The frames are computer-drawn test imagery (moving vehicles, lane markings,
timestamp, frame counter) — clearly labelled ``DEMO`` on the frame itself —
and must never be mistaken for genuine camera evidence.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

#: Registry id prefix marking seeded demo cameras (mirrors
#: ``scripts/seed_demo_data.py::DEMO_CAMERA_PREFIX`` — compared here so the
#: seeder and the database never need to change).
DEMO_CAMERA_PREFIX = "DEMO-CAM-"

#: Render geometry / rate for the shared synthetic feed. Kept small on
#: purpose: JPEG encode of a 640x360 frame is a few milliseconds, so one
#: producer easily serves all demo cameras on modest hardware (incl. Windows
#: laptops without a system FFmpeg).
DEMO_FRAME_WIDTH = 640
DEMO_FRAME_HEIGHT = 360
DEMO_FRAME_FPS = 5.0
DEMO_JPEG_QUALITY = 70

try:  # Pillow is a declared runtime dependency (requirements.txt).
    from PIL import Image, ImageDraw  # type: ignore

    _PIL_OK = True
except Exception:  # pragma: no cover - defensive; endpoints degrade to 404.
    Image = None  # type: ignore
    ImageDraw = None  # type: ignore
    _PIL_OK = False


def is_demo_camera(camera_id: str | None) -> bool:
    """Central demo-vs-real decision: True only for seeded ``DEMO-CAM-*`` ids.

    Real Sentinel cameras (``camNN``) and every other registry id return
    False, preserving the existing real RTSP/WebRTC/HLS resolution path.
    """
    if not camera_id:
        return False
    return str(camera_id).upper().startswith(DEMO_CAMERA_PREFIX)


def pillow_available() -> bool:
    """True when the synthetic frame renderer can run in this environment."""
    return _PIL_OK


def demo_playback_available(camera_id: str | None) -> bool:
    """True when ``camera_id`` can be served by the local demo playback feed.

    This is the backend-owned capability flag surfaced to the frontend as
    ``demo_playback`` on the camera / stream API payloads, so React never
    has to sniff camera ids or hard-code stream URLs itself.
    """
    return is_demo_camera(camera_id) and _PIL_OK


def _draw_demo_frame(frame_no: int, now: datetime) -> bytes:
    """Render one synthetic CCTV motion frame and return JPEG bytes."""
    assert Image is not None and ImageDraw is not None  # guaranteed by caller
    w, h = DEMO_FRAME_WIDTH, DEMO_FRAME_HEIGHT
    t = frame_no / DEMO_FRAME_FPS

    # Night-time asphalt scene.
    img = Image.new("RGB", (w, h), (10, 14, 24))
    draw = ImageDraw.Draw(img)

    # Road band with scrolling lane dashes (motion cue #1).
    road_top = int(h * 0.52)
    draw.rectangle([0, road_top, w, h], fill=(28, 32, 44))
    dash_w, gap = 46, 34
    offset = int((t * 140) % (dash_w + gap))
    for x in range(-dash_w, w + dash_w, dash_w + gap):
        draw.rectangle([x - offset, h - 26, x - offset + dash_w, h - 20], fill=(190, 195, 205))

    # Two synthetic vehicles travelling in opposite directions (motion #2).
    vehicles = [
        {"lane": 0.62, "speed": 95.0, "color": (200, 205, 215), "phase": 0.35},
        {"lane": 0.80, "speed": -130.0, "color": (178, 62, 58), "phase": 0.70},
    ]
    for v in vehicles:
        span = w + 260
        x = int(((t * v["speed"] + v["phase"] * span) % span) - 130)
        y = int(h * v["lane"])
        bw, bh = 150, 62
        draw.rectangle([x, y, x + bw, y + bh], fill=v["color"], outline=(12, 12, 14))
        draw.rectangle([x + 18, y + 8, x + bw - 18, y + 30], fill=(18, 22, 30))  # windshield
        draw.ellipse([x + 22, y + bh - 8, x + 48, y + bh + 16], fill=(8, 8, 10))
        draw.ellipse([x + bw - 48, y + bh - 8, x + bw - 22, y + bh + 16], fill=(8, 8, 10))
        # Synthetic plate patch (not a real registration mark).
        draw.rectangle([x + 45, y + bh - 26, x + 105, y + bh - 8], fill=(235, 238, 242))

    # Timestamp + frame counter (motion #3 — changes every frame).
    stamp = now.strftime("%Y-%m-%d %H:%M:%S UTC")
    draw.rectangle([0, 0, w, 44], fill=(0, 0, 0))
    draw.text((10, 6), stamp, fill=(110, 230, 160))
    draw.text((10, 24), f"FRAME {frame_no:07d}  {DEMO_FRAME_FPS:.0f} FPS", fill=(140, 150, 165))

    # On-frame honesty label — this feed must never look like real evidence.
    label = "DEMO PLAYBACK - SYNTHETIC FEED"
    try:
        label_w = int(draw.textlength(label)) + 16
    except Exception:
        label_w = 300
    draw.rectangle([w - label_w - 8, 8, w - 8, 30], outline=(240, 180, 60))
    draw.text((w - label_w, 12), label, fill=(240, 180, 60))

    # Light sensor-noise dither so consecutive frames are never byte-identical.
    seed = (frame_no * 2654435761) & 0xFFFFFFFF
    for i in range(90):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        px = (seed >> 8) % w
        py = (seed >> 16) % h
        v = 12 + (seed % 20)
        draw.point((px, py), fill=(v, v + 4, v + 10))

    import io

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=DEMO_JPEG_QUALITY, progressive=False)
    return buf.getvalue()


class DemoFeedProducer:
    """Single shared synthetic-frame producer (one thread, one JPEG buffer).

    Started lazily on first demo request and stopped only at process exit.
    Never started per-request/per-camera/per-render: the buffer is simply
    re-read by every demo endpoint.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame: bytes | None = None
        self._frame_no = 0
        self._started_at: float | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # -- lifecycle ---------------------------------------------------- #
    def ensure_started(self) -> bool:
        """Start the background renderer once. Returns False if unavailable."""
        if not _PIL_OK:
            return False
        with self._lock:
            if self._thread and self._thread.is_alive():
                return True
            self._stop.clear()
            self._thread = threading.Thread(
                target=self._run, name="demo-feed-producer", daemon=True
            )
            self._thread.start()
            return True

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    # -- reads -------------------------------------------------------- #
    def latest_frame(self) -> bytes | None:
        with self._lock:
            return self._frame

    def stats(self) -> dict[str, Any]:
        with self._lock:
            alive = bool(self._thread and self._thread.is_alive())
            return {
                "running": alive,
                "frame_count": self._frame_no,
                "frame_bytes": len(self._frame) if self._frame else 0,
                "started_at": (
                    datetime.fromtimestamp(self._started_at, tz=timezone.utc).isoformat()
                    if self._started_at
                    else None
                ),
                "width": DEMO_FRAME_WIDTH,
                "height": DEMO_FRAME_HEIGHT,
                "fps": DEMO_FRAME_FPS,
            }

    # -- internals ---------------------------------------------------- #
    def _run(self) -> None:
        interval = 1.0 / DEMO_FRAME_FPS
        with self._lock:
            self._started_at = time.time()
        logger.info(
            "demo.producer.started",
            width=DEMO_FRAME_WIDTH,
            height=DEMO_FRAME_HEIGHT,
            fps=DEMO_FRAME_FPS,
        )
        while not self._stop.is_set():
            loop_start = time.monotonic()
            try:
                frame_no = self._frame_no + 1
                jpeg = _draw_demo_frame(frame_no, datetime.now(timezone.utc))
            except Exception:
                logger.exception("demo.producer.render_failed")
                if self._stop.wait(interval):
                    break
                continue
            with self._lock:
                self._frame = jpeg
                self._frame_no = frame_no
            elapsed = time.monotonic() - loop_start
            if self._stop.wait(max(0.0, interval - elapsed)):
                break
        logger.info("demo.producer.stopped")


#: Process-wide singleton — one producer no matter how many demo cameras or
#: HTTP connections are active.
producer = DemoFeedProducer()


def get_demo_frame(camera_id: str | None) -> bytes | None:
    """Latest shared demo JPEG for ``camera_id`` (starts producer on demand).

    Returns ``None`` for real cameras or when the renderer is unavailable, so
    callers degrade to their existing 404 / NO STREAM behaviour.
    """
    if not is_demo_camera(camera_id) or not _PIL_OK:
        return None
    if not producer.ensure_started():
        return None
    frame = producer.latest_frame()
    if frame is None:  # first tick not rendered yet — render one synchronously
        try:
            frame = _draw_demo_frame(0, datetime.now(timezone.utc))
        except Exception:
            logger.exception("demo.frame.sync_render_failed")
            return None
    return frame


def demo_stream_status(camera_id: str) -> dict[str, Any]:
    """API-facing playback descriptor for a demo camera (no DB, no worker).

    Mirrors the ``StreamStatus`` payload shape for the fields the frontend
    resolver needs; real stream statistics stay zeroed because no physical
    stream exists — only local demo playback.
    """
    stats = producer.stats()
    return {
        "camera_id": camera_id,
        "state": "OFFLINE",
        "rtsp_configured": True,  # seeded row carries (non-routable) URLs
        "codec": None,
        "width": DEMO_FRAME_WIDTH,
        "height": DEMO_FRAME_HEIGHT,
        "resolution": f"{DEMO_FRAME_WIDTH}x{DEMO_FRAME_HEIGHT}",
        "source_fps": DEMO_FRAME_FPS,
        "measured_fps": DEMO_FRAME_FPS if stats["running"] else 0.0,
        "frame_count": stats["frame_count"],
        "last_pts_ms": None,
        "last_frame_at": None,
        "last_error": None,
        "reconnect_attempt": 0,
        "next_retry_in_s": None,
        "started_at": stats["started_at"],
        "uptime_s": 0.0,
        "jpeg_bytes": stats["frame_bytes"],
        "ai_width": None,
        "ai_height": None,
        "live_frame_path": f"/api/streams/{camera_id}/frame.jpg",
        "live_mjpeg_path": f"/api/streams/{camera_id}/live",
        "transport": "demo",
        "hls_configured": False,
        "availability": "OFFLINE",
        "hls_path": None,
        # Backend-owned capability flag: the frontend shows demo playback
        # (with a DEMO badge) when this is True, without changing the
        # physical-camera health state above.
        "demo_playback": True,
    }

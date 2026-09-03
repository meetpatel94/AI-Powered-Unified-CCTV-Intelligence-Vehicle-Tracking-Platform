"""Per-camera RTSP stream gateway.

Pulls RTSP URLs from the Camera Registry (Sentinel catalogue) — never hard-coded.
FFmpeg over TCP decodes H.264 / H.265 at whatever FPS/resolution the camera
advertises. Latest JPEG is kept in memory for Live View and the next AI stage.
No video files are written to disk.
"""

from __future__ import annotations

import re
import subprocess
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import structlog

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

def _resolve_ffmpeg(configured: str) -> str:
    """Resolve an ffmpeg binary.

    Honour an explicit configured path first. Otherwise prefer a system ``ffmpeg``
    on PATH, and finally fall back to the wheel-bundled binary from
    ``imageio-ffmpeg`` so the gateway works on hosts without a system install.
    """
    import shutil

    if configured and configured != "ffmpeg":
        return configured
    system = shutil.which(configured or "ffmpeg")
    if system:
        return system
    try:  # pragma: no cover - environment dependent
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return configured or "ffmpeg"


_FFMPEG_TIMEOUT_FLAG: str | None = None


def _ffmpeg_timeout_flag(ffmpeg_bin: str) -> str:
    """Return the correct socket-timeout option for this ffmpeg build.

    FFmpeg < 5 uses ``-stimeout`` for RTSP; FFmpeg 5+/7.x renamed it to
    ``-timeout``. Detect once and cache.
    """
    global _FFMPEG_TIMEOUT_FLAG
    if _FFMPEG_TIMEOUT_FLAG is not None:
        return _FFMPEG_TIMEOUT_FLAG
    flag = "-stimeout"
    try:
        out = subprocess.run(
            [ffmpeg_bin, "-hide_banner", "-version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        first = (out.stdout or "").splitlines()[0] if out.stdout else ""
        match = re.search(r"version\s+(\d+)", first)
        major = int(match.group(1)) if match else 0
        if major >= 5:
            flag = "-timeout"
    except Exception:
        flag = "-timeout"
    _FFMPEG_TIMEOUT_FLAG = flag
    return flag


_STREAM_RE = re.compile(r"Stream #0:\d+.+: Video: (\w+).*, (\d+)x(\d+)", re.IGNORECASE)
_FPS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*fps", re.IGNORECASE)
_FATAL_MARKERS = (
    "connection refused",
    "401 unauthorized",
    "404 not found",
    "server returned 4",
    "invalid data found",
    "error opening input",
    "no route to host",
    "timed out",
    "connection timed out",
    "network is unreachable",
)


class StreamState(str, Enum):
    CONNECTING = "CONNECTING"
    LIVE = "LIVE"
    RECONNECTING = "RECONNECTING"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"
    STOPPED = "STOPPED"


@dataclass
class StreamSnapshot:
    camera_id: str
    state: StreamState
    rtsp_configured: bool
    codec: str | None = None
    width: int | None = None
    height: int | None = None
    source_fps: float | None = None
    measured_fps: float = 0.0
    frame_count: int = 0
    last_pts_ms: float | None = None
    last_frame_at: str | None = None
    last_error: str | None = None
    reconnect_attempt: int = 0
    next_retry_in_s: float | None = None
    started_at: str | None = None
    uptime_s: float = 0.0
    jpeg_bytes: int = 0
    ai_width: int | None = None
    ai_height: int | None = None

    def to_dict(self) -> dict[str, Any]:
        data = {
            "camera_id": self.camera_id,
            "state": self.state.value,
            "rtsp_configured": self.rtsp_configured,
            "codec": self.codec,
            "width": self.width,
            "height": self.height,
            "resolution": f"{self.width}x{self.height}" if self.width and self.height else None,
            "source_fps": self.source_fps,
            "measured_fps": round(self.measured_fps, 2),
            "frame_count": self.frame_count,
            "last_pts_ms": self.last_pts_ms,
            "last_frame_at": self.last_frame_at,
            "last_error": self.last_error,
            "reconnect_attempt": self.reconnect_attempt,
            "next_retry_in_s": self.next_retry_in_s,
            "started_at": self.started_at,
            "uptime_s": round(self.uptime_s, 1),
            "jpeg_bytes": self.jpeg_bytes,
            "ai_width": self.ai_width,
            "ai_height": self.ai_height,
            "live_frame_path": f"/api/streams/{self.camera_id}/frame.jpg",
            "live_mjpeg_path": f"/api/streams/{self.camera_id}/live",
        }
        return data


class CameraStreamWorker:
    """One FFmpeg process + reconnect loop per camera."""

    def __init__(self, camera_id: str, rtsp_url: str) -> None:
        self.camera_id = camera_id
        self._rtsp_url = rtsp_url
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._proc: subprocess.Popen[bytes] | None = None
        self.state = StreamState.OFFLINE
        self.codec: str | None = None
        self.width: int | None = None
        self.height: int | None = None
        self.source_fps: float | None = None
        self.measured_fps = 0.0
        self.frame_count = 0
        self.last_pts_ms: float | None = None
        self.last_frame_at: float | None = None
        self.last_error: str | None = None
        self.reconnect_attempt = 0
        self.next_retry_in_s: float | None = None
        self.started_at: float | None = None
        self._jpeg: bytes | None = None
        self._session_start: float | None = None
        self._fps_window: list[float] = []

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            name=f"stream-{self.camera_id}",
            daemon=True,
        )
        self._thread.start()
        logger.info("stream.worker.started", camera_id=self.camera_id)

    def stop(self) -> None:
        self._stop.set()
        self._kill_proc()
        if self._thread:
            self._thread.join(timeout=4)
        with self._lock:
            self.state = StreamState.STOPPED
        logger.info("stream.worker.stopped", camera_id=self.camera_id)

    def update_url(self, rtsp_url: str) -> None:
        self._rtsp_url = rtsp_url

    def latest_jpeg(self) -> bytes | None:
        with self._lock:
            return self._jpeg

    def snapshot(self) -> StreamSnapshot:
        now = time.monotonic()
        with self._lock:
            last_iso = (
                datetime.fromtimestamp(self.last_frame_at, tz=timezone.utc).isoformat()
                if self.last_frame_at
                else None
            )
            started_iso = (
                datetime.fromtimestamp(self.started_at, tz=timezone.utc).isoformat()
                if self.started_at
                else None
            )
            uptime = (now - self._session_start) if self._session_start and self.state == StreamState.LIVE else 0.0
            return StreamSnapshot(
                camera_id=self.camera_id,
                state=self.state,
                rtsp_configured=bool(self._rtsp_url),
                codec=self.codec,
                width=self.width,
                height=self.height,
                source_fps=self.source_fps,
                measured_fps=self.measured_fps,
                frame_count=self.frame_count,
                last_pts_ms=self.last_pts_ms,
                last_frame_at=last_iso,
                last_error=self.last_error,
                reconnect_attempt=self.reconnect_attempt,
                next_retry_in_s=self.next_retry_in_s,
                started_at=started_iso,
                uptime_s=uptime,
                jpeg_bytes=len(self._jpeg) if self._jpeg else 0,
                ai_width=self.width,
                ai_height=self.height,
            )

    def _set_state(self, state: StreamState) -> None:
        with self._lock:
            if self.state != state:
                logger.info(
                    "stream.state",
                    camera_id=self.camera_id,
                    from_state=self.state.value,
                    to_state=state.value,
                )
            self.state = state

    def _kill_proc(self) -> None:
        proc = self._proc
        self._proc = None
        if not proc:
            return
        try:
            proc.kill()
        except OSError:
            pass
        try:
            proc.wait(timeout=2)
        except Exception:
            pass

    def _backoff(self, attempt: int) -> float:
        settings = get_settings()
        delay = settings.stream_backoff_min_seconds * (2 ** max(0, attempt - 1))
        return min(delay, settings.stream_backoff_max_seconds)

    def _run_loop(self) -> None:
        attempt = 0
        while not self._stop.is_set():
            if not self._rtsp_url:
                self.last_error = "No RTSP URL on camera record"
                self._set_state(StreamState.ERROR)
                if self._stop.wait(5):
                    break
                continue
            attempt += 1
            self.reconnect_attempt = attempt
            self._set_state(StreamState.CONNECTING if attempt == 1 else StreamState.RECONNECTING)
            ok = self._pump_once()
            if self._stop.is_set():
                break
            if ok and self.frame_count > 0:
                attempt = 0
                self.reconnect_attempt = 0
            delay = self._backoff(max(attempt, 1))
            self.next_retry_in_s = delay
            self._set_state(StreamState.RECONNECTING)
            logger.warning(
                "stream.reconnect",
                camera_id=self.camera_id,
                attempt=attempt,
                delay_s=delay,
                last_error=self.last_error,
            )
            if self._stop.wait(delay):
                break
        if not self._stop.is_set():
            self._set_state(StreamState.OFFLINE)

    def _build_cmd(self) -> list[str]:
        settings = get_settings()
        ffmpeg_bin = _resolve_ffmpeg(settings.ffmpeg_path)
        timeout_us = int(settings.stream_connect_timeout_seconds * 1_000_000)
        scale = f"scale='min({settings.stream_ai_max_width},iw)':-2"
        return [
            ffmpeg_bin,
            "-hide_banner",
            "-loglevel",
            "warning",
            "-rtsp_transport",
            settings.stream_rtsp_transport,
            _ffmpeg_timeout_flag(ffmpeg_bin),
            str(timeout_us),
            "-fflags",
            "nobuffer+discardcorrupt",
            "-flags",
            "low_delay",
            "-i",
            self._rtsp_url,
            "-an",
            "-vf",
            scale,
            "-f",
            "image2pipe",
            "-vcodec",
            "mjpeg",
            "-q:v",
            str(settings.stream_jpeg_quality),
            "pipe:1",
        ]

    def _pump_once(self) -> bool:
        """Run one FFmpeg session. Returns True if at least one frame was decoded."""
        cmd = self._build_cmd()
        logged_cmd = cmd.copy()
        # Never log the raw RTSP URL (may contain credentials).
        try:
            idx = logged_cmd.index(self._rtsp_url)
            logged_cmd[idx] = f"rtsp://***/{self.camera_id}"
        except ValueError:
            pass
        logger.info("stream.ffmpeg.spawn", camera_id=self.camera_id, cmd=logged_cmd)
        try:
            self._proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
            )
        except FileNotFoundError:
            self.last_error = f"FFmpeg not found at {get_settings().ffmpeg_path}"
            self._set_state(StreamState.ERROR)
            logger.error("stream.ffmpeg.missing", camera_id=self.camera_id)
            return False
        except OSError as exc:
            self.last_error = str(exc)
            self._set_state(StreamState.ERROR)
            return False

        stderr_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        stderr_thread.start()

        got_frame = False
        try:
            got_frame = self._read_jpegs()
        finally:
            self._kill_proc()
            stderr_thread.join(timeout=1)
            with self._lock:
                if self.state == StreamState.LIVE:
                    self.state = StreamState.RECONNECTING
        return got_frame

    def _drain_stderr(self) -> None:
        proc = self._proc
        if not proc or not proc.stderr:
            return
        for raw in iter(proc.stderr.readline, b""):
            if self._stop.is_set():
                break
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            self._parse_probe(line)
            lower = line.lower()
            if any(m in lower for m in _FATAL_MARKERS):
                self.last_error = line[:400]
                logger.warning("stream.ffmpeg.stderr", camera_id=self.camera_id, line=line[:300])
            else:
                # Decoder warnings (missing ref frames, non-monotonous DTS, etc.)
                # are expected on live CCTV and must not tear down the worker.
                logger.debug("stream.ffmpeg.warn", camera_id=self.camera_id, line=line[:300])

    def _parse_probe(self, line: str) -> None:
        match = _STREAM_RE.search(line)
        if match:
            codec, w, h = match.group(1), int(match.group(2)), int(match.group(3))
            with self._lock:
                self.codec = codec.upper()
                if self.codec in {"H264", "AVC"}:
                    self.codec = "H.264"
                elif self.codec in {"HEVC", "H265"}:
                    self.codec = "H.265"
                self.width = w
                self.height = h
            fps_m = _FPS_RE.search(line)
            if fps_m:
                with self._lock:
                    self.source_fps = float(fps_m.group(1))

    def _read_jpegs(self) -> bool:
        proc = self._proc
        if not proc or not proc.stdout:
            return False
        buf = bytearray()
        got = False
        stale = get_settings().stream_stale_seconds
        last_data = time.monotonic()
        soi = b"\xff\xd8"
        eoi = b"\xff\xd9"

        while not self._stop.is_set() and proc.poll() is None:
            chunk = proc.stdout.read(4096)
            now = time.monotonic()
            if not chunk:
                if now - last_data > stale:
                    self.last_error = "Stream stalled (no frames)"
                    break
                time.sleep(0.01)
                continue
            last_data = now
            buf.extend(chunk)
            while True:
                start = buf.find(soi)
                if start < 0:
                    if len(buf) > 1_000_000:
                        del buf[:-2]
                    break
                end = buf.find(eoi, start + 2)
                if end < 0:
                    if start > 0:
                        del buf[:start]
                    break
                jpeg = bytes(buf[start : end + 2])
                del buf[: end + 2]
                self._accept_frame(jpeg)
                got = True
        if proc.poll() not in (None, 0) and not got:
            if not self.last_error:
                self.last_error = f"FFmpeg exited with code {proc.returncode}"
        return got

    def _accept_frame(self, jpeg: bytes) -> None:
        now = time.time()
        mono = time.monotonic()
        with self._lock:
            if self.state in (StreamState.CONNECTING, StreamState.RECONNECTING, StreamState.OFFLINE):
                self.state = StreamState.LIVE
                self._session_start = mono
                self.started_at = now
                self.last_error = None
                logger.info(
                    "stream.live",
                    camera_id=self.camera_id,
                    codec=self.codec,
                    width=self.width,
                    height=self.height,
                )
            self._jpeg = jpeg
            self.frame_count += 1
            self.last_pts_ms = mono * 1000.0
            self.last_frame_at = now
            self._fps_window.append(mono)
            cutoff = mono - 2.0
            self._fps_window = [t for t in self._fps_window if t >= cutoff]
            if len(self._fps_window) >= 2:
                span = self._fps_window[-1] - self._fps_window[0]
                self.measured_fps = (len(self._fps_window) - 1) / span if span > 0 else 0.0


class StreamGateway:
    def __init__(self) -> None:
        self._workers: dict[str, CameraStreamWorker] = {}
        self._lock = threading.Lock()

    def list_snapshots(self) -> list[StreamSnapshot]:
        with self._lock:
            workers = list(self._workers.values())
        return [w.snapshot() for w in workers]

    def get_worker(self, camera_id: str) -> CameraStreamWorker | None:
        with self._lock:
            return self._workers.get(camera_id)

    def start(self, camera_id: str, rtsp_url: str) -> StreamSnapshot:
        if not rtsp_url:
            raise ValueError("Camera has no RTSP URL from the Sentinel catalogue")
        settings = get_settings()
        with self._lock:
            worker = self._workers.get(camera_id)
            if worker is None:
                if len(self._workers) >= settings.stream_max_workers:
                    raise RuntimeError(f"Stream worker limit reached ({settings.stream_max_workers})")
                worker = CameraStreamWorker(camera_id, rtsp_url)
                self._workers[camera_id] = worker
            else:
                worker.update_url(rtsp_url)
        worker.start()
        return worker.snapshot()

    def stop(self, camera_id: str) -> StreamSnapshot | None:
        with self._lock:
            worker = self._workers.get(camera_id)
        if not worker:
            return None
        worker.stop()
        return worker.snapshot()

    def stop_all(self) -> None:
        with self._lock:
            workers = list(self._workers.values())
        for w in workers:
            w.stop()

    def latest_jpeg(self, camera_id: str) -> bytes | None:
        worker = self.get_worker(camera_id)
        return worker.latest_jpeg() if worker else None


gateway = StreamGateway()

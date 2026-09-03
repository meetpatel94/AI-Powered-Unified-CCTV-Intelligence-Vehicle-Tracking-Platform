"""DEVELOPMENT ONLY — synthetic streams, NOT a real government camera feed.

A minimal, real RTSP/RTP server for local end-to-end testing. It serves
computer-generated frames (see ``synth_frames``), not footage from any actual
CCTV camera. Used only to exercise the pipeline offline.

Implements just enough of RFC 2326 (RTSP) + RFC 3984 (RTP H.264) to let FFmpeg
open ``rtsp://host:port/<path>`` over TCP and receive a live H.264 elementary
stream. Frames are rendered on the fly (synthetic vehicles + plates) and encoded
with the bundled FFmpeg, then packetized into RTP and delivered interleaved on
the RTSP TCP connection.

This is DEV-ONLY tooling: it stands in for the Gujarat Police Sentinel cameras
so the Vehicle Intelligence Pipeline can be verified offline. The production app
never imports this module and never learns these URLs except dynamically through
the (mock) Sentinel catalogue.
"""

from __future__ import annotations

import socket
import struct
import subprocess
import threading
import time
from typing import Callable

import imageio_ffmpeg
import numpy as np

from backend.devtools.synth_frames import render_frame  # type: ignore

_SPS_PPS_CACHE: dict[str, bytes] = {}


def _annexb_nalus(data: bytes):
    """Yield NAL units (without start codes) from an Annex-B byte stream."""
    i = 0
    n = len(data)
    starts = []
    while i < n - 3:
        if data[i] == 0 and data[i + 1] == 0:
            if data[i + 2] == 1:
                starts.append((i, 3))
                i += 3
                continue
            if i < n - 4 and data[i + 2] == 0 and data[i + 3] == 1:
                starts.append((i, 4))
                i += 4
                continue
        i += 1
    for idx, (pos, sc) in enumerate(starts):
        begin = pos + sc
        end = starts[idx + 1][0] if idx + 1 < len(starts) else n
        yield data[begin:end]


class _StreamSource:
    """Encodes rendered frames to H.264 Annex-B and buffers NAL units."""

    def __init__(self, path: str, width=640, height=360, fps=15, plate="GJ01AB1234", seed=0):
        self.path = path
        self.width = width
        self.height = height
        self.fps = fps
        self.plate = plate
        self.seed = seed


class RTSPServer:
    """Serves one or more synthetic H.264 streams over RTSP (TCP interleaved)."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8554):
        self.host = host
        self.port = port
        self._sock: socket.socket | None = None
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._streams: dict[str, _StreamSource] = {}

    def add_stream(self, path: str, **kwargs) -> None:
        self._streams[path.lstrip("/")] = _StreamSource(path.lstrip("/"), **kwargs)

    def start(self) -> None:
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind((self.host, self.port))
        self._sock.listen(8)
        self._sock.settimeout(1.0)
        self._thread = threading.Thread(target=self._accept_loop, daemon=True, name="rtsp-accept")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass

    # ------------------------------------------------------------------ #
    def _accept_loop(self) -> None:
        while not self._stop.is_set():
            try:
                conn, addr = self._sock.accept()  # type: ignore[union-attr]
            except socket.timeout:
                continue
            except OSError:
                break
            threading.Thread(
                target=self._handle_client, args=(conn,), daemon=True
            ).start()

    def _handle_client(self, conn: socket.socket) -> None:
        conn.settimeout(30)
        buf = b""
        cseq = 0
        session = "12345678"
        stream_path = None
        playing = False
        try:
            while not self._stop.is_set():
                try:
                    data = conn.recv(4096)
                except socket.timeout:
                    if playing:
                        break
                    continue
                if not data:
                    break
                buf += data
                while b"\r\n\r\n" in buf:
                    header, buf = buf.split(b"\r\n\r\n", 1)
                    lines = header.decode("utf-8", "replace").split("\r\n")
                    if not lines:
                        continue
                    request = lines[0]
                    method = request.split(" ")[0].upper()
                    url = request.split(" ")[1] if len(request.split(" ")) > 1 else ""
                    for ln in lines:
                        if ln.lower().startswith("cseq:"):
                            cseq = int(ln.split(":", 1)[1].strip())
                    path = url.split("://", 1)[-1]
                    path = path.split("/", 1)[-1] if "/" in path else ""
                    path = path.rstrip("/").split("?")[0]
                    if path and path in self._streams:
                        stream_path = path

                    if method == "OPTIONS":
                        self._send(conn, cseq,
                                   extra="Public: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN")
                    elif method == "DESCRIBE":
                        sdp = self._sdp(stream_path or path or "live")
                        self._send(conn, cseq,
                                   content_type="application/sdp", body=sdp)
                    elif method == "SETUP":
                        self._send(conn, cseq,
                                   extra=f"Transport: RTP/AVP/TCP;unicast;interleaved=0-1\r\nSession: {session}")
                    elif method == "PLAY":
                        self._send(conn, cseq, extra=f"Session: {session}")
                        playing = True
                        self._stream_rtp(conn, stream_path or "live")
                        return
                    elif method == "TEARDOWN":
                        self._send(conn, cseq, extra=f"Session: {session}")
                        return
                    else:
                        self._send(conn, cseq)
        except (OSError, ConnectionError):
            pass
        finally:
            try:
                conn.close()
            except OSError:
                pass

    def _send(self, conn, cseq, extra: str = "", content_type: str = "", body: str = ""):
        lines = ["RTSP/1.0 200 OK", f"CSeq: {cseq}"]
        if extra:
            lines.append(extra)
        if body:
            if content_type:
                lines.append(f"Content-Type: {content_type}")
            lines.append(f"Content-Length: {len(body)}")
        msg = "\r\n".join(lines) + "\r\n\r\n" + (body or "")
        conn.sendall(msg.encode("utf-8"))

    def _sdp(self, path: str) -> str:
        return (
            "v=0\r\n"
            "o=- 0 0 IN IP4 127.0.0.1\r\n"
            "s=GP Synthetic Camera\r\n"
            "c=IN IP4 0.0.0.0\r\n"
            "t=0 0\r\n"
            "m=video 0 RTP/AVP 96\r\n"
            "a=rtpmap:96 H264/90000\r\n"
            "a=fmtp:96 packetization-mode=1\r\n"
            f"a=control:{path}\r\n"
        )

    # ------------------------------------------------------------------ #
    def _stream_rtp(self, conn: socket.socket, path: str) -> None:
        src = self._streams.get(path)
        if src is None:
            src = next(iter(self._streams.values()), _StreamSource("live"))

        ff = imageio_ffmpeg.get_ffmpeg_exe()
        proc = subprocess.Popen(
            [
                ff, "-hide_banner", "-loglevel", "error",
                "-f", "rawvideo", "-pix_fmt", "bgr24",
                "-s", f"{src.width}x{src.height}", "-r", str(src.fps),
                "-i", "pipe:0",
                "-c:v", "libx264", "-profile:v", "baseline", "-preset", "ultrafast",
                "-tune", "zerolatency", "-pix_fmt", "yuv420p", "-g", str(src.fps),
                "-bsf:v", "h264_mp4toannexb", "-f", "h264", "pipe:1",
            ],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )

        stop = threading.Event()

        def feed():
            t0 = time.time()
            i = 0
            try:
                while not stop.is_set():
                    t = time.time() - t0
                    frame = render_frame(src.width, src.height, t, src.plate, src.seed)
                    proc.stdin.write(frame.tobytes())
                    i += 1
                    time.sleep(1.0 / src.fps)
            except (BrokenPipeError, OSError):
                pass
            finally:
                try:
                    proc.stdin.close()
                except OSError:
                    pass

        feeder = threading.Thread(target=feed, daemon=True)
        feeder.start()

        seq = 0
        ssrc = 0x13579BDF
        ts = 0
        ts_step = 90000 // src.fps
        buf = b""
        try:
            while not self._stop.is_set():
                chunk = proc.stdout.read(4096)
                if not chunk:
                    break
                buf += chunk
                # Emit complete NAL units as we accumulate; keep a tail buffer.
                # Split on start codes but retain the last (possibly partial) unit.
                units = list(_annexb_nalus(buf))
                if len(units) <= 1:
                    continue
                # keep the last unit in buffer (might be incomplete)
                complete, tail = units[:-1], units[-1]
                # rebuild buffer to hold only the tail with a start code
                buf = b"\x00\x00\x00\x01" + tail
                for nalu in complete:
                    if not nalu:
                        continue
                    seq, ts = self._send_nalu(conn, nalu, seq, ts, ssrc)
                    nal_type = nalu[0] & 0x1F
                    if nal_type in (1, 5):  # advance timestamp on VCL frames
                        ts += ts_step
        except (OSError, ConnectionError):
            pass
        finally:
            stop.set()
            try:
                proc.kill()
            except OSError:
                pass

    def _send_nalu(self, conn, nalu: bytes, seq: int, ts: int, ssrc: int):
        """RTP-packetize one NAL unit (single or FU-A) over TCP interleaved."""
        max_payload = 1400
        if len(nalu) <= max_payload:
            self._send_rtp(conn, nalu, seq, ts, ssrc, marker=True)
            seq = (seq + 1) & 0xFFFF
            return seq, ts
        # FU-A fragmentation
        nal_header = nalu[0]
        nri = nal_header & 0x60
        typ = nal_header & 0x1F
        payload = nalu[1:]
        offset = 0
        first = True
        while offset < len(payload):
            frag = payload[offset : offset + max_payload]
            offset += max_payload
            last = offset >= len(payload)
            fu_indicator = nri | 28  # FU-A type 28
            fu_header = (0x80 if first else 0) | (0x40 if last else 0) | typ
            rtp_payload = bytes([fu_indicator, fu_header]) + frag
            self._send_rtp(conn, rtp_payload, seq, ts, ssrc, marker=last)
            seq = (seq + 1) & 0xFFFF
            first = False
        return seq, ts

    def _send_rtp(self, conn, payload: bytes, seq: int, ts: int, ssrc: int, marker: bool):
        version_flags = 0x80  # version 2
        pt = 96 | (0x80 if marker else 0)
        header = struct.pack("!BBHII", version_flags, pt, seq, ts & 0xFFFFFFFF, ssrc)
        packet = header + payload
        # RTP over TCP interleaved framing: '$' + channel + 2-byte length
        interleaved = b"$" + bytes([0]) + struct.pack("!H", len(packet)) + packet
        conn.sendall(interleaved)

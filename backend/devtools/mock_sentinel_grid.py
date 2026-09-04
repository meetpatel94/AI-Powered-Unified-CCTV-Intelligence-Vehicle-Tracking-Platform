"""DEVELOPMENT ONLY — a local stand-in for the Sentinel CCTV Camera Grid.

NOT a real camera feed. This mirrors the *shape* of the authorized Sentinel
Grid so the integration can be verified end-to-end offline / behind a firewall:

  * ``GET /cameras.json``                       → dynamic camera catalogue
  * ``rtsp://<user>:<pass>@host:8554/stream/camNN`` → synthetic H.264 (TCP)

The production app never imports this module; it only ever learns camera ids
and URLs dynamically from whatever ``SENTINEL_CATALOGUE_URL`` points at.

Run standalone::

    python -m backend.devtools.mock_sentinel_grid
"""

from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from backend.devtools.rtsp_server import RTSPServer

# Ids follow the real grid's cam01..camNN convention. The application must
# discover them from the catalogue — it never assumes this list.
CAMERA_COUNT = 4
PLATES = ["GJ01AB1234", "GJ01AB1234", "GJ05JK6789", "GJ18XY4321"]


def build_catalogue(host: str, count: int = CAMERA_COUNT) -> list[dict]:
    """Catalogue entries carrying only ids (as the real grid may) — the backend
    derives RTSP/HLS/WHEP URLs from its configured templates."""
    return [{"camera_id": f"cam{i:02d}"} for i in range(1, count + 1)]


class _Handler(BaseHTTPRequestHandler):
    catalogue: list[dict] = []

    def do_GET(self):  # noqa: N802
        if self.path.split("?")[0] in ("/cameras.json", "/api/ingest"):
            body = json.dumps({"cameras": self.catalogue}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):  # noqa: N802
        self.do_GET()

    def log_message(self, *args):  # silence
        return


def start_grid(
    catalogue_host: str = "127.0.0.1",
    catalogue_port: int = 8899,
    rtsp_port: int = 8554,
    count: int = CAMERA_COUNT,
):
    """Start the mock catalogue + synthetic RTSP streams at /stream/camNN."""
    rtsp = RTSPServer(host="0.0.0.0", port=rtsp_port)
    for i in range(1, count + 1):
        rtsp.add_stream(
            f"stream/cam{i:02d}",
            plate=PLATES[(i - 1) % len(PLATES)],
            seed=0,
            width=640,
            height=360,
            fps=12,
        )
    rtsp.start()

    _Handler.catalogue = build_catalogue(catalogue_host, count)
    server = HTTPServer((catalogue_host, catalogue_port), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return rtsp, server


if __name__ == "__main__":
    start_grid()
    print("Mock Sentinel Grid catalogue: http://127.0.0.1:8899/cameras.json")
    print("Synthetic RTSP: rtsp://127.0.0.1:8554/stream/cam01 ...")
    while True:
        time.sleep(3600)

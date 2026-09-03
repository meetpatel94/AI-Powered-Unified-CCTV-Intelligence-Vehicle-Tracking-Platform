"""DEVELOPMENT ONLY — NOT a real government feed.

A stand-in Gujarat Police Sentinel ``/api/ingest`` catalogue for local demos.
The camera list and RTSP URLs it serves are fabricated test fixtures. Never
point production at this; production consumes the genuine Sentinel Camera
Registry via ``SENTINEL_BASE_URL``.

Serves a small camera catalogue whose ``rtsp_url`` values point at the local
synthetic RTSP server. The production app ingests this exactly as it would the
real Sentinel service — proving cameras are consumed **dynamically** and no RTSP
URL is hard-coded in the application.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# Ahmedabad / Gandhinagar corridor coordinates so cross-camera distances and
# speed anomaly checks are meaningful.
DEFAULT_CAMERAS = [
    {
        "camera_id": "C-001",
        "department": "Ahmedabad City Police",
        "location_name": "Shahibaug Road, Ahmedabad",
        "latitude": 23.0616,
        "longitude": 72.5900,
        "camera_type": "ANPR",
        "codec": "H.264",
        "resolution": "640x360",
        "status": "online",
        "rtsp_url": "rtsp://127.0.0.1:8554/c001",
    },
    {
        "camera_id": "C-007",
        "department": "Ahmedabad City Police",
        "location_name": "Naranpura Road, Ahmedabad",
        "latitude": 23.0530,
        "longitude": 72.5601,
        "camera_type": "ANPR",
        "codec": "H.264",
        "resolution": "640x360",
        "status": "online",
        "rtsp_url": "rtsp://127.0.0.1:8554/c007",
    },
    {
        "camera_id": "C-015",
        "department": "Gandhinagar Police",
        "location_name": "Kudasan Road, Gandhinagar",
        "latitude": 23.1900,
        "longitude": 72.6350,
        "camera_type": "ANPR",
        "codec": "H.264",
        "resolution": "640x360",
        "status": "online",
        "rtsp_url": "rtsp://127.0.0.1:8554/c015",
    },
]


class _Handler(BaseHTTPRequestHandler):
    cameras = DEFAULT_CAMERAS

    def _respond(self):
        body = json.dumps({"cameras": self.cameras}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/api/ingest"):
            self._respond()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):  # noqa: N802
        self.do_GET()

    def log_message(self, *args):  # silence
        return


def start_mock_sentinel(host="127.0.0.1", port=8899, cameras=None) -> HTTPServer:
    if cameras is not None:
        _Handler.cameras = cameras
    server = HTTPServer((host, port), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server

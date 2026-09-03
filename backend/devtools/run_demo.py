"""End-to-end local demo driver for the Vehicle Intelligence Pipeline.

Starts (in-process):
  * a mock Sentinel ``/api/ingest`` catalogue,
  * a synthetic RTSP server publishing several camera paths,

then leaves them running so the FastAPI backend (pointed at the mock Sentinel)
ingests the cameras, the Stream Gateway pulls RTSP, and the pipeline runs
YOLO → ANPR → tracking → identity → journey against real, local streams.

Run standalone::

    SENTINEL_BASE_URL=http://127.0.0.1:8899 python -m backend.devtools.run_demo
"""

from __future__ import annotations

import time

from backend.devtools.mock_sentinel import start_mock_sentinel
from backend.devtools.rtsp_server import RTSPServer

# Cameras mirror mock_sentinel.DEFAULT_CAMERAS. The SAME plate is published on
# C-001 and C-007 (different locations) so cross-camera journey stitching has a
# genuine multi-camera route to assemble; C-015 carries a different plate.
# seed=0 selects the vehicle appearance the detector recognises most reliably.
CAMERA_STREAMS = [
    ("c001", "GJ01AB1234", 0),
    ("c007", "GJ01AB1234", 0),
    ("c015", "GJ05JK6789", 0),
]


def start_all(rtsp_port: int = 8554, sentinel_port: int = 8899):
    rtsp = RTSPServer(host="0.0.0.0", port=rtsp_port)
    for path, plate, seed in CAMERA_STREAMS:
        rtsp.add_stream(path, plate=plate, seed=seed, width=640, height=360, fps=12)
    rtsp.start()

    sentinel = start_mock_sentinel(host="127.0.0.1", port=sentinel_port)
    return rtsp, sentinel


if __name__ == "__main__":
    rtsp, sentinel = start_all()
    print("Mock Sentinel on :8899, synthetic RTSP on :8554")
    print("Streams:", [c[0] for c in CAMERA_STREAMS])
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        rtsp.stop()

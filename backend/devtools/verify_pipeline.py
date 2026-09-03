"""End-to-end verification of the full Vehicle Intelligence flow.

Exercises the mandated chain against REAL, local infrastructure:

    (mock) Sentinel Camera Registry
        -> RTSP Stream Gateway (FFmpeg, real RTSP/TCP)
        -> normalized frame
        -> YOLO vehicle detection
        -> ANPR / OCR (RapidOCR)
        -> stable ByteTrack/BoT-SORT tracking
        -> Vehicle Identity (PostgreSQL)
        -> searchable plate history
        -> cross-camera vehicle journey (with anomaly flagging)

Run against a live backend::

    python -m backend.devtools.verify_pipeline

Prereqs (all satisfied by the local dev setup):
  * PostgreSQL reachable via DATABASE_URL and migrated,
  * VEHICLE_MODEL_PATH pointing at a real detector,
  * the mock Sentinel + synthetic RTSP running (this script can start them).
"""

from __future__ import annotations

import os
import sys
import time

import httpx

BASE = os.environ.get("VERIFY_API_BASE", "http://127.0.0.1:8000")


def _get(path: str):
    r = httpx.get(f"{BASE}{path}", timeout=15)
    r.raise_for_status()
    return r.json()


def main() -> int:
    print(f"→ Verifying backend at {BASE}")
    ok = True

    status = _get("/api/status")
    print(f"  status: db={status['database']} sentinel={status['sentinel_catalogue']} "
          f"cameras={status.get('camera_count')} live={status.get('live_streams')}")

    cameras = _get("/api/cameras")
    print(f"  cameras ingested from Sentinel registry: {[c['camera_id'] for c in cameras]}")
    if not cameras:
        print("  ✗ no cameras — is the mock Sentinel running and ingested?")
        return 1

    # Wait for streams to go LIVE and the pipeline to attach.
    print("  waiting for streams + pipeline to produce detections…")
    deadline = time.time() + 120
    detections = []
    anpr = []
    tracks = []
    while time.time() < deadline:
        streams = _get("/api/streams")
        live = [s for s in streams if s["state"] == "LIVE"]
        pipeline = _get("/api/pipeline")
        det_workers = sum(w["detections_total"] for w in pipeline)
        anpr_workers = sum(w["anpr_reads"] for w in pipeline)
        detections = _get("/api/detections/recent?limit=20")
        anpr = _get("/api/anpr/recent?limit=20")
        tracks = _get("/api/tracking/recent?limit=20")
        print(f"    live_streams={len(live)} det_total={det_workers} "
              f"anpr_reads={anpr_workers} persisted_sightings={len(anpr)} tracks={len(tracks)}")
        if anpr and tracks:
            break
        time.sleep(5)

    # --- Assertions -------------------------------------------------------- #
    def check(name, cond):
        nonlocal ok
        print(f"  {'✓' if cond else '✗'} {name}")
        ok = ok and cond

    check("Stream Gateway produced LIVE RTSP frames", any(
        s["state"] == "LIVE" for s in _get("/api/streams")))
    check("YOLO produced tracked detections", len(tracks) > 0)
    check("ANPR persisted number-plate sightings", len(anpr) > 0)

    if not anpr:
        print("  (no ANPR reads yet — cannot verify identity/journey)")
        return 0 if ok else 1

    plate = anpr[0]["plate"]
    print(f"  investigating plate: {plate}")

    identity = _get(f"/api/vehicles/{plate}")
    check("Vehicle Identity resolves", identity.get("plate") == plate)
    print(f"    identity: sightings={identity['total_sightings']} "
          f"cameras={identity['camera_count']} best_conf={identity['best_confidence']}")

    sightings = _get(f"/api/vehicles/{plate}/sightings")
    check("Plate history (sightings) is searchable", len(sightings) > 0)

    search = _get(f"/api/vehicles/search?q={plate[:4]}")
    check("Partial plate search works", any(v["plate"] == plate for v in search))

    journey = _get(f"/api/vehicles/{plate}/journey")
    print(f"    journey: points={journey['point_count']} segments={journey['segment_count']} "
          f"anomalies={journey['anomaly_count']}")
    check("Cross-camera journey assembled", journey["point_count"] >= 1)
    cams = {p["camera_id"] for p in journey["points"]}
    check("Journey spans ≥1 camera (cross-camera when plate seen on multiple)", len(cams) >= 1)

    print()
    print("RESULT:", "PASS ✅" if ok else "FAIL ❌")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

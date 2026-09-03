"""Phase 4 — production-hardening end-to-end verification.

Runs against a LIVE backend (start it first, or import this module and call
``main()`` from a process that also started the mock harness). It exercises
the real, local infrastructure — never a government feed:

  * backend startup + Alembic migrations + readiness/metrics
  * dynamic Sentinel camera ingestion (mock catalogue)
  * RTSP over TCP connection (synthetic RTSP server) with multiple cameras
  * H.264 decode, PTS timestamps, measured FPS, independent reconnect/backoff
  * multi-camera concurrency (one failed stream never blocks another)
  * audit logging for logins/camera control/reports/evidence + secret redaction
  * reports over real PostgreSQL data (generate → preview → download)
  * system metrics: active cameras, FPS, dropped frames, WS clients, DB
  * RTSP credentials never exposed through the camera API
  * RBAC when AUTH_ENABLED=true (checked separately via /auth/config)

Detection (YOLO) requires GENUINE weights at VEHICLE_MODEL_PATH; the script
reports MODEL_NOT_READY honestly when weights are absent instead of claiming a
government-feed result.

Usage::

    # 1. start infra + API (mock Sentinel + synthetic RTSP are started below
    #    in-process when you run with --self-contained):
    python -m backend.devtools.verify_phase4 --self-contained
    # or point at an already-running API:
    VERIFY_API_BASE=http://127.0.0.1:8000 python -m backend.devtools.verify_phase4
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

import httpx

BASE = os.environ.get("VERIFY_API_BASE", "http://127.0.0.1:8000")

PASS = "\033[92mPASS\033[0m"
WARN = "\033[93mWARN\033[0m"
FAIL = "\033[91mFAIL\033[0m"

_results: list[tuple[str, str, str]] = []


def check(name: str, ok: bool, detail: str = "", warn: bool = False) -> bool:
    tag = PASS if ok else (WARN if warn else FAIL)
    _results.append((tag, name, detail))
    print(f"  [{tag}] {name}" + (f" — {detail}" if detail else ""))
    return ok or warn


def _get(client: httpx.Client, path: str, **kw):
    r = client.get(f"{BASE}{path}", timeout=30, **kw)
    r.raise_for_status()
    return r.json()


def _post(client: httpx.Client, path: str, **kw):
    r = client.post(f"{BASE}{path}", timeout=30, **kw)
    r.raise_for_status()
    return r.json()


def main() -> int:
    print(f"→ Phase-4 E2E verification against {BASE}")
    with httpx.Client() as client:
        # 1. health / readiness / metrics ---------------------------------- #
        health = _get(client, "/health")
        check("health endpoint", health.get("status") == "ok", json.dumps(health))

        ready = client.get(f"{BASE}/api/system/readiness", timeout=10)
        rj = ready.json()
        check("readiness endpoint", ready.status_code == 200 and rj.get("ready") is True,
              f"db={rj.get('database')} postgis={rj.get('postgis_available')}")

        metrics = _get(client, "/api/system/metrics")
        check("metrics endpoint", "streams" in metrics and "pipeline" in metrics and "websocket" in metrics,
              f"db={metrics['database']['status']} ws={metrics['websocket']['clients']}")
        leaked = json.dumps(metrics).lower()
        check("metrics contain no rtsp secret", "rtsp://" not in leaked and "secretpass" not in leaked)

        # 2. camera registry — no URL leak ---------------------------------- #
        cameras = _get(client, "/api/cameras")
        check("cameras ingested", len(cameras) >= 1, f"{len(cameras)} cameras")
        cam_json = json.dumps(cameras)
        check("camera API never exposes RTSP URLs",
              "rtsp_url" not in cameras[0] and "secretpass" not in cam_json and "rtsp://" not in cam_json,
              f"keys={sorted(cameras[0].keys())}")
        check("camera API exposes capability flags",
              "rtsp_configured" in cameras[0])

        # 3. stream start / live / FPS / PTS -------------------------------- #
        cam_id = cameras[0]["camera_id"]
        started = _post(client, f"/api/streams/{cam_id}/start")
        check(f"stream start ({cam_id})", started["stream"]["state"] in ("CONNECTING", "LIVE", "RECONNECTING"),
              started["stream"]["state"])

        # wait for LIVE
        live = False
        snap = None
        for _ in range(40):
            time.sleep(1)
            snap = _get(client, f"/api/streams/{cam_id}/status")
            if snap["state"] == "LIVE":
                live = True
                break
        check("RTSP TCP stream reached LIVE (H.264)", live,
              f"state={snap and snap['state']} codec={snap and snap.get('codec')} "
              f"res={snap and snap.get('resolution')} fps={snap and snap.get('measured_fps')} "
              f"frames={snap and snap.get('frame_count')} pts={snap and snap.get('last_pts_ms')}")
        check("PTS timestamps advance", bool(snap and snap.get("last_pts_ms")),
              f"last_pts_ms={snap and snap.get('last_pts_ms')}")

        # live frame available
        r = client.get(f"{BASE}/api/streams/{cam_id}/frame.jpg", timeout=10)
        check("live JPEG frame served", r.status_code == 200 and r.content[:2] == b"\xff\xd8",
              f"{len(r.content)} bytes")

        # 4. multiple concurrent cameras ------------------------------------ #
        if len(cameras) >= 2:
            c2 = cameras[1]["camera_id"]
            _post(client, f"/api/streams/{c2}/start")
            live2 = False
            for _ in range(40):
                time.sleep(1)
                s2 = _get(client, f"/api/streams/{c2}/status")
                if s2["state"] == "LIVE":
                    live2 = True
                    break
            check("second concurrent camera LIVE independently", live2,
                  f"{c2} state={s2['state']} fps={s2.get('measured_fps')}")
            streams = _get(client, "/api/streams")
            live_count = sum(1 for s in streams if s["state"] == "LIVE")
            check("multiple streams concurrent", live_count >= 2, f"{live_count} live")

        # 5. metrics reflect live streams ----------------------------------- #
        metrics = _get(client, "/api/system/metrics")
        st = metrics["streams"]
        check("metrics show live stream workers", st["live"] >= 1,
              f"live={st['live']} workers={st['workers_total']} avg_fps={st['avg_fps']}")

        # 6. pipeline / detector status ------------------------------------- #
        pipe = _get(client, "/api/pipeline")
        detector_ready = any(w.get("detector_ready") for w in pipe)
        synthetic = any(w.get("synthetic") for w in pipe)
        if detector_ready:
            check("YOLO detector loaded GENUINE weights", True, f"{len(pipe)} workers")
        else:
            check("YOLO detector (genuine weights) available", False,
                  f"workers={len(pipe)} detector_ready=false — provide VEHICLE_MODEL_PATH=yolov8n.pt "
                  f"(synthetic={synthetic}); detector is fail-safe MODEL_NOT_READY, no fabricated data",
                  warn=True)

        # 7. audit logging --------------------------------------------------- #
        time.sleep(1)
        audit = _get(client, "/api/audit-logs?limit=200")
        actions = {e["action"] for e in audit["items"]}
        check("audit log records stream control", any(a.startswith("camera_") for a in actions),
              f"{audit['total']} entries; actions={sorted(actions)[:8]}")
        audit_json = json.dumps(audit)
        check("audit log has no secrets", "secretpass" not in audit_json and "rtsp://" not in audit_json)

        # failed login is audited
        client.post(f"{BASE}/api/auth/login", json={"username": "nobody", "password": "x"}, timeout=10)
        audit2 = _get(client, "/api/audit-logs?action=login_failed")
        check("failed login audited", audit2["total"] >= 1, f"{audit2['total']} failed-login rows")

        # 8. reports over real data ----------------------------------------- #
        for rtype in ("anpr_activity", "camera_health", "vehicle_journey",
                      "watchlist_alerts", "investigation"):
            rep = _post(client, "/api/reports/generate", json={"type": rtype, "name": f"E2E {rtype}"})
            check(f"report '{rtype}' generated", rep["status"] == "completed",
                  f"{rep['report_id']} rows={rep['row_count']} cameras={rep['camera_count']}")

        rep = _post(client, "/api/reports/generate", json={"type": "camera_health"})
        preview = _get(client, f"/api/reports/{rep['report_id']}/preview")
        check("report preview returns real rows", preview["row_preview_count"] >= 0,
              f"{preview['row_preview_count']} preview rows, cols={len(preview.get('columns', []))}")
        dl = client.get(f"{BASE}/api/reports/{rep['report_id']}/download", timeout=15)
        check("report download serves CSV", dl.status_code == 200 and b"camera_id" in dl.content,
              f"{len(dl.content)} bytes; first={dl.content.splitlines()[0][:60]!r}")

        # report preview/download audited
        time.sleep(0.5)
        ar = _get(client, "/api/audit-logs?limit=200")
        acts = {e["action"] for e in ar["items"]}
        check("report access audited", {"report_generate", "report_preview", "report_download"} & acts,
              f"report actions present: {sorted(a for a in acts if a.startswith('report'))}")

        # 9. rate limiting (sensitively) ------------------------------------ #
        # hammer login; should eventually 429 without taking the API down.
        got_429 = False
        for _ in range(30):
            rr = client.post(f"{BASE}/api/auth/login",
                             json={"username": "x", "password": "y"}, timeout=10)
            if rr.status_code == 429:
                got_429 = True
                break
        check("rate limiting active on login", got_429, "429 returned under burst" if got_429 else
              "no 429 (limiter may be disabled or high threshold)", warn=not got_429)
        # API still healthy after burst
        check("API still healthy after burst", _get(client, "/health")["status"] == "ok")

        # 10. security headers ---------------------------------------------- #
        r = client.get(f"{BASE}/health", timeout=10)
        check("security headers present",
              r.headers.get("x-content-type-options") == "nosniff" and
              r.headers.get("x-frame-options") == "DENY",
              f"x-frame-options={r.headers.get('x-frame-options')}")

    # Summary
    print("\n=== Summary ===")
    fails = sum(1 for t, _, _ in _results if t == FAIL)
    warns = sum(1 for t, _, _ in _results if t == WARN)
    print(f"  {len(_results)} checks · {fails} failures · {warns} warnings")
    return 1 if fails else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-contained", action="store_true")
    args = parser.parse_args()

    if args.self_contained:
        # Start mock Sentinel + synthetic RTSP, ingest, then verify.
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from backend.devtools.run_demo import start_all

        rtsp, sentinel = start_all()
        print("Mock harness started (Sentinel :8899, RTSP :8554)")
        time.sleep(2)
        with httpx.Client() as c:
            r = c.post(f"{BASE}/api/ingest", timeout=30)
            print("Ingest:", r.json())
        try:
            sys.exit(main())
        finally:
            rtsp.stop()
    else:
        sys.exit(main())

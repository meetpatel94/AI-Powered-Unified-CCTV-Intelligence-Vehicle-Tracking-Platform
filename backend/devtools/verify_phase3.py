"""DEVELOPMENT integration check for the Phase-3 operational layer.

Exercises the new modules against a running backend + PostgreSQL:
watchlist, alerts, GIS, camera health, dashboard KPIs, investigation,
evidence and auth/RBAC. All detections fed in here are **clearly labelled
development fixtures** injected through the real service functions (never
fabricated as government data): the pipeline normally produces these records
from genuine RTSP+YOLO+ANPR processing.

Usage:
    DATABASE_URL=... python devtools/verify_phase3.py [api_base]
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
DB_URL = None
PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def req(method: str, path: str, body: dict | None = None, token: str | None = None, raw: bool = False):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = response.read()
            headers = {k.lower(): v for k, v in response.headers.items()}
            if raw:
                return response.status, payload, headers
            return response.status, (json.loads(payload) if payload else None), headers
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        try:
            parsed = json.loads(payload) if payload else None
        except ValueError:
            parsed = payload[:200]
        return exc.code, parsed, {k.lower(): v for k, v in exc.headers.items()}


def get(path: str, token: str | None = None, raw: bool = False):
    return req("GET", path, None, token, raw=raw)


def post(path: str, body: dict | None = None, token: str | None = None):
    return req("POST", path, body, token)


def patch(path: str, body: dict | None = None, token: str | None = None):
    return req("PATCH", path, body, token)


def delete(path: str, token: str | None = None):
    return req("DELETE", path, None, token)


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def main() -> int:
    # ------------------------------------------------------------------ #
    section("0 · service health")
    status, root, _ = get("/")
    check("GET / responds", status == 200 and root.get("service"))
    status, health, _ = get("/health")
    check("GET /health ok", status == 200 and health.get("database") == "connected", str(health))

    # ------------------------------------------------------------------ #
    section("1 · camera registry ingest (mock Sentinel, dev fixtures)")
    status, ingest, _ = post("/api/ingest")
    check("POST /api/ingest upserts catalogue", status == 200 and ingest.get("upserted", 0) >= 3, str(ingest))
    status, cameras, _ = get("/api/cameras")
    check("GET /api/cameras returns registry", status == 200 and len(cameras) >= 3)
    check("registry cameras carry coordinates", all(c["latitude"] is not None for c in cameras))

    # ------------------------------------------------------------------ #
    section("2 · auth (open mode) + roles")
    status, me, _ = get("/api/auth/me")
    check("GET /api/auth/me open-mode admin", status == 200 and me.get("open_mode") is True and me.get("role") == "ADMIN")
    status, roles, _ = get("/api/roles")
    role_ids = {r["id"] for r in roles} if status == 200 else set()
    check(
        "GET /api/roles seeds 5 system roles",
        status == 200 and role_ids == {"ADMIN", "SUPERVISOR", "INVESTIGATOR", "OPERATOR", "VIEWER"},
        str(role_ids),
    )
    admin_perms = next((r for r in roles if r["id"] == "ADMIN"), {}).get("permissions", [])
    viewer_perms = next((r for r in roles if r["id"] == "VIEWER"), {}).get("permissions", [])
    check("ADMIN has watchlist:write", "watchlist:write" in admin_perms)
    check("VIEWER lacks watchlist:write", "watchlist:write" not in viewer_perms)

    # ------------------------------------------------------------------ #
    section("3 · users & roles CRUD (RBAC)")
    status, created, _ = post(
        "/api/users",
        {
            "username": "test.operator",
            "password": "TestPass1234",
            "full_name": "Test Operator",
            "role_id": "OPERATOR",
            "department": "Ahmedabad City Police",
        },
    )
    check("POST /api/users creates operator", status == 201 and created.get("role") == "OPERATOR", str(created))
    check("user response never exposes password hash", "password_hash" not in (created or {}))
    status, users, _ = get("/api/users")
    check("GET /api/users lists users", status == 200 and users.get("total", 0) >= 1)
    status, dup, _ = post(
        "/api/users",
        {"username": "test.operator", "password": "TestPass1234", "full_name": "Dup", "role_id": "VIEWER"},
    )
    check("duplicate username rejected", status == 400, str(dup))
    status, weak, _ = post(
        "/api/users",
        {"username": "weak.pw", "password": "short", "full_name": "Weak", "role_id": "VIEWER"},
    )
    check("weak password rejected (422)", status == 422, str(weak))

    # ------------------------------------------------------------------ #
    section("4 · watchlist CRUD")
    status, entry, _ = post(
        "/api/watchlist",
        {
            "plate": "GJ01AB1234",
            "entry_type": "vehicle",
            "category": "stolen",
            "priority": "critical",
            "description": "DEV TEST ENTRY — silver Swift involved in test case",
            "is_active": True,
        },
    )
    check("POST /api/watchlist creates entry", status == 201 and entry.get("plate") == "GJ01AB1234", str(entry))
    entry_id = entry.get("id")
    status, dup_entry, _ = post("/api/watchlist", {"plate": "gj 01 ab 1234", "category": "wanted", "priority": "high"})
    check("duplicate active plate rejected", status == 400, str(dup_entry))
    status, listed, _ = get("/api/watchlist?is_active=true")
    check("GET /api/watchlist lists entries", status == 200 and listed.get("total") >= 1)
    status, stats, _ = get("/api/watchlist/stats")
    check("GET /api/watchlist/stats", status == 200 and stats.get("active_entries", 0) >= 1)
    status, patched, _ = patch(f"/api/watchlist/{entry_id}", {"priority": "high"})
    check("PATCH /api/watchlist updates priority", status == 200 and patched.get("priority") == "high")

    # ------------------------------------------------------------------ #
    section("5 · genuine ANPR hit → watchlist match → alert → evidence")
    # Inject a DEV-FIXTURE sighting through the real service layer (the pipeline
    # normally does this from live RTSP frames; no RTSP cameras exist in CI).
    sys.path.insert(0, ".")
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.db.session import SessionLocal
    from app.services import alerts as alerts_service
    from app.services import evidence as evidence_service
    from app.services import watchlist as watchlist_service
    from app.services.pipeline import PipelineWorker
    from app.services.vehicle_intel import record_anpr_sighting

    db = SessionLocal()
    now = datetime.now(timezone.utc)
    try:
        result = record_anpr_sighting(
            db,
            plate="GJ01AB1234",
            plate_raw="GJ 01 AB 1234",
            camera_id="C-001",
            seen_at=now,
            ocr_confidence=0.91,
            detection_confidence=0.88,
            vehicle_class="car",
            track_id=7,
            bbox=(120.0, 80.0, 240.0, 160.0),
            pts_ms=12345.0,
        )
        db.commit()
        check("record_anpr_sighting persists (dev fixture)", result is not None)
        worker = PipelineWorker.__new__(PipelineWorker)
        worker.camera_id = "C-001"
        worker.settings = get_settings()
        # Small valid JPEG (1x1) as the "live frame buffer" content.
        tiny_jpeg = bytes.fromhex(
            "ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fca8ffd9"
        )
        worker._process_watchlist(db, result, tiny_jpeg, now)
    finally:
        db.close()

    status, matches, _ = get("/api/watchlist/matches")
    check(
        "exactly one watchlist match created",
        status == 200 and matches.get("total") == 1,
        f"total={matches.get('total') if status == 200 else status}",
    )
    status, alerts_recent, _ = get("/api/alerts/recent")
    items = alerts_recent.get("items", []) if status == 200 else []
    check("watchlist match produced exactly one alert", len(items) == 1, f"count={len(items)}")
    alert = items[0] if items else {}
    check(
        "alert carries required fields",
        all(
            alert.get(k)
            for k in ("alert_id", "type", "severity", "plate", "camera_id", "message", "created_at", "status")
        ),
        str(alert)[:200],
    )
    check("alert status is NEW", alert.get("status") == "NEW")
    check("alert references evidence", bool(alert.get("evidence_id")), str(alert.get("evidence_id")))
    check("alert type WATCHLIST_MATCH", alert.get("type") == "WATCHLIST_MATCH")
    alert_id = alert.get("alert_id")

    # Duplicate suppression: same entry+camera within the window must NOT
    # create a second alert.
    db = SessionLocal()
    try:
        result2 = record_anpr_sighting(
            db,
            plate="GJ01AB1234",
            plate_raw="GJ 01 AB 1234",
            camera_id="C-001",
            seen_at=datetime.now(timezone.utc) + timedelta(seconds=30),
            ocr_confidence=0.9,
            detection_confidence=0.85,
            vehicle_class="car",
            track_id=9,
            bbox=(10, 10, 100, 100),
            pts_ms=20000.0,
        )
        db.commit()
        worker._process_watchlist(db, result2, tiny_jpeg, datetime.now(timezone.utc))
    finally:
        db.close()
    status, alerts_recent2, _ = get("/api/alerts/recent")
    check(
        "duplicate hit suppressed (still one alert)",
        status == 200 and alerts_recent2.get("total") == 1,
        f"total={alerts_recent2.get('total')}",
    )
    status, matches2, _ = get("/api/watchlist/matches")
    check(
        "second sighting still logged as its own match event",
        status == 200 and matches2.get("total") == 2,
        f"total={matches2.get('total')}",
    )

    # ------------------------------------------------------------------ #
    section("6 · alert lifecycle")
    status, acked, _ = post(f"/api/alerts/{alert_id}/acknowledge")
    check("acknowledge → ACKNOWLEDGED", status == 200 and acked.get("status") == "ACKNOWLEDGED", str(acked)[:150])
    status, resolved, _ = post(f"/api/alerts/{alert_id}/resolve", {"note": "Dev test resolution"})
    check("resolve → RESOLVED with note", status == 200 and resolved.get("status") == "RESOLVED" and resolved.get("resolution_note"))
    status, stats, _ = get("/api/alerts/stats")
    check("GET /api/alerts/stats", status == 200 and stats.get("total", 0) >= 1 and stats.get("resolved", 0) >= 1)
    status, missing, _ = post("/api/alerts/ALR-99999999-999999/acknowledge")
    check("unknown alert → 404", status == 404)

    # ------------------------------------------------------------------ #
    section("7 · evidence")
    status, evidence_list, _ = get("/api/evidence")
    check("GET /api/evidence lists snapshots", status == 200 and evidence_list.get("total", 0) >= 1)
    evidence_items = evidence_list.get("items", [])
    first = evidence_items[0] if evidence_items else {}
    check("evidence has sha256 + event ref", bool(first.get("sha256")) and bool(first.get("event_type")))
    evidence_id = first.get("id")
    status, blob, headers = get(f"/api/evidence/{evidence_id}/image", raw=True)
    check("evidence image served as JPEG", status == 200 and headers.get("content-type", "").startswith("image/jpeg"))
    check("sha256 header exposed", bool(headers.get("x-evidence-sha256")))
    status, verify, _ = get(f"/api/evidence/{evidence_id}/verify")
    check("evidence hash verifies", status == 200 and verify.get("match") is True, str(verify))

    # ------------------------------------------------------------------ #
    section("8 · GIS")
    status, geo, _ = get("/api/gis/cameras")
    check(
        "GET /api/gis/cameras GeoJSON",
        status == 200 and geo.get("type") == "FeatureCollection" and geo.get("count", 0) >= 3,
    )
    feature = (geo.get("features") or [{}])[0]
    check("features carry health_state", bool(feature.get("properties", {}).get("health_state")))
    status, nearby, _ = get("/api/gis/nearby?lat=23.0616&lng=72.5900&radius_m=20000")
    check(
        "GET /api/gis/nearby finds cameras with distance",
        status == 200 and nearby.get("count", 0) >= 1 and nearby["cameras"][0].get("distance_m") is not None,
        str(nearby)[:150],
    )
    status, route, _ = get("/api/gis/vehicle/GJ01AB1234/route")
    check(
        "GET /api/gis/vehicle/{plate}/route",
        status == 200 and route.get("point_count", 0) >= 1,
        str(route)[:150],
    )
    status, gis_summary, _ = get("/api/gis/summary")
    check("GET /api/gis/summary", status == 200 and gis_summary.get("geocoded_cameras", 0) >= 3)

    # ------------------------------------------------------------------ #
    section("9 · camera health")
    status, health_list, _ = get("/api/cameras/health")
    check("GET /api/cameras/health", status == 200 and health_list.get("summary", {}).get("total", 0) >= 3)
    states = {item["camera_id"]: item["state"] for item in health_list.get("items", [])}
    check(
        "unmonitored registry cameras are UNKNOWN (never OFFLINE)",
        all(s == "UNKNOWN" for s in states.values()),
        str(states),
    )
    status, one_health, _ = get("/api/cameras/C-001/health")
    check("GET /api/cameras/{id}/health", status == 200 and one_health.get("camera_id") == "C-001")
    status, events, _ = get("/api/cameras/health/events")
    check("GET /api/cameras/health/events", status == 200 and isinstance(events, list))
    status, restart, _ = post("/api/cameras/C-001/stream/restart")
    check("stream restart accepted (RTSP unreachable in CI)", status in (200, 429), str(restart)[:120])

    # ------------------------------------------------------------------ #
    section("10 · dashboard KPIs + analytics")
    status, kpis, _ = get("/api/dashboard/kpis?hours=24")
    check("GET /api/dashboard/kpis", status == 200 and kpis.get("total_cameras", 0) >= 3)
    check("KPIs count the fixture ANPR hit", kpis.get("anpr_hits", 0) >= 2, str(kpis.get("anpr_hits")))
    check("KPIs count unique vehicles", kpis.get("unique_vehicles", 0) >= 1)
    check("KPIs count watchlist matches", kpis.get("watchlist_matches", 0) >= 2)
    check("KPIs count active alerts", kpis.get("active_alerts", 0) >= 0)
    status, activity, _ = get("/api/dashboard/activity?hours=24&bucket=hour")
    check("GET /api/dashboard/activity series", status == 200 and len(activity.get("points", [])) >= 1)
    status, summary, _ = get("/api/analytics/summary?hours=24")
    check("GET /api/analytics/summary", status == 200 and "vehicle_types" in summary and "hourly_histogram" in summary)
    status, journeys, _ = get("/api/dashboard/journeys")
    check("GET /api/dashboard/journeys", status == 200 and isinstance(journeys, list))

    # ------------------------------------------------------------------ #
    section("11 · investigation")
    status, timeline, _ = get("/api/investigation/GJ01AB1234/timeline")
    kinds = [i["kind"] for i in timeline.get("items", [])] if status == 200 else []
    check("timeline returns chronological items", status == 200 and timeline.get("count", 0) >= 3, str(kinds))
    check("timeline includes sightings + matches + alerts", {"sighting", "watchlist_match", "alert"} <= set(kinds))
    ts = [i["timestamp"] for i in timeline.get("items", []) if i.get("timestamp")]
    check("timeline sorted oldest → newest", ts == sorted(ts))
    status, dossier, _ = get("/api/investigation/GJ01AB1234/dossier")
    check("dossier includes watchlist context", status == 200 and dossier.get("watchlist", {}).get("match") is True)
    check("dossier includes sightings + cases", status == 200 and len(dossier.get("sightings", [])) >= 2)
    status, case, _ = post(
        "/api/investigation/cases",
        {
            "subject_plate": "GJ01AB1234",
            "title": "DEV TEST CASE — cross-camera reconstruction",
            "priority": "high",
            "notes": "Development verification case.",
            "evidence_ids": [evidence_id],
        },
    )
    check(
        "case created with GP-CASE number + evidence ref",
        status == 201 and str(case.get("case_number", "")).startswith("GP-CASE-") and evidence_id in case.get("evidence_ids", []),
        str(case)[:200],
    )
    status, cases, _ = get("/api/investigation/cases?plate=GJ01AB1234")
    check("GET /api/investigation/cases", status == 200 and cases.get("total", 0) >= 1)
    status, unknown_plate, _ = post(
        "/api/investigation/cases",
        {"subject_plate": "GJ99ZZ9999", "title": "No such vehicle", "priority": "low"},
    )
    check("case for unknown plate rejected (no fabrication)", status == 404 or status == 400, str(unknown_plate)[:120])
    case_number = case.get("case_number")
    status, closed, _ = patch(f"/api/investigation/cases/{case_number}/status", {"status": "CLOSED"})
    check("case status → CLOSED", status == 200 and closed.get("status") == "CLOSED")

    # ------------------------------------------------------------------ #
    section("12 · WebSocket realtime events")
    try:
        import socket

        s = socket.create_connection(("127.0.0.1", 8000), timeout=5)
        key = "dGhlc2VjcmV0a2V5MTIzNA=="
        handshake = (
            f"GET /api/ws HTTP/1.1\r\nHost: 127.0.0.1:8000\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        s.sendall(handshake.encode())
        s.settimeout(5)
        response = s.recv(4096).decode("utf-8", "replace")
        check("websocket upgrade accepted", "101" in response.split("\r\n")[0], response[:80])
        s.close()
    except Exception as exc:  # noqa: BLE001
        check("websocket upgrade accepted", False, str(exc))

    # ------------------------------------------------------------------ #
    section("13 · cleanup")
    status, _, _ = delete(f"/api/watchlist/{entry_id}")
    check("DELETE /api/watchlist/{id}", status == 200)
    status, listed_after, _ = get("/api/watchlist")
    check("entry removed", status == 200 and all(e["id"] != entry_id for e in listed_after.get("items", [])))

    print(f"\n{'=' * 50}\nRESULT: {PASS} passed, {FAIL} failed\n{'=' * 50}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())

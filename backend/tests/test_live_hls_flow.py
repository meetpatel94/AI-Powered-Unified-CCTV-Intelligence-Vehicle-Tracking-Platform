"""Production live-camera flow: real Sentinel HLS, no demo playback.

Focused tests for the production live-video contract:

* real Sentinel camera ids (``camNN``) resolve to their actual Sentinel HLS
  playlist URL (``https://cctv.corp8.cloud/{camera_id}/index.m3u8``) and are
  exposed to the browser through the credential-free same-origin proxy path;
* the HLS proxy fetches the Sentinel playlist server-side and rewrites its
  segment URIs onto the proxy;
* seeded ``DEMO-CAM-*`` rows are marked (``demo_playback: true``) but never
  served as live playback: no synthetic frame, no MJPEG, no HLS, no
  start-as-demo action.

All network access is stubbed — the real Sentinel origin is never contacted.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services import sentinel_grid
from app.services.cameras import upsert_cameras
from app.services.demo_stream import is_demo_camera
from app.services.stream_gateway import gateway


@pytest.fixture()
def seeded_db(db: Session):
    """Camera Registry holding real Sentinel rows plus one seeded demo row."""
    records = [
        {"camera_id": "cam01", "location": "SG Highway @ Science City Road"},
        {"camera_id": "cam02", "location": "Ashram Road"},
        {
            # Seeded demo row mirrors scripts/seed_demo_data.py: ids and URLs
            # only — the demo marker is derived from the id, never metadata.
            "camera_id": "DEMO-CAM-001",
            "location": "Demo Seed Camera",
            "rtsp_url": "rtsp://demo-cctv.invalid:8554/demo/DEMO-CAM-001",
            "hls_url": "https://demo-cctv.invalid/DEMO-CAM-001/index.m3u8",
        },
    ]
    upsert_cameras(db, records, use_grid=True)
    return db


@pytest.fixture()
def client(seeded_db):
    """TestClient wired to the seeded SQLite session (no lifespan side-effects)."""
    from app.db.session import get_db

    from app.main import app

    def _override():
        yield seeded_db

    app.dependency_overrides[get_db] = _override
    # auth is disabled in tests (conftest) → open mode with implicit admin
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# Sentinel URL resolution (source of truth = catalogue + templates)
# --------------------------------------------------------------------------- #
def test_real_camera_hls_url_uses_sentinel_template():
    """cam01 must resolve to the real Sentinel HLS playlist URL."""
    url = sentinel_grid.build_hls_url("cam01")
    assert url == "https://cctv.corp8.cloud/cam01/index.m3u8"
    assert "@" not in url  # credential-free by construction


def test_every_catalogue_camera_gets_its_own_sentinel_hls_url():
    for camera_id in ("cam01", "cam02", "cam17", "camNN"):
        assert sentinel_grid.build_hls_url(camera_id) == (
            f"https://cctv.corp8.cloud/{camera_id}/index.m3u8"
        )


def test_grid_normalization_fills_hls_url_for_catalogue_records(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("SENTINEL_EMAIL", "officer@example.gov.in")
    monkeypatch.setenv("SENTINEL_PASSWORD", "secret")
    normalized = sentinel_grid.normalize_grid_camera({"camera_id": "cam02"})
    assert normalized is not None
    assert normalized["hls_url"] == "https://cctv.corp8.cloud/cam02/index.m3u8"
    get_settings.cache_clear()


# --------------------------------------------------------------------------- #
# Camera Registry → API projection
# --------------------------------------------------------------------------- #
def test_registry_stores_real_sentinel_hls_url(seeded_db):
    from app.services.cameras import get_camera

    cam = get_camera(seeded_db, "cam01")
    assert cam is not None
    assert cam.hls_url == "https://cctv.corp8.cloud/cam01/index.m3u8"


def test_cameras_api_returns_hls_proxy_path_and_demo_marker(client):
    body = client.get("/api/cameras").json()
    by_id = {c["camera_id"]: c for c in body}

    real = by_id["cam01"]
    assert real["hls_configured"] is True
    assert real["hls_path"] == "/api/streams/cam01/hls/index.m3u8"
    assert real["demo_playback"] is False

    demo = by_id["DEMO-CAM-001"]
    # Marker only — demo rows are identifiable so clients can exclude them.
    assert demo["demo_playback"] is True


# --------------------------------------------------------------------------- #
# Stream API: real cameras
# --------------------------------------------------------------------------- #
def test_stream_status_for_real_camera_advertises_hls_path(client):
    body = client.get("/api/streams/cam01/status").json()
    assert body["camera_id"] == "cam01"
    assert body["hls_configured"] is True
    assert body["hls_path"] == "/api/streams/cam01/hls/index.m3u8"
    assert body["demo_playback"] is False
    # No FFmpeg worker is running for cam01 in tests → honest OFFLINE.
    assert body["state"] == "OFFLINE"
    assert body["availability"] == "OFFLINE"


def test_hls_playlist_proxies_sentinel_and_rewrites_segments(client, monkeypatch):
    sentinel_playlist = (
        "#EXTM3\n"
        "#EXT-X-VERSION:3\n"
        "#EXT-X-TARGETDURATION:6\n"
        "#EXT-X-MEDIA-SEQUENCE:142\n"
        "#EXTINF:6.0,\n"
        "seg142.ts\n"
        "#EXTINF:6.0,\n"
        "https://cctv.corp8.cloud/cam01/seg143.ts\n"
        "#EXT-X-ENDLIST\n"
    ).encode()

    async def _fake_sentinel_get(url):
        assert url == "https://cctv.corp8.cloud/cam01/index.m3u8"
        return sentinel_playlist

    import app.api.streams as streams_api

    monkeypatch.setattr(streams_api, "_sentinel_get", _fake_sentinel_get)

    response = client.get("/api/streams/cam01/hls/index.m3u8")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.apple.mpegurl")
    text = response.text
    # Relative and absolute segment URIs are both rewritten onto the proxy.
    assert "/api/streams/cam01/hls/segment?u=https%3A%2F%2Fcctv.corp8.cloud%2Fcam01%2Fseg142.ts" in text
    assert "/api/streams/cam01/hls/segment?u=https%3A%2F%2Fcctv.corp8.cloud%2Fcam01%2Fseg143.ts" in text
    assert "#EXTM3" in text and "#EXTINF:6.0," in text


def test_hls_playlist_maps_sentinel_unreachable_to_502(client, monkeypatch):
    import httpx

    import app.api.streams as streams_api

    async def _boom(url):
        raise httpx.ConnectError("unreachable")

    monkeypatch.setattr(streams_api, "_sentinel_get", _boom)
    response = client.get("/api/streams/cam01/hls/index.m3u8")
    assert response.status_code == 502


def test_hls_segment_rejects_out_of_origin_urls(client, monkeypatch):
    async def _never(url):
        raise AssertionError("must not be called")

    import app.api.streams as streams_api

    monkeypatch.setattr(streams_api, "_sentinel_get", _never)
    response = client.get(
        "/api/streams/cam01/hls/segment",
        params={"u": "https://evil.example.com/seg.ts"},
    )
    assert response.status_code == 400


# --------------------------------------------------------------------------- #
# Stream API: DEMO-CAM-* never plays on the production live path
# --------------------------------------------------------------------------- #
def test_gateway_latest_jpeg_never_serves_demo_frames():
    """The production frame path returns None for worker-less cameras."""
    assert is_demo_camera("DEMO-CAM-001")
    # Even though the (dev/test-only) demo renderer can produce frames…
    from app.services.demo_stream import get_demo_frame

    if get_demo_frame("DEMO-CAM-001") is not None:  # Pillow present
        # …the production gateway must NOT serve them.
        assert gateway.latest_jpeg("DEMO-CAM-001") is None
    assert gateway.latest_jpeg("cam01") is None  # real, worker-less → None


def test_demo_camera_status_is_offline_marker_not_playback(client):
    body = client.get("/api/streams/DEMO-CAM-001/status").json()
    assert body["demo_playback"] is True  # exclusion marker
    assert body["state"] == "OFFLINE"
    assert body["availability"] == "OFFLINE"
    assert body["measured_fps"] == 0.0
    assert body["transport"] == "rtsp"  # no fake "demo" transport on this path


def test_demo_camera_frame_and_mjpeg_endpoints_404(client):
    assert client.get("/api/streams/DEMO-CAM-001/frame.jpg").status_code == 404
    # Worker-less cameras (including every DEMO-CAM-*) are rejected before
    # any frame is yielded — never a synthetic demo MJPEG stream.
    assert client.get("/api/streams/DEMO-CAM-001/live").status_code == 404


def test_demo_camera_hls_is_never_proxied(client):
    assert client.get("/api/streams/DEMO-CAM-001/hls/index.m3u8").status_code == 404
    response = client.get(
        "/api/streams/DEMO-CAM-001/hls/segment",
        params={"u": "https://demo-cctv.invalid/DEMO-CAM-001/seg.ts"},
    )
    assert response.status_code == 404


def test_demo_camera_start_is_refused_not_faked(client):
    response = client.post("/api/streams/DEMO-CAM-001/start")
    assert response.status_code == 409
    assert "demo" in response.json()["detail"].lower()
    assert gateway.get_worker("DEMO-CAM-001") is None


def test_streams_listing_contains_no_demo_playback_entries(client):
    body = client.get("/api/streams").json()
    by_id = {s["camera_id"]: s for s in body}
    assert set(by_id) == {"cam01", "cam02", "DEMO-CAM-001"}
    demo = by_id["DEMO-CAM-001"]
    assert demo["demo_playback"] is True
    assert demo["state"] == "OFFLINE"
    assert demo["measured_fps"] == 0.0
    for real_id in ("cam01", "cam02"):
        assert by_id[real_id]["demo_playback"] is False
        assert by_id[real_id]["hls_path"] == f"/api/streams/{real_id}/hls/index.m3u8"

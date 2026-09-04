"""Sentinel CCTV Camera Grid integration tests.

Covers the integrator contract: dynamic catalogue (no hard-coded ids), URL
templating with URL-encoded credentials, credential redaction, and the fact
that the API projection never leaks email/password to clients.
"""

from __future__ import annotations

import httpx
import pytest

from app.core.config import get_settings
from app.services import sentinel_grid


@pytest.fixture()
def creds(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("SENTINEL_EMAIL", "officer@gujaratpolice.gov.in")
    monkeypatch.setenv("SENTINEL_PASSWORD", "p@ss:word/1")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_rtsp_url_forces_encoded_credentials(creds):
    url = sentinel_grid.build_rtsp_url("cam01")
    # '@' in the email must be %40 so the userinfo delimiter stays unambiguous.
    assert "officer%40gujaratpolice.gov.in" in url
    assert "p%40ss%3Aword%2F1" in url
    assert url.endswith("/stream/cam01")
    assert url.startswith("rtsp://")


def test_whep_url_encoded(creds):
    url = sentinel_grid.build_webrtc_url("cam07")
    assert "officer%40gujaratpolice.gov.in" in url
    assert url.endswith("/stream/cam07/whep")


def test_hls_url_has_no_credentials(creds):
    url = sentinel_grid.build_hls_url("cam01")
    assert "@" not in url
    assert url.endswith("/cam01/index.m3u8")


def test_missing_credentials_raise(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("SENTINEL_EMAIL", "")
    monkeypatch.setenv("SENTINEL_PASSWORD", "")
    get_settings.cache_clear()
    with pytest.raises(sentinel_grid.SentinelError):
        sentinel_grid.build_rtsp_url("cam01")
    get_settings.cache_clear()


def test_mask_url_redacts_userinfo():
    masked = sentinel_grid.mask_url("rtsp://a%40b.com:secret@1.2.3.4:8554/stream/cam01")
    assert "secret" not in masked
    assert masked == "rtsp://***@1.2.3.4:8554/stream/cam01"


def test_normalize_grid_camera_fills_urls_and_invents_nothing(creds):
    out = sentinel_grid.normalize_grid_camera({"id": "cam03"})
    assert out is not None
    assert out["camera_id"] == "cam03"
    assert out["rtsp_url"].endswith("/stream/cam03")
    assert out["hls_url"].endswith("/cam03/index.m3u8")
    # Never fabricate coordinates or metadata absent from the catalogue.
    assert out["latitude"] is None and out["longitude"] is None
    assert out["location_name"] is None


def test_normalize_keeps_catalogue_supplied_metadata(creds):
    out = sentinel_grid.normalize_grid_camera(
        {"camera_id": "cam09", "location": "Ashram Road", "lat": 23.03, "lng": 72.58}
    )
    assert out["location_name"] == "Ashram Road"
    assert out["latitude"] == pytest.approx(23.03)
    assert out["longitude"] == pytest.approx(72.58)


def test_fetch_grid_catalogue_is_dynamic(creds, monkeypatch):
    """Whatever ids the catalogue returns are used — nothing is hard-coded."""
    payload = {"cameras": [{"id": f"cam{i:02d}"} for i in range(1, 31)]}

    class _Resp:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class _Client:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            return _Resp()

    monkeypatch.setattr(sentinel_grid.httpx, "Client", _Client)
    records = sentinel_grid.fetch_grid_catalogue()
    assert len(records) == 30
    assert {r["id"] for r in records} == {f"cam{i:02d}" for i in range(1, 31)}


def test_fetch_grid_catalogue_network_error(creds, monkeypatch):
    class _Client:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(sentinel_grid.httpx, "Client", _Client)
    with pytest.raises(sentinel_grid.SentinelError):
        sentinel_grid.fetch_grid_catalogue()

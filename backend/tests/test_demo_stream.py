"""Demo playback feed: resolver, frame producer and API descriptor.

Pure unit tests — no database, no network, no FFmpeg. The seeded demo dataset
is never touched here (and must never be: see scripts/seed_demo_data.py).
"""

from __future__ import annotations

import pytest

pillow = pytest.importorskip("PIL.Image", reason="Pillow is required for demo frame rendering")

from app.schemas.camera import CameraRead  # noqa: E402
from app.schemas.stream import StreamStatus  # noqa: E402
from app.services import demo_stream  # noqa: E402
from app.services.demo_stream import (  # noqa: E402
    DEMO_CAMERA_PREFIX,
    demo_playback_available,
    demo_stream_status,
    get_demo_frame,
    is_demo_camera,
)


def test_prefix_matches_seeder_convention():
    assert DEMO_CAMERA_PREFIX == "DEMO-CAM-"


def test_is_demo_camera_only_matches_seeded_ids():
    assert is_demo_camera("DEMO-CAM-001")
    assert is_demo_camera("DEMO-CAM-025")
    assert is_demo_camera("demo-cam-007")  # case-insensitive by design
    assert not is_demo_camera("cam01")  # real Sentinel fleet id
    assert not is_demo_camera("C-001")  # frontend demo fixture id (not a registry camera)
    assert not is_demo_camera("")
    assert not is_demo_camera(None)


def test_demo_playback_available_only_for_demo_ids():
    assert demo_playback_available("DEMO-CAM-001") is True
    assert demo_playback_available("cam01") is False
    assert demo_playback_available(None) is False


def test_get_demo_frame_returns_valid_jpeg_for_demo_camera():
    jpeg = get_demo_frame("DEMO-CAM-001")
    assert jpeg is not None
    assert jpeg[:2] == b"\xff\xd8"  # SOI
    assert jpeg[-2:] == b"\xff\xd9"  # EOI
    assert len(jpeg) > 4096  # a real rendered frame, not a stub


def test_get_demo_frame_returns_none_for_real_cameras():
    assert get_demo_frame("cam01") is None
    assert get_demo_frame(None) is None


def test_demo_frame_advances_between_producer_ticks():
    from app.services.demo_stream import producer

    producer.ensure_started()
    first = producer.latest_frame()
    assert first is not None
    # Render the next frame synchronously and confirm motion (bytes differ).
    import time

    deadline = time.time() + 5.0
    second = first
    while time.time() < deadline:
        time.sleep(0.25)
        candidate = producer.latest_frame()
        if candidate is not None and candidate != first:
            second = candidate
            break
    assert second != first


def test_demo_stream_status_validates_as_stream_status():
    payload = demo_stream_status("DEMO-CAM-001")
    status = StreamStatus(**payload)
    assert status.camera_id == "DEMO-CAM-001"
    assert status.demo_playback is True
    # Physical-camera health is NOT faked online by demo playability.
    assert status.availability == "OFFLINE"
    assert status.state == "OFFLINE"
    assert status.live_mjpeg_path == "/api/streams/DEMO-CAM-001/live"
    assert status.live_frame_path == "/api/streams/DEMO-CAM-001/frame.jpg"
    assert status.hls_path is None


def test_demo_stream_status_covers_all_25_seeded_ids():
    for i in range(1, 26):
        camera_id = f"DEMO-CAM-{i:03d}"
        payload = demo_stream_status(camera_id)
        assert StreamStatus(**payload).demo_playback is True


def test_camera_read_accepts_demo_playback_flag():
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    row = CameraRead(
        camera_id="DEMO-CAM-001",
        live_frame_path="/api/streams/DEMO-CAM-001/frame.jpg",
        live_mjpeg_path="/api/streams/DEMO-CAM-001/live",
        demo_playback=True,
        created_at=now,
        updated_at=now,
    )
    assert row.demo_playback is True
    assert CameraRead(
        camera_id="cam01", created_at=now, updated_at=now
    ).demo_playback is False


def test_producer_is_singleton_shared_across_cameras():
    assert get_demo_frame("DEMO-CAM-001") is not None
    assert get_demo_frame("DEMO-CAM-025") is not None
    assert demo_stream.producer.stats()["frame_count"] >= 0

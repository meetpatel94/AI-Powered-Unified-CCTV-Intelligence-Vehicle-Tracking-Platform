"""Vehicle identity / sightings / journey / cross-camera matching (SQLite)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.camera import Camera
from app.services import vehicle_intel as vi

T0 = datetime(2026, 9, 3, 10, 0, 0, tzinfo=timezone.utc)


def _sighting(
    db,
    *,
    plate="GJ01AB1234",
    camera_id="cam-a",
    seen_at=T0,
    conf=0.90,
    vehicle_class="car",
    track_id=1,
    bbox=(10, 20, 50, 80),
    valid=True,
    uncertain=False,
):
    return vi.record_anpr_sighting(
        db,
        plate=plate,
        plate_raw=plate,
        camera_id=camera_id,
        seen_at=seen_at,
        ocr_confidence=conf,
        detection_confidence=0.8,
        vehicle_class=vehicle_class,
        track_id=track_id,
        bbox=bbox,
        pts_ms=1000.0,
        plate_valid=valid,
        plate_uncertain=uncertain,
    )


def test_reliable_sighting_creates_identity_and_journey(db):
    result = _sighting(db)
    assert result is not None
    assert result["reliable"] is True
    assert result["vehicle_id"] is not None
    assert result["journey"] is not None

    vehicle = vi.get_vehicle(db, "GJ01AB1234")
    assert vehicle is not None
    assert vehicle["plate"] == "GJ01AB1234"
    assert vehicle["total_sightings"] == 1
    assert vehicle["camera_count"] == 1

    sightings = vi.get_vehicle_sightings(db, "gj01ab1234")
    assert len(sightings) == 1
    assert sightings[0]["plate_uncertain"] is False
    assert sightings[0]["source"] == "live_rtsp"


def test_sightings_time_and_camera_filters(db):
    _sighting(db, seen_at=T0, camera_id="cam-a")
    _sighting(db, seen_at=T0 + timedelta(seconds=60), camera_id="cam-b", track_id=2)
    _sighting(db, seen_at=T0 + timedelta(seconds=120), camera_id="cam-c", track_id=3)

    # Note: ANPR dedupe defaults to 20s — the 60/120s gaps avoid it.
    all_rows = vi.get_vehicle_sightings(db, "GJ01AB1234", limit=50)
    assert len(all_rows) == 3

    cam_b = vi.get_vehicle_sightings(db, "GJ01AB1234", camera_id="cam-b")
    assert len(cam_b) == 1 and cam_b[0]["camera_id"] == "cam-b"

    since = vi.get_vehicle_sightings(db, "GJ01AB1234", since=T0 + timedelta(seconds=30))
    assert all(r["seen_at"] >= (T0 + timedelta(seconds=30)).isoformat() for r in since)
    assert len(since) == 2

    until = vi.get_vehicle_sightings(db, "GJ01AB1234", until=T0 + timedelta(seconds=30))
    assert len(until) == 1

    both = vi.get_vehicle_sightings(
        db, "GJ01AB1234",
        since=T0 + timedelta(seconds=30),
        until=T0 + timedelta(seconds=130),
        camera_id="cam-b",
    )
    assert len(both) == 1


def test_search_vehicles_partial_plate(db):
    _sighting(db, plate="GJ01AB1234")
    _sighting(db, plate="MH12DE1433")
    rows = vi.search_vehicles(db, "gJ01")
    assert [r["plate"] for r in rows] == ["GJ01AB1234"]
    assert vi.search_vehicles(db, "ZZZZ") == []


def test_uncertain_sighting_is_persisted_but_not_identity(db):
    result = _sighting(db, plate="ZZZ00000", valid=False, uncertain=True, conf=0.95)
    assert result is not None
    assert result["reliable"] is False
    assert result["journey"] is None
    assert vi.get_vehicle(db, "ZZZ00000") is None
    # Still queryable for evidence/review with the uncertainty marker.
    rows = vi.get_vehicle_sightings(db, "ZZZ00000")
    assert len(rows) == 1
    assert rows[0]["plate_uncertain"] is True


def test_cross_camera_plate_identity_with_constraints(db):
    db.add(Camera(camera_id="cam-a", latitude=23.0, longitude=72.0, location_name="A"))
    db.add(Camera(camera_id="cam-b", latitude=23.01, longitude=72.01, location_name="B"))
    db.add(Camera(camera_id="cam-c", latitude=24.5, longitude=72.0, location_name="C"))
    db.commit()

    _sighting(db, camera_id="cam-a", seen_at=T0, track_id=1)
    _sighting(db, camera_id="cam-b", seen_at=T0 + timedelta(seconds=60), track_id=2)
    _sighting(db, camera_id="cam-c", seen_at=T0 + timedelta(seconds=120), track_id=3)
    db.commit()

    res = vi.match_cross_camera(db, "GJ01AB1234")
    assert res["method"] == "plate_identity"
    assert res["certain"] is True
    assert res["observation_count"] == 3
    assert res["cross_camera_legs"] == 2
    assert res["segment_count"] == 1
    # cam-a→cam-b ≈ 1.47 km in 60 s (≈88 km/h) plausible; cam-b→cam-c
    # ≈ 165 km in 60 s (≈9900 km/h) impossible → flagged, not claimed.
    assert res["implausible_count"] == 1
    legs = [p for p in res["stops"] if p["cross_camera"]]
    assert legs[0]["plausible"] is True
    assert legs[1]["plausible"] is False
    assert "implausible" in (legs[1]["constraint_note"] or "")


def test_cross_camera_metadata_fallback_disabled_by_default(db):
    db.add(Camera(camera_id="cam-a", latitude=23.0, longitude=72.0))
    db.add(Camera(camera_id="cam-b", latitude=23.01, longitude=72.01))
    db.commit()
    _sighting(db, camera_id="cam-a", seen_at=T0)
    _sighting(db, plate="MH12DE1433", camera_id="cam-b", seen_at=T0 + timedelta(seconds=90))
    db.commit()
    # OFF by default → no low-confidence candidates are ever returned.
    candidates = vi.cross_camera_metadata_candidates(
        db,
        vehicle_class="car",
        camera_id="cam-a",
        seen_at=T0,
        exclude_plate="GJ01AB1234",
    )
    assert candidates == []


def test_track_upsert_updates_trajectory(db):
    vi.upsert_track(
        db,
        camera_id="cam-a",
        track_id=42,
        vehicle_class="car",
        seen_at=T0,
        pts_ms=1000.0,
        bbox=(1, 2, 30, 40),
        confidence=0.9,
    )
    vi.upsert_track(
        db,
        camera_id="cam-a",
        track_id=42,
        vehicle_class="car",
        seen_at=T0 + timedelta(seconds=1),
        pts_ms=2000.0,
        bbox=(2, 3, 31, 41),
        confidence=0.88,
        plate="GJ01AB1234",
    )
    db.commit()
    tracks = vi.recent_tracks(db)
    assert len(tracks) == 1
    assert tracks[0]["track_id"] == 42
    assert tracks[0]["frame_count"] == 2
    assert tracks[0]["plate"] == "GJ01AB1234"
    assert len(tracks[0]["trajectory"]) == 2

"""Watchlist matching + real-time alert deduplication (SQLite, deterministic)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.services import alerts as alerts_service
from app.services import watchlist as wl
from app.services.vehicle_intel import record_anpr_sighting

PLATE = "GJ01AB1234"


def _sighting_result(db, *, plate=PLATE, seen_at=None, valid=True, uncertain=False):
    seen_at = seen_at or datetime.now(timezone.utc)
    return record_anpr_sighting(
        db,
        plate=plate,
        plate_raw=plate,
        camera_id="cam-001",
        seen_at=seen_at,
        ocr_confidence=0.90 if valid else 0.98,
        detection_confidence=0.85,
        vehicle_class="car",
        track_id=7,
        bbox=(10, 20, 50, 80),
        pts_ms=1234.5,
        plate_valid=valid,
        plate_uncertain=uncertain,
    )


def test_watchlist_match_exactly_once_per_sighting(db):
    entry = wl.create_entry(db, plate=PLATE, label="Stolen car", category="stolen", priority="high")
    result = _sighting_result(db)
    assert result is not None

    matched = wl.process_anpr_hit(db, result)
    assert matched is not None
    match, got_entry = matched
    assert match.entry_id == entry.id
    assert match.plate == PLATE
    assert got_entry == entry

    # Exactly-once: re-processing the same sighting returns None.
    assert wl.process_anpr_hit(db, result) is None

    # Match stats refreshed.
    db.refresh(entry)
    assert entry.match_count == 1


def test_watchlist_skips_inactive_entry(db):
    wl.create_entry(db, plate=PLATE, label="Not active", category="stolen", is_active=False)
    result = _sighting_result(db)
    assert wl.process_anpr_hit(db, result) is None


def test_watchlist_skips_uncertain_read(db):
    wl.create_entry(db, plate=PLATE, label="Stolen car", category="stolen", priority="high")
    result = _sighting_result(db, valid=False, uncertain=True)
    assert result is not None
    # Reliability contract: uncertain reads never trigger a match/alert.
    assert result["reliable"] is False
    assert wl.process_anpr_hit(db, result) is None


def test_uncertain_read_never_creates_vehicle_identity(db):
    result = _sighting_result(db, plate="ZZZ00000", valid=False, uncertain=True)
    assert result is not None
    assert result["reliable"] is False
    assert result["vehicle_id"] is None
    assert result["journey"] is None

    from app.services import vehicle_intel as vi

    assert vi.get_vehicle(db, "ZZZ00000") is None


def test_watchlist_match_to_alert_and_dedupe(db):
    entry = wl.create_entry(db, plate=PLATE, label="Wanted vehicle", category="wanted", priority="critical")
    result = _sighting_result(db)
    match, _ = wl.process_anpr_hit(db, result)
    assert match is not None

    alert, created = alerts_service.raise_watchlist_alert(db, match, entry=entry)
    assert created is True
    assert alert is not None
    assert alert.alert_id.startswith("ALR-")
    assert alert.type == "WATCHLIST_MATCH"
    assert alert.severity == "critical"
    assert alert.plate == PLATE
    assert alert.camera_id == "cam-001"

    # Same unresolved watchlist+camera within ALERT_DEDUPE_SECONDS → folded.
    alert2, created2 = alerts_service.raise_watchlist_alert(db, match, entry=entry)
    assert created2 is False
    assert alert2 is not None
    assert alert2.id == alert.id


def test_alert_dedupe_window_and_different_source(db):
    now = datetime.now(timezone.utc)
    a, created = alerts_service.create_alert(
        db,
        type="WATCHLIST_MATCH",
        severity="high",
        message="first",
        source_type="watchlist_match",
        dedupe_key="watchlist_match:1:cam-001",
        plate=PLATE,
        camera_id="cam-001",
        suppress_window_seconds=300,
    )
    assert created is True

    # Same unresolved source within window → suppressed (same row).
    a2, created2 = alerts_service.create_alert(
        db,
        type="WATCHLIST_MATCH",
        severity="high",
        message="dup",
        source_type="watchlist_match",
        dedupe_key="watchlist_match:1:cam-001",
        plate=PLATE,
        camera_id="cam-001",
        suppress_window_seconds=300,
    )
    assert created2 is False
    assert a2.id == a.id

    # Different camera → new alert (no cross-source suppression).
    b, created3 = alerts_service.create_alert(
        db,
        type="WATCHLIST_MATCH",
        severity="high",
        message="other camera",
        source_type="watchlist_match",
        dedupe_key="watchlist_match:1:cam-002",
        plate=PLATE,
        camera_id="cam-002",
        suppress_window_seconds=300,
    )
    assert created3 is True
    assert b.id != a.id

    # Outside the window (older unres olved) → new alert.
    old = alerts_service.create_alert(
        db,
        type="WATCHLIST_MATCH",
        severity="medium",
        message="old",
        source_type="watchlist_match",
        dedupe_key="watchlist_match:2:cam-001",
        plate=PLATE,
        camera_id="cam-001",
        suppress_window_seconds=300,
    )[0]
    alerts_service.set_alert_status(db, old, "RESOLVED", actor="tester")
    later = datetime.now(timezone.utc) - timedelta(seconds=400)
    # Simulate a stale unresolved alert outside the window by backdating.
    old.status = "NEW"
    old.created_at = later
    db.commit()
    c, created4 = alerts_service.create_alert(
        db,
        type="WATCHLIST_MATCH",
        severity="medium",
        message="fresh",
        source_type="watchlist_match",
        dedupe_key="watchlist_match:3:cam-001",
        plate=PLATE,
        camera_id="cam-001",
        suppress_window_seconds=300,
    )
    assert created4 is True
    assert c.id != old.id

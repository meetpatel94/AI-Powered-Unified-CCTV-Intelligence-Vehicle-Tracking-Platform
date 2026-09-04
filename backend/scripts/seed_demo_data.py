#!/usr/bin/env python3
"""Deterministic, idempotent DEMO/seed dataset for the PostgreSQL intelligence DB.

WHAT THIS IS
------------
A standalone seeder (never imported by the production runtime) that fills
PostgreSQL — through the project's own SQLAlchemy models, engine and session
configuration (``app.db.session`` / ``app.core.config``) — with a coherent,
relational DEMO dataset covering every dashboard surface:

    cameras → camera health → vehicles → tracks → ANPR sightings → journeys
    → watchlist entries → matches → alerts → evidence → investigation cases
    → audit log → reports

All records are SYNTHETIC and clearly marked as demo data:

    * camera_id            ``DEMO-CAM-001`` … ``DEMO-CAM-025``
    * plates               ``GJ<district>DE<nnnn>``  (the ``DE`` series marks demo)
    * anpr source          ``demo_seed``
    * watchlist created_by ``demo_seed``
    * alert dedupe_key     ``demo_seed:…``
    * case_number          ``GP-CASE-DEMO-…``
    * evidence file_path   ``demo/…`` under EVIDENCE_FRAMES_DIR
    * users                ``demo_admin`` … (created_by ``demo_seed``)
    * audit context        ``{"demo_seed": true}``
    * reports created_by   ``demo_seed``

No real Gujarat Police camera locations, no real people, no real credentials.
Stream URLs point at the RFC-2606 reserved ``*.invalid`` host — they can never
reach a real network. The external Sentinel / CCTV APIs are NEVER contacted by
this script.

HOW TO RUN (from ``backend/``)
------------------------------
    python -m scripts.seed_demo_data          # seed or update (idempotent)
    python -m scripts.seed_demo_data --reset  # delete demo dataset, reseed

The default run is safe to repeat: dimension rows (roles, users, cameras,
vehicles, watchlist entries) are upserted by their natural keys and fact rows
(sightings, tracks, journeys, matches, alerts, evidence, cases, health events,
audit) are only generated when the demo fact dataset does not exist yet —
running twice never duplicates anything. ``--reset`` removes ONLY rows that
carry the demo markers above (plus their generated files) and never touches
production/real records.

Determinism: every value comes from ``random.Random(20260904)`` — the same
dataset (relative to "now") is produced on every run.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import os
import random
import re
import shutil
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Allow `python scripts/seed_demo_data.py` from backend/ (module-style already
# works via `python -m scripts.seed_demo_data`).
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import delete as sa_delete  # noqa: E402
from sqlalchemy import func, inspect as sa_inspect, or_, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.permissions import ROLE_DEFINITIONS, SYSTEM_ROLES  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models import *  # noqa: E402,F401,F403  — register all model metadata
from app.models.alerts import (  # noqa: E402
    ALERT_STATUS_ACKNOWLEDGED,
    ALERT_STATUS_ESCALATED,
    ALERT_STATUS_INVESTIGATING,
    ALERT_STATUS_NEW,
    ALERT_STATUS_RESOLVED,
    ALERT_TYPE_CAMERA_ERROR,
    ALERT_TYPE_CAMERA_OFFLINE,
    ALERT_TYPE_JOURNEY_ANOMALY,
    ALERT_TYPE_WATCHLIST_MATCH,
    Alert,
)
from app.models.audit import (  # noqa: E402
    ACTION_ALERT_ACKNOWLEDGE,
    ACTION_ALERT_RESOLVE,
    ACTION_ALERT_STATUS,
    ACTION_CASE_CREATE,
    ACTION_EVIDENCE_ACCESS,
    ACTION_INVESTIGATION_ACCESS,
    ACTION_LOGIN_SUCCESS,
    ACTION_WATCHLIST_CREATE,
    ACTION_WATCHLIST_UPDATE,
    AuditLog,
)
from app.models.auth import Role, User, UserSession  # noqa: E402
from app.models.camera import Camera  # noqa: E402
from app.models.evidence import EvidenceSnapshot  # noqa: E402
from app.models.health import (  # noqa: E402
    HEALTH_DEGRADED,
    HEALTH_ERROR,
    HEALTH_LIVE,
    HEALTH_OFFLINE,
    HEALTH_RECONNECTING,
    HEALTH_UNKNOWN,
    CameraHealthEvent,
    CameraHealthStatus,
)
from app.models.investigation import (  # noqa: E402
    CASE_STATUS_CLOSED,
    CASE_STATUS_IN_PROGRESS,
    CASE_STATUS_OPEN,
    CaseEvidence,
    InvestigationCase,
)
from app.models.report import (  # noqa: E402
    REPORT_FORMAT_CSV,
    REPORT_STATUS_COMPLETED,
    REPORT_TYPE_ANPR_ACTIVITY,
    REPORT_TYPE_CAMERA_HEALTH,
    REPORT_TYPE_INVESTIGATION,
    REPORT_TYPE_VEHICLE_JOURNEY,
    REPORT_TYPE_WATCHLIST_ALERTS,
    Report,
)
from app.models.vehicle import AnprSighting, JourneyPoint, Vehicle, VehicleTrack  # noqa: E402
from app.models.watchlist import (  # noqa: E402
    CATEGORY_MISSING,
    CATEGORY_OTHERS,
    CATEGORY_STOLEN,
    CATEGORY_SUSPECT,
    CATEGORY_TRAFFIC,
    CATEGORY_WANTED,
    WatchlistEntry,
    WatchlistMatch,
)
from app.services import audit as audit_service  # noqa: E402
from app.services.auth import Principal  # noqa: E402
from app.services.security import hash_password  # noqa: E402
from app.services.vehicle_intel import _haversine_km  # noqa: E402  — identical journey math
from app.vision.plate_utils import normalize_plate  # noqa: E402

# --------------------------------------------------------------------------- #
# Demo markers / constants
# --------------------------------------------------------------------------- #
RNG_SEED = 20260904
DEMO_CAMERA_PREFIX = "DEMO-CAM-"
# anpr_sightings.source — the column exists exactly "so other future feeds can
# be distinguished"; the schema places no restriction on its value.
DEMO_SOURCE = "demo_seed"
DEMO_PLATE_RE = r"^GJ[0-9]{2}DE[0-9]{4}$"
DEMO_CASE_PREFIX = "GP-CASE-DEMO-"
DEMO_ALERT_DEDUPE_PREFIX = "demo_seed:"
DEMO_ALERT_ID_PREFIX = "ALR-DEMO-"
DEMO_EVIDENCE_DIR_PREFIX = "demo/"
DEMO_USER_PREFIX = "demo_"
# LIKE pattern matching demo usernames (the "_" escaped so it is literal).
DEMO_USER_LIKE = "demo\\_%"
DEMO_CREATED_BY = "demo_seed"
DEMO_PASSWORD = "Demo@12345"  # clearly synthetic, documented in scripts/README.md
DEMO_STREAM_HOST = "demo-cctv.invalid"  # RFC-2606 reserved — never resolvable

WINDOW_DAYS = 30            # sightings span the last 30 days
N_VEHICLES = 75
N_LOWCONF_READS = 100       # uncertain: grammar-valid plate, OCR below reliable threshold
N_GARBAGE_READS = 50        # uncertain: grammar-invalid OCR noise
N_WATCHLIST_VEHICLE_ACTIVE = 11
ANPR_DEDUPE_SECONDS = 20.0  # mirrors settings.anpr_dedupe_seconds contract

_ALERT_DEDUPE_WINDOW_S = 300.0  # mirrors ALERT_DEDUPE_SECONDS bucket behaviour

# Watchlist entry priority → alert severity (same map as app.services.alerts).
_PRIORITY_SEVERITY = {"critical": "critical", "high": "high", "medium": "medium", "low": "info"}

# Minimal valid 1×1 JPEG (SOI … EOI). Evidence rows embed a per-record JPEG COM
# segment (tag) so every demo file is byte-unique while remaining a valid JPEG.
_MINI_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikx"
    "MC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01"
    "T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAAR"
    "CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAA"
    "AAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oA"
    "DAMBAAIRAxEAPwCWArQ7/9k="
)
_MINI_JPEG = base64.b64decode(_MINI_JPEG_B64)


class SeedError(RuntimeError):
    """Any fatal seeding/validation problem (transaction is rolled back)."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _mask_url(url: str) -> str:
    return re.sub(r"://[^/@\s]+@", "://***@", url)


def _demo_jpeg(tag: str) -> bytes:
    """A tiny VALID JPEG carrying a unique COM comment — distinct sha256 per
    evidence file, decodable by any image viewer, a few hundred bytes each."""
    payload = f"DEMO-SEED {tag}".encode("utf-8")[:200]
    com = b"\xff\xfe" + (len(payload) + 2).to_bytes(2, "big") + payload
    return _MINI_JPEG[:2] + com + _MINI_JPEG[2:]


# --------------------------------------------------------------------------- #
# Camera network (25 synthetic Gujarat locations — DEMO, not real cameras)
# --------------------------------------------------------------------------- #
CITY_BASE: dict[str, tuple[float, float]] = {
    "Ahmedabad": (23.0225, 72.5714),
    "Gandhinagar": (23.2157, 72.6369),
    "Vadodara": (22.3072, 73.1812),
    "Surat": (21.1702, 72.8311),
    "Rajkot": (22.3039, 70.8022),
    "Bharuch": (21.7051, 72.9931),
    "Anand": (22.5645, 72.9511),
}

ADJACENCY: dict[str, list[str]] = {
    "Ahmedabad": ["Gandhinagar", "Anand", "Vadodara", "Rajkot"],
    "Gandhinagar": ["Ahmedabad"],
    "Vadodara": ["Anand", "Bharuch", "Surat", "Ahmedabad"],
    "Surat": ["Vadodara", "Bharuch", "Rajkot"],
    "Rajkot": ["Ahmedabad", "Surat"],
    "Bharuch": ["Vadodara", "Surat"],
    "Anand": ["Ahmedabad", "Vadodara"],
}

# (city, location, camera_type) — index 0 → DEMO-CAM-001.
CAMERA_SPECS: list[tuple[str, str, str]] = [
    ("Ahmedabad", "SG Highway @ Science City Road", "ANPR"),
    ("Ahmedabad", "Sarkhej-Gandhinagar Highway @ Thaltej Junction", "ANPR"),
    ("Ahmedabad", "Maninagar Railway Crossing", "bullet"),
    ("Ahmedabad", "Navrangpura Circle", "PTZ"),
    ("Ahmedabad", "Kalupur Station Forecourt", "dome"),
    ("Ahmedabad", "Bapunagar Cross Road", "ANPR"),
    ("Ahmedabad", "Vastrapur Lake Road", "bullet"),
    ("Ahmedabad", "Nehru Bridge @ Ashram Road", "ANPR"),
    ("Gandhinagar", "GIFT City Approach Road", "ANPR"),
    ("Gandhinagar", "Mahatma Mandir Circle", "PTZ"),
    ("Gandhinagar", "Sector 22 Crossing", "bullet"),
    ("Gandhinagar", "Akshardham Circle Road", "ANPR"),
    ("Vadodara", "Alkapuri Circle", "PTZ"),
    ("Vadodara", "Fatehgunj Main Road", "ANPR"),
    ("Vadodara", "Manjalpur Cross Road", "bullet"),
    ("Vadodara", "Padra Highway Toll Naka", "ANPR"),
    ("Surat", "Ring Road Textile Market", "ANPR"),
    ("Surat", "Dumas Road Chowkdi", "bullet"),
    ("Surat", "Adajan Patiya Circle", "PTZ"),
    ("Surat", "Sachin GIDC Junction", "ANPR"),
    ("Rajkot", "Kalawad Road Toll Naka", "ANPR"),
    ("Rajkot", "Race Course Ring Road", "bullet"),
    ("Bharuch", "Golden Bridge @ Narmada Crossing", "ANPR"),
    ("Bharuch", "Ankleshwar GIDC Junction", "ANPR"),
    ("Anand", "Anand Town Hall Road", "bullet"),
]

# 1-based camera index → seeded health state (the rest are LIVE).
HEALTH_PLAN: dict[int, str] = {
    4: HEALTH_DEGRADED,
    15: HEALTH_DEGRADED,
    19: HEALTH_DEGRADED,
    8: HEALTH_RECONNECTING,
    21: HEALTH_RECONNECTING,
    13: HEALTH_OFFLINE,
    24: HEALTH_OFFLINE,
    17: HEALTH_ERROR,
    11: HEALTH_UNKNOWN,
    25: HEALTH_UNKNOWN,
}

# Gujarat RTO district codes for the synthetic plates (GJ01 Ahmedabad,
# GJ05 Surat, GJ06 Vadodara, GJ18 Gandhinagar, GJ03 Rajkot, GJ15 Bharuch,
# GJ07 Anand, GJ27 Ahmedabad-East).
DEMO_DISTRICTS = ["01", "05", "06", "18", "03", "15", "07", "27"]

# Vehicles whose plates sit on watchlist / investigation cases (0-based idx).
_WATCHLIST_VEHICLE_IDX = list(range(N_WATCHLIST_VEHICLE_ACTIVE))  # 0..10 → active entries
_INACTIVE_ENTRY_VEHICLE_IDX = 11
_ANOMALY_VEHICLE_IDX = (40, 51, 60)       # scripted impossible-travel journeys
_CASE_VEHICLE_IDX = (0, 2, 1, 4, 40, 9, 7)  # one subject per investigation case


# --------------------------------------------------------------------------- #
# In-memory plan structures
# --------------------------------------------------------------------------- #
@dataclass
class CameraPlan:
    idx: int  # 0-based
    camera_id: str
    city: str
    location_name: str
    latitude: float
    longitude: float
    camera_type: str
    codec: str
    resolution: str
    connectivity: str
    state: str  # seeded health state


@dataclass
class VehiclePlan:
    idx: int
    plate: str
    vehicle_class: str
    row: Vehicle | None = None


@dataclass
class Reading:
    """One planned ANPR read (reliable / low-confidence / garbage)."""

    kind: str  # "reliable" | "lowconf" | "garbage"
    vehicle: VehiclePlan | None
    plate: str  # normalized text that will be persisted
    plate_raw: str
    camera: CameraPlan
    seen_at: datetime
    ocr: float
    det: float
    plate_valid: bool
    vehicle_class: str | None
    bbox: tuple[float, float, float, float]
    pts_ms: float
    row: AnprSighting | None = None
    track_id: int | None = None


@dataclass
class Visit:
    """A vehicle passing one camera — the unit a VehicleTrack represents."""

    vehicle: VehiclePlan | None
    camera: CameraPlan
    readings: list[Reading] = field(default_factory=list)   # reliable reads
    extra: list[Reading] = field(default_factory=list)      # lowconf reads on same track
    track_id: int | None = None
    row: VehicleTrack | None = None


class DedupeGuard:
    """Enforces the pipeline's ANPR dedupe contract while planning: never two
    reads of the same (plate, camera) closer than ``ANPR_DEDUPE_SECONDS``."""

    def __init__(self, rng: random.Random) -> None:
        self._times: dict[tuple[str, str], list[datetime]] = {}
        self._rng = rng

    def place(self, plate: str, camera_id: str, t: datetime) -> datetime:
        key = (plate, camera_id)
        times = self._times.setdefault(key, [])
        for _ in range(12):
            if all(abs((t - x).total_seconds()) >= ANPR_DEDUPE_SECONDS + 0.5 for x in times):
                break
            t = t + timedelta(seconds=ANPR_DEDUPE_SECONDS + self._rng.uniform(1.0, 25.0))
        times.append(t)
        return t


# --------------------------------------------------------------------------- #
# Preflight
# --------------------------------------------------------------------------- #
def preflight() -> None:
    """Verify dialect, connectivity and that migrations have been applied."""
    dialect = engine.dialect.name
    if dialect != "postgresql":
        raise SeedError(
            f"This seeder targets PostgreSQL but DATABASE_URL points at '{dialect}'. "
            "Set DATABASE_URL (or backend/.env) to your PostgreSQL instance."
        )
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except Exception as exc:
        raise SeedError(
            f"Cannot connect to PostgreSQL ({_mask_url(str(engine.url))}): {exc}"
        ) from exc

    existing = set(sa_inspect(engine).get_table_names())
    required = set(Base.metadata.tables.keys())
    missing = sorted(required - existing)
    if missing:
        raise SeedError(
            "Missing table(s): " + ", ".join(missing) + ".\n"
            "Run migrations first:   cd backend && alembic upgrade head"
        )
    print(f"Database:   {_mask_url(str(engine.url))} (PostgreSQL)")
    print(f"Tables:     {len(required)} required tables present")


# --------------------------------------------------------------------------- #
# Purge (scoped strictly to demo-marked rows)
# --------------------------------------------------------------------------- #
def _demo_camera_like() -> str:
    return f"{DEMO_CAMERA_PREFIX}%"


def _remove_file_guarded(path_str: str, root: Path) -> None:
    try:
        p = Path(path_str)
        if p.is_file() and str(p.resolve()).startswith(str(root) + os.sep):
            p.unlink()
    except OSError:
        pass


def purge_demo_data(session: Session) -> dict[str, int]:
    """Delete ONLY demo-marked rows (+ generated files). FK-safe order."""
    settings = get_settings()
    deleted: dict[str, int] = {}

    # Collect generated file paths before their rows disappear.
    report_files = [
        p for p in session.scalars(
            select(Report.file_path).where(Report.created_by == DEMO_CREATED_BY)
        ).all() if p
    ]

    demo_case_ids = select(InvestigationCase.id).where(
        InvestigationCase.case_number.like(f"{DEMO_CASE_PREFIX}%"))
    demo_entry_ids = select(WatchlistEntry.id).where(
        WatchlistEntry.created_by == DEMO_CREATED_BY)
    demo_sighting_ids = select(AnprSighting.id).where(AnprSighting.source == DEMO_SOURCE)
    demo_vehicle_ids = select(Vehicle.id).where(Vehicle.plate.op("~")(DEMO_PLATE_RE))
    demo_user_ids = select(User.id).where(
        User.username.like(DEMO_USER_LIKE, escape="\\"),
        User.created_by == DEMO_CREATED_BY,
    )

    def _del(label: str, stmt) -> None:
        deleted[label] = int(session.execute(stmt).rowcount or 0)

    _del("case_evidence", sa_delete(CaseEvidence).where(
        CaseEvidence.case_id.in_(demo_case_ids)))
    _del("investigation_cases", sa_delete(InvestigationCase).where(
        InvestigationCase.case_number.like(f"{DEMO_CASE_PREFIX}%")))
    _del("watchlist_matches", sa_delete(WatchlistMatch).where(or_(
        WatchlistMatch.entry_id.in_(demo_entry_ids),
        WatchlistMatch.sighting_id.in_(demo_sighting_ids),
    )))
    _del("alerts", sa_delete(Alert).where(
        Alert.dedupe_key.like(f"{DEMO_ALERT_DEDUPE_PREFIX}%")))
    _del("evidence_snapshots", sa_delete(EvidenceSnapshot).where(
        EvidenceSnapshot.file_path.like(f"{DEMO_EVIDENCE_DIR_PREFIX}%")))
    _del("journey_points", sa_delete(JourneyPoint).where(
        JourneyPoint.vehicle_id.in_(demo_vehicle_ids)))
    _del("anpr_sightings", sa_delete(AnprSighting).where(AnprSighting.source == DEMO_SOURCE))
    _del("vehicle_tracks", sa_delete(VehicleTrack).where(
        VehicleTrack.camera_id.like(_demo_camera_like())))
    _del("camera_health_events", sa_delete(CameraHealthEvent).where(
        CameraHealthEvent.camera_id.like(_demo_camera_like())))
    _del("camera_health_status", sa_delete(CameraHealthStatus).where(
        CameraHealthStatus.camera_id.like(_demo_camera_like())))
    _del("vehicles", sa_delete(Vehicle).where(Vehicle.plate.op("~")(DEMO_PLATE_RE)))
    _del("watchlist_entries", sa_delete(WatchlistEntry).where(
        WatchlistEntry.created_by == DEMO_CREATED_BY))
    _del("audit_logs", sa_delete(AuditLog).where(or_(
        func.json_extract_path_text(AuditLog.context, "demo_seed") == "true",
        AuditLog.username.like(DEMO_USER_LIKE, escape="\\"),
    )))
    _del("reports", sa_delete(Report).where(Report.created_by == DEMO_CREATED_BY))
    _del("user_sessions", sa_delete(UserSession).where(
        UserSession.user_id.in_(demo_user_ids)))
    _del("users", sa_delete(User).where(
        User.username.like(DEMO_USER_LIKE, escape="\\"),
        User.created_by == DEMO_CREATED_BY,
    ))
    _del("cameras", sa_delete(Camera).where(Camera.camera_id.like(_demo_camera_like())))
    session.commit()

    # Remove generated files (guarded so we never escape the configured dirs).
    ev_root = Path(settings.evidence_frames_dir).resolve()
    demo_ev_root = ev_root / "demo"
    if demo_ev_root.is_dir() and str(demo_ev_root).startswith(str(ev_root) + os.sep):
        shutil.rmtree(demo_ev_root, ignore_errors=True)
    rep_root = Path(settings.reports_dir).resolve()
    for rel in report_files:
        _remove_file_guarded(rel, rep_root)
    return deleted


def demo_facts_exist(session: Session) -> bool:
    n = session.scalar(
        select(func.count()).select_from(AnprSighting).where(AnprSighting.source == DEMO_SOURCE)
    )
    return int(n or 0) > 0


# --------------------------------------------------------------------------- #
# Plan builders (pure + deterministic — no DB access)
# --------------------------------------------------------------------------- #
def build_camera_plans(rng: random.Random) -> list[CameraPlan]:
    plans: list[CameraPlan] = []
    codecs = ["H.265", "H.264", "H.264", "H.265", "H.264"]
    resolutions = ["1920x1080", "2560x1440", "1920x1080", "1280x720", "1920x1080"]
    conns = ["fiber", "fiber", "4G-LTE", "broadband", "fiber"]
    for i, (city, loc, cam_type) in enumerate(CAMERA_SPECS):
        base_lat, base_lon = CITY_BASE[city]
        plans.append(
            CameraPlan(
                idx=i,
                camera_id=f"{DEMO_CAMERA_PREFIX}{i + 1:03d}",
                city=city,
                location_name=f"{loc}, {city} (DEMO)",
                latitude=round(base_lat + rng.uniform(-0.02, 0.02), 6),
                longitude=round(base_lon + rng.uniform(-0.02, 0.02), 6),
                camera_type=cam_type,
                codec=codecs[i % len(codecs)],
                resolution=resolutions[i % len(resolutions)],
                connectivity=conns[i % len(conns)],
                state=HEALTH_PLAN.get(i + 1, HEALTH_LIVE),
            )
        )
    return plans


def build_vehicle_plans(rng: random.Random) -> list[VehiclePlan]:
    classes = rng.choices(
        ["car", "motorcycle", "bus", "truck"], weights=[58, 20, 10, 12], k=N_VEHICLES
    )
    plans: list[VehiclePlan] = []
    for n in range(1, N_VEHICLES + 1):
        district = DEMO_DISTRICTS[(n - 1) % len(DEMO_DISTRICTS)]
        plate = f"GJ{district}DE{n:04d}"
        plans.append(VehiclePlan(idx=n - 1, plate=plate, vehicle_class=classes[n - 1]))
    return plans


def _rand_time(rng: random.Random, now: datetime) -> datetime:
    """Weighted timestamp in the last 30 days; ~40 % inside the last 24 h so
    the dashboard's default 24-hour window always has activity."""
    r = rng.random()
    if r < 0.40:
        back_h = rng.uniform(0.5, 24)
    elif r < 0.70:
        back_h = rng.uniform(24, 24 * 7)
    else:
        back_h = rng.uniform(24 * 7, 24 * WINDOW_DAYS)
    return now - timedelta(hours=back_h)


def _plate_raw_style(rng: random.Random, plate: str) -> str:
    style = rng.random()
    if style < 0.55:
        return plate
    if style < 0.75:
        return f"{plate[:2]} {plate[2:4]} {plate[4:6]} {plate[6:]}"
    if style < 0.90:
        return f"{plate[:4]}-{plate[4:]}"
    return f"IND {plate}"


def _rand_bbox(rng: random.Random) -> tuple[float, float, float, float]:
    x = rng.uniform(60, 900)
    y = rng.uniform(110, 500)
    w = min(rng.uniform(140, 420), 1280.0 - x)
    h = min(rng.uniform(90, 280), 720.0 - y)
    return round(x, 1), round(y, 1), round(max(20.0, w), 1), round(max(20.0, h), 1)


def plan_activity(
    rng: random.Random,
    now: datetime,
    settings,
    cameras: list[CameraPlan],
    vehicles: list[VehiclePlan],
) -> tuple[list[Visit], list[Reading], list[Reading], list[Reading]]:
    """Plan visits (→ tracks), reliable reads, low-confidence reads and garbage
    reads. Returns (visits, reliable, lowconf, garbage).

    Travel times derive from haversine distances between the camera coordinates
    and plausible speeds, so journey speed/anomaly math is physically coherent.
    Trip start times are pulled back so every generated timestamp is in the
    past, and the pipeline's 20 s (plate, camera) dedupe contract is honoured.
    """
    reliable_thr = float(settings.anpr_reliable_confidence)
    min_ocr = float(settings.anpr_min_ocr_confidence)
    guard = DedupeGuard(rng)

    by_city: dict[str, list[CameraPlan]] = {}
    for cam in cameras:
        by_city.setdefault(cam.city, []).append(cam)
    cities = sorted(by_city)
    city_weights = [len(by_city[c]) for c in cities]

    visits: list[Visit] = []
    reliable: list[Reading] = []

    def make_reliable(v: VehiclePlan, cam: CameraPlan, t: datetime, pts_base: float) -> Reading:
        ocr = round(rng.uniform(max(0.76, reliable_thr + 0.01), 0.995), 4)
        det = round(rng.uniform(0.45, 0.95), 4)
        raw = _plate_raw_style(rng, v.plate)
        norm, valid = normalize_plate(raw)
        if not (valid and norm == v.plate and ocr >= reliable_thr):  # pragma: no cover
            raise SeedError(f"planned reliable read failed normalization: {raw!r} → {norm!r}")
        t = guard.place(v.plate, cam.camera_id, t)
        return Reading(
            kind="reliable", vehicle=v, plate=v.plate, plate_raw=raw, camera=cam,
            seen_at=t, ocr=ocr, det=det, plate_valid=True, vehicle_class=v.vehicle_class,
            bbox=_rand_bbox(rng), pts_ms=round(max(0.0, pts_base), 1),
        )

    for v in vehicles:
        if v.idx in _WATCHLIST_VEHICLE_IDX:
            cap = rng.randint(3, 6)   # watchlist subjects: fewer reads → 20-50 matches
        else:
            cap = rng.randint(7, 18)
        trip_count = rng.randint(1, 2) if cap <= 6 else rng.randint(1, 3)
        remaining = cap
        for _ in range(trip_count):
            if remaining <= 0:
                break
            # --- precompute the route (cameras + inter-camera gaps) -------- #
            route: list[CameraPlan] = []
            gaps: list[float] = []
            city = rng.choices(cities, weights=city_weights)[0]
            route_len = max(1, min(remaining, rng.randint(2, 5)))
            prev_cam: CameraPlan | None = None
            for _step in range(route_len):
                if prev_cam is None:
                    cam = rng.choice(by_city[city])
                else:
                    if rng.random() < 0.72:
                        options = [c for c in by_city[city] if c is not prev_cam] or by_city[city]
                        cam = rng.choice(options)
                        gap = rng.uniform(300, 900)
                    else:
                        nxt = rng.choice(ADJACENCY[prev_cam.city])
                        city = nxt
                        cam = rng.choice(by_city[nxt])
                        dist = _haversine_km(prev_cam.latitude, prev_cam.longitude,
                                             cam.latitude, cam.longitude) or 2.0
                        speed = rng.uniform(45, 80)
                        gap = dist / speed * 3600.0 * rng.uniform(1.15, 1.55) + rng.uniform(60, 240)
                    gaps.append(max(120.0, gap))
                route.append(cam)
                prev_cam = cam
            # Worst-case dwell inside the route (3 reads × 240 s + slack).
            dwell_worst = len(route) * 840.0
            span = sum(gaps) + dwell_worst
            t0 = min(_rand_time(rng, now), now - timedelta(seconds=span + rng.uniform(300, 3600)))

            # --- walk the route, laying down visits + reads ----------------- #
            t = t0
            for step, cam in enumerate(route):
                if remaining <= 0:
                    break
                if step:
                    t = t + timedelta(seconds=gaps[step - 1])
                n_reads = 1
                if remaining >= 2 and rng.random() < 0.35:
                    n_reads = 2 if rng.random() < 0.8 else 3
                n_reads = min(n_reads, remaining)

                visit = Visit(vehicle=v, camera=cam)
                pts_base = rng.uniform(0, 7_200_000)
                tr = t
                for k in range(n_reads):
                    if k:
                        tr = tr + timedelta(seconds=rng.uniform(25, 240))  # > 20 s dedupe
                    r = make_reliable(v, cam, tr, pts_base + k * rng.uniform(900, 3200))
                    tr = r.seen_at
                    visit.readings.append(r)
                    reliable.append(r)
                    remaining -= 1
                visits.append(visit)
                t = tr + timedelta(seconds=rng.uniform(30, 120))

    # --- scripted impossible-travel anomalies (→ JOURNEY_ANOMALY alerts) --- #
    anomaly_pairs = [("Ahmedabad", "Surat"), ("Vadodara", "Rajkot"), ("Surat", "Ahmedabad")]
    for j, vidx in enumerate(_ANOMALY_VEHICLE_IDX):
        v = vehicles[vidx]
        city_a, city_b = anomaly_pairs[j % len(anomaly_pairs)]
        cam_a = rng.choice(by_city[city_a])
        cam_b = rng.choice([c for c in by_city[city_b] if c is not cam_a])
        t0 = min(_rand_time(rng, now - timedelta(days=2)), now - timedelta(hours=6))
        pts = rng.uniform(0, 7_200_000)
        va = Visit(vehicle=v, camera=cam_a)
        ra = make_reliable(v, cam_a, t0, pts)
        va.readings.append(ra)
        # Impossible leg: ~100-250 km covered in 45-110 seconds.
        gap = rng.uniform(45, 110)
        vb = Visit(vehicle=v, camera=cam_b)
        rb = make_reliable(v, cam_b, ra.seen_at + timedelta(seconds=gap), pts + gap * 1000)
        vb.readings.append(rb)
        visits.extend([va, vb])
        reliable.extend([ra, rb])

    # --- low-confidence (uncertain) reads attached to existing visits ------ #
    lowconf: list[Reading] = []
    upper = min(0.74, reliable_thr - 0.01)
    lower = max(0.42, min_ocr + 0.01)
    for visit in rng.sample(visits, min(N_LOWCONF_READS, len(visits))):
        if visit.vehicle is None:
            continue
        anchor = max(visit.readings, key=lambda r: r.seen_at)
        t = guard.place(
            visit.vehicle.plate, visit.camera.camera_id,
            anchor.seen_at + timedelta(seconds=rng.uniform(30, 180)),
        )
        ocr = round(rng.uniform(lower, upper), 4)
        raw = _plate_raw_style(rng, visit.vehicle.plate)
        norm, valid = normalize_plate(raw)
        lowconf.append(Reading(
            kind="lowconf", vehicle=visit.vehicle, plate=norm or visit.vehicle.plate,
            plate_raw=raw, camera=visit.camera, seen_at=t, ocr=ocr,
            det=round(rng.uniform(0.35, 0.8), 4), plate_valid=bool(valid),
            vehicle_class=visit.vehicle.vehicle_class,
            bbox=_rand_bbox(rng), pts_ms=round(max(0.0, anchor.pts_ms + rng.uniform(2000, 9000)), 1),
        ))
        visit.extra.append(lowconf[-1])

    # --- garbage OCR-noise reads (grammar-invalid, no vehicle) -------------- #
    garbage: list[Reading] = []
    def mutate(p: str) -> str:
        kind = rng.randrange(4)
        if kind == 0:
            return p + rng.choice("AXZQ")                    # trailing letter → invalid
        if kind == 1:
            return p[:2] + rng.choice("OIQ") + p[3:]          # letter inside district digits
        if kind == 2:
            return p[:4] + rng.choice("B8G") + p[5:]          # confusion char in the series
        return p[:6] + rng.choice("OLZ") + p[7:]              # confusion char in the number

    for _ in range(N_GARBAGE_READS):
        cam = rng.choice(cameras)
        t = _rand_time(rng, now)
        mutated = mutate(rng.choice(vehicles).plate)
        raw = f"{mutated[:4]} {mutated[4:]}" if rng.random() < 0.5 else mutated
        norm, valid = normalize_plate(raw)
        plate = (norm or mutated)[:16]
        ocr = round(rng.uniform(max(0.40, min_ocr + 0.005), min(0.73, reliable_thr - 0.02)), 4)
        t = guard.place(plate, cam.camera_id, t)
        garbage.append(Reading(
            kind="garbage", vehicle=None, plate=plate, plate_raw=raw, camera=cam,
            seen_at=t, ocr=ocr, det=round(rng.uniform(0.36, 0.85), 4),
            plate_valid=bool(valid), vehicle_class=rng.choice(["car", "motorcycle", "truck"]),
            bbox=_rand_bbox(rng), pts_ms=round(rng.uniform(0, 7_200_000), 1),
        ))

    # Deterministic ordering.
    visits.sort(key=lambda vs: (vs.camera.idx, vs.readings[0].seen_at))
    reliable.sort(key=lambda r: r.seen_at)
    lowconf.sort(key=lambda r: r.seen_at)
    garbage.sort(key=lambda r: r.seen_at)
    return visits, reliable, lowconf, garbage


def plan_journeys(
    settings, reliable: list[Reading]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Replay reliable reads per vehicle through the SAME rules as
    ``vehicle_intel._extend_journey`` (gap split, same-camera skip, haversine
    distance, speed, anomaly). Returns (points, anomalies)."""
    max_gap = float(settings.journey_max_gap_seconds)
    max_speed = float(settings.journey_max_speed_kph)
    min_interval = float(settings.journey_min_interval_seconds)

    per_vehicle: dict[int, list[Reading]] = {}
    for r in reliable:
        if r.vehicle is not None:
            per_vehicle.setdefault(r.vehicle.idx, []).append(r)

    points: list[dict[str, Any]] = []
    anomalies: list[dict[str, Any]] = []
    for vidx in sorted(per_vehicle):
        reads = sorted(per_vehicle[vidx], key=lambda r: r.seen_at)
        journey_id = 0
        sequence = 0
        last: Reading | None = None
        for r in reads:
            distance_km = interval_seconds = speed_kph = None
            anomaly = False
            anomaly_reason: str | None = None
            if last is None:
                journey_id, sequence = 1, 1
            else:
                gap = (r.seen_at - last.seen_at).total_seconds()
                if last.camera.idx == r.camera.idx and gap <= max_gap:
                    continue  # repeated reads on one camera are not a new stop
                if gap > max_gap:
                    journey_id += 1
                    sequence = 1
                else:
                    sequence += 1
                    interval_seconds = gap
                    distance_km = _haversine_km(
                        last.camera.latitude, last.camera.longitude,
                        r.camera.latitude, r.camera.longitude,
                    )
                    if distance_km is not None and gap >= min_interval:
                        speed_kph = distance_km / (gap / 3600.0)
                        if speed_kph > max_speed:
                            anomaly = True
                            anomaly_reason = (
                                f"impossible speed {speed_kph:.0f} km/h (> {max_speed:.0f})"
                            )
                    elif distance_km is not None and gap < min_interval and distance_km > 0.5:
                        anomaly = True
                        anomaly_reason = f"impossible: {distance_km:.1f} km in {gap:.1f}s"
            point = {
                "reading": r,
                "vehicle": r.vehicle,
                "journey_id": journey_id,
                "sequence": sequence,
                "distance_km": round(distance_km, 3) if distance_km is not None else None,
                "interval_seconds": (
                    round(interval_seconds, 1) if interval_seconds is not None else None),
                "speed_kph": round(speed_kph, 1) if speed_kph is not None else None,
                "anomaly": anomaly,
                "anomaly_reason": anomaly_reason,
            }
            points.append(point)
            if anomaly:
                anomalies.append(point)
            last = r
    return points, anomalies


# --------------------------------------------------------------------------- #
# Row builders
# --------------------------------------------------------------------------- #
def upsert_roles(session: Session) -> int:
    """Upsert the system roles exactly like ``app.services.auth.seed_roles``
    (same ROLE_DEFINITIONS matrix) — inside the seed transaction."""
    count = 0
    for role_id in SYSTEM_ROLES:
        definition = ROLE_DEFINITIONS[role_id]
        role = session.get(Role, role_id)
        if role is None:
            role = Role(id=role_id, name=definition["name"], is_system=True)
            session.add(role)
        role.name = definition["name"]
        role.description = definition["description"]
        role.permissions = list(definition["permissions"])
        role.is_system = True
        count += 1
    session.flush()
    return count


DEMO_USERS = [
    ("demo_admin", "Demo Administrator", "ADMIN", "Administrator (DEMO)"),
    ("demo_supervisor", "Demo Supervisor", "SUPERVISOR", "Supervisor (DEMO)"),
    ("demo_investigator", "Demo Investigator", "INVESTIGATOR", "Inspector (DEMO)"),
    ("demo_operator", "Demo Operator", "OPERATOR", "Operator (DEMO)"),
]


def upsert_users(session: Session, now: datetime) -> dict[str, User]:
    users: dict[str, User] = {}
    created: list[str] = []
    for i, (username, full_name, role_id, rank) in enumerate(DEMO_USERS):
        user = session.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(
                username=username,
                email=f"{username}@demo.invalid",
                full_name=full_name,
                rank=rank,
                employee_id=f"DEMO-{i + 1:04d}",
                department="Demo Control Room, Ahmedabad (DEMO)",
                location="Ahmedabad (DEMO)",
                phone="+91-00000-00000",
                password_hash=hash_password(DEMO_PASSWORD),  # bcrypt — never plaintext
                role_id=role_id,
                is_active=True,
                last_login_at=now - timedelta(hours=int(2 + i * 7)),
                created_by=DEMO_CREATED_BY,
                created_at=now - timedelta(days=21, hours=i),
                updated_at=now - timedelta(days=1),
            )
            session.add(user)
            created.append(username)
        users[username] = user
    session.flush()
    if created:
        print(f"Users:      created {', '.join(created)} (demo password: {DEMO_PASSWORD})")
    else:
        print("Users:      demo users already present — left untouched")
    return users


def upsert_cameras(session: Session, plans: list[CameraPlan], now: datetime) -> dict[str, Camera]:
    rows: dict[str, Camera] = {}
    for i, p in enumerate(plans):
        cam = session.get(Camera, p.camera_id)
        if cam is None:
            cam = Camera(camera_id=p.camera_id, created_at=now - timedelta(days=45, hours=i))
            session.add(cam)
        cam.department = f"{p.city} Traffic Division (DEMO)"
        cam.location_name = p.location_name
        cam.latitude = p.latitude
        cam.longitude = p.longitude
        cam.camera_type = p.camera_type
        cam.codec = p.codec
        cam.resolution = p.resolution
        cam.status = "maintenance" if (p.state == HEALTH_OFFLINE and p.idx % 2 == 1) else "active"
        cam.connectivity = p.connectivity
        cam.vms = "Unified VMS v4 (DEMO)"
        cam.owner = "Demo Seed Dataset"
        # Credential-free, non-routable stream URLs mirroring the app's URL
        # structure (RTSP :8554 / HLS index.m3u8 / WHEP :8889). Real stream
        # URLs stay configuration-derived via the Sentinel templates.
        cam.rtsp_url = f"rtsp://{DEMO_STREAM_HOST}:8554/demo/{p.camera_id}"
        cam.hls_url = f"https://{DEMO_STREAM_HOST}/{p.camera_id}/index.m3u8"
        cam.webrtc_url = f"http://{DEMO_STREAM_HOST}:8889/demo/{p.camera_id}/whep"
        cam.updated_at = now - timedelta(days=1, hours=i % 24)
        rows[p.camera_id] = cam
    session.flush()
    return rows


def _health_fields_for_state(
    rng: random.Random, state: str, plan: CameraPlan, now: datetime
) -> dict[str, Any]:
    """Realistic snapshot fields per health state (mirrors camera_health.poll_once)."""
    common = {"codec": plan.codec, "resolution": plan.resolution}
    if state == HEALTH_LIVE:
        last_frame = now - timedelta(seconds=rng.uniform(0.4, 4))
        return {
            **common, "monitored": True, "last_frame_at": last_frame, "last_success_at": last_frame,
            "reconnect_count": rng.randint(0, 2), "latency_ms": round(rng.uniform(80, 450), 1),
            "observed_fps": round(rng.uniform(12, 25), 2), "last_error": None,
            "consecutive_failures": 0,
            "stream_started_at": now - timedelta(hours=rng.uniform(3, 72)),
        }
    if state == HEALTH_DEGRADED:
        last_frame = now - timedelta(seconds=rng.uniform(4, 16))
        fps = round(rng.uniform(0.3, 0.95), 2)
        return {
            **common, "monitored": True, "last_frame_at": last_frame, "last_success_at": last_frame,
            "reconnect_count": rng.randint(1, 4), "latency_ms": round(rng.uniform(900, 3200), 1),
            "observed_fps": fps,
            "last_error": f"low frame rate: {fps} fps below degraded threshold",
            "consecutive_failures": 0,
            "stream_started_at": now - timedelta(hours=rng.uniform(6, 60)),
        }
    if state == HEALTH_RECONNECTING:
        attempt = rng.randint(2, 6)
        last_frame = now - timedelta(seconds=rng.uniform(25, 90))
        return {
            **common, "monitored": True, "last_frame_at": last_frame, "last_success_at": last_frame,
            "reconnect_count": attempt, "latency_ms": None, "observed_fps": 0.0,
            "last_error": (
                f"connection timeout to {DEMO_STREAM_HOST}:8554 — retrying (attempt {attempt})"
            ),
            "consecutive_failures": 1,
            "stream_started_at": now - timedelta(hours=rng.uniform(10, 50)),
        }
    if state == HEALTH_OFFLINE:
        last_frame = now - timedelta(hours=rng.uniform(2.5, 24))
        return {
            **common, "monitored": True, "last_frame_at": last_frame, "last_success_at": last_frame,
            "reconnect_count": rng.randint(5, 12), "latency_ms": None, "observed_fps": 0.0,
            "last_error": f"ffmpeg exited: connection refused ({DEMO_STREAM_HOST}:8554)",
            "consecutive_failures": rng.randint(2, 5),
            "stream_started_at": last_frame - timedelta(hours=rng.uniform(20, 90)),
        }
    if state == HEALTH_ERROR:
        last_frame = now - timedelta(seconds=rng.uniform(30, 150))
        return {
            **common, "monitored": True, "last_frame_at": last_frame, "last_success_at": last_frame,
            "reconnect_count": rng.randint(0, 3), "latency_ms": None, "observed_fps": 0.0,
            "last_error": "decoder error: corrupted frame data (H.264 slice header)",
            "consecutive_failures": 1,
            "stream_started_at": now - timedelta(hours=rng.uniform(2, 30)),
        }
    # UNKNOWN — registry camera the gateway was never asked to pull.
    return {
        "codec": None, "resolution": None, "monitored": False, "last_frame_at": None,
        "last_success_at": None, "reconnect_count": 0, "latency_ms": None,
        "observed_fps": None, "last_error": None, "consecutive_failures": 0,
        "stream_started_at": None,
    }


def upsert_health_status(
    rng: random.Random, session: Session, plans: list[CameraPlan], now: datetime,
) -> dict[str, CameraHealthStatus]:
    rows: dict[str, CameraHealthStatus] = {}
    for p in plans:
        fields = _health_fields_for_state(rng, p.state, p, now)
        row = session.get(CameraHealthStatus, p.camera_id)
        if row is None:
            started = fields.get("stream_started_at") or (now - timedelta(days=20))
            row = CameraHealthStatus(
                camera_id=p.camera_id,
                created_at=(started - timedelta(minutes=5)) if started else now - timedelta(days=20),
            )
            session.add(row)
        for k, v_ in fields.items():
            setattr(row, k, v_)
        row.state = p.state
        row.updated_at = now - timedelta(seconds=rng.uniform(1, 45))
        rows[p.camera_id] = row
    session.flush()
    return rows


def plan_health_events(
    rng: random.Random, plans: list[CameraPlan],
    health_rows: dict[str, CameraHealthStatus], now: datetime,
) -> list[CameraHealthEvent]:
    """Historical state transitions consistent with each camera's current
    state (LIVE→DEGRADED→RECONNECTING→OFFLINE chains, recoveries, …)."""
    events: list[CameraHealthEvent] = []

    def add(cam_id: str, frm: str | None, to: str, at: datetime, reason: str | None,
            monitored: bool = True, failures: int = 0, fps: float | None = None) -> None:
        events.append(CameraHealthEvent(
            camera_id=cam_id, from_state=frm, to_state=to,
            reason=(reason or "")[:255] or None,
            detail=f"monitored={str(monitored).lower()} failures={failures} fps={fps}",
            created_at=min(at, now - timedelta(seconds=1)),
        ))

    flap_live = {1, 5, 9, 14, 18, 22}  # 0-based: LIVE cameras that flapped + recovered
    for p in plans:
        row = health_rows[p.camera_id]
        chain: list[tuple] = []  # (frm, to, at, reason, monitored, failures, fps)

        if p.state == HEALTH_LIVE and p.idx in flap_live:
            t1 = now - timedelta(hours=rng.uniform(12, 60))
            t2 = t1 + timedelta(minutes=rng.uniform(4, 40))
            t3 = t2 + timedelta(minutes=rng.uniform(2, 25))
            chain = [
                (HEALTH_LIVE, HEALTH_DEGRADED, t1, "packet loss burst: fps 0.7", True, 0, 0.7),
                (HEALTH_DEGRADED, HEALTH_RECONNECTING, t2,
                 f"connection timeout to {DEMO_STREAM_HOST}:8554 — retrying (attempt 1)", True, 1, None),
                (HEALTH_RECONNECTING, HEALTH_LIVE, t3, None, True, 0, row.observed_fps),
            ]
            row.stream_started_at = t3
            row.updated_at = max(row.updated_at, t3 + timedelta(seconds=5))
        elif p.state == HEALTH_DEGRADED:
            t1 = (row.last_frame_at or now) - timedelta(hours=rng.uniform(2, 18))
            chain = [(HEALTH_LIVE, HEALTH_DEGRADED, t1, row.last_error, True, 0, row.observed_fps)]
        elif p.state == HEALTH_RECONNECTING:
            t1 = now - timedelta(minutes=rng.uniform(2, 9))
            t0 = t1 - timedelta(minutes=rng.uniform(2, 8))
            chain = [
                (HEALTH_LIVE, HEALTH_DEGRADED, t0, "packet loss burst: fps 0.5", True, 0, 0.5),
                (HEALTH_DEGRADED, HEALTH_RECONNECTING, t1, row.last_error, True, 1, None),
            ]
        elif p.state == HEALTH_OFFLINE:
            base = (row.last_frame_at or now) - timedelta(minutes=rng.uniform(20, 45))
            if p.idx == 23:  # one older flap-and-recover before the final failure
                t_old = base - timedelta(days=rng.uniform(3, 6))
                chain += [
                    (HEALTH_LIVE, HEALTH_RECONNECTING, t_old,
                     "connection timeout — retrying (attempt 1)", True, 1, None),
                    (HEALTH_RECONNECTING, HEALTH_LIVE, t_old + timedelta(minutes=rng.uniform(3, 20)),
                     None, True, 0, row.observed_fps),
                ]
            chain += [
                (HEALTH_LIVE, HEALTH_DEGRADED, base, "fps 0.4 below threshold", True, 0, 0.4),
                (HEALTH_DEGRADED, HEALTH_RECONNECTING, base + timedelta(minutes=rng.uniform(6, 18)),
                 f"connection timeout to {DEMO_STREAM_HOST}:8554 — retrying", True, 1, None),
                (HEALTH_RECONNECTING, HEALTH_OFFLINE, base + timedelta(minutes=rng.uniform(20, 40)),
                 row.last_error, True, row.consecutive_failures, None),
            ]
        elif p.state == HEALTH_ERROR:
            t1 = now - timedelta(minutes=rng.uniform(6, 45))
            chain = [(HEALTH_LIVE, HEALTH_ERROR, t1, row.last_error, True, 1, None)]
        elif p.state == HEALTH_UNKNOWN and p.idx == 10:
            t1 = now - timedelta(hours=rng.uniform(5, 9))
            chain = [(HEALTH_LIVE, HEALTH_UNKNOWN, t1,
                      "stream worker stopped (registry refresh)", False, 0, None)]

        started = row.stream_started_at
        if chain and (started is None or started >= chain[0][2]):
            started = chain[0][2] - timedelta(hours=rng.uniform(1, 24))
            row.stream_started_at = started
            row.created_at = started - timedelta(minutes=5)
        if started is not None:
            add(p.camera_id, HEALTH_UNKNOWN, HEALTH_LIVE, started, None,
                monitored=True, failures=0, fps=row.observed_fps)
        for frm, to, at, reason, monitored, failures, fps in chain:
            add(p.camera_id, frm, to, at, reason, monitored=monitored, failures=failures, fps=fps)

    session_events = sorted(events, key=lambda e: (e.camera_id, e.created_at))
    return session_events


def upsert_vehicles(session: Session, plans: list[VehiclePlan], now: datetime) -> dict[int, Vehicle]:
    rows: dict[int, Vehicle] = {}
    for i, p in enumerate(plans):
        v = session.scalar(select(Vehicle).where(Vehicle.plate == p.plate))
        if v is None:
            v = Vehicle(
                plate=p.plate, vehicle_class=p.vehicle_class,
                created_at=now - timedelta(days=WINDOW_DAYS + 1, hours=i % 24),
            )
            session.add(v)
        elif not v.vehicle_class:
            v.vehicle_class = p.vehicle_class
        p.row = v
        rows[p.idx] = v
    session.flush()
    return rows


def build_track_rows(
    rng: random.Random, visits: list[Visit], garbage: list[Reading], now: datetime,
) -> list[VehicleTrack]:
    """One VehicleTrack per visit (+ one un-plated track per garbage read).
    (camera_id, track_id) stays unique — track ids increment per camera."""
    next_track: dict[int, int] = {}
    tracks: list[VehicleTrack] = []

    def alloc(cam_idx: int) -> int:
        tid = next_track.get(cam_idx, 1001)
        next_track[cam_idx] = tid + 1
        return tid

    def trajectory(first_pts: float, last_pts: float, n: int, bbox) -> list[dict]:
        x0, y0, w0, h0 = bbox
        dx = rng.uniform(-260, 260)
        dy = rng.uniform(-40, 40)
        pts = []
        for k in range(n):
            f = k / max(1, n - 1)
            pts.append({
                "pts_ms": round(first_pts + (last_pts - first_pts) * f, 1),
                "x": round(max(5.0, min(1270.0, x0 + dx * f)), 1),
                "y": round(max(5.0, min(710.0, y0 + dy * f)), 1),
                "w": round(max(20.0, w0 + rng.uniform(-12, 12) * f), 1),
                "h": round(max(20.0, h0 + rng.uniform(-10, 10) * f), 1),
                "conf": round(rng.uniform(0.45, 0.92), 3),
            })
        return pts

    for visit in visits:
        reads = sorted(visit.readings + visit.extra, key=lambda r: r.seen_at)
        first_r, last_r = reads[0], reads[-1]
        span_start = first_r.seen_at - timedelta(seconds=rng.uniform(1.5, 7))
        span_end = last_r.seen_at + timedelta(seconds=rng.uniform(1, 5))
        fps = rng.uniform(10, 24)
        frame_count = max(5, min(220, int((span_end - span_start).total_seconds() * fps)))
        first_pts = max(0.0, first_r.pts_ms - rng.uniform(600, 4500))
        last_pts = first_pts + (span_end - span_start).total_seconds() * 1000.0
        tid = alloc(visit.camera.idx)
        visit.track_id = tid
        for r in reads:
            r.track_id = tid
        n_pts = min(frame_count, rng.randint(6, 10))
        row = VehicleTrack(
            camera_id=visit.camera.camera_id, track_id=tid,
            vehicle_class=(visit.vehicle.vehicle_class if visit.vehicle else None),
            plate=(visit.vehicle.plate if visit.vehicle else None),
            first_seen=span_start, last_seen=span_end,
            first_pts_ms=round(first_pts, 1), last_pts_ms=round(last_pts, 1),
            frame_count=frame_count,
            trajectory=trajectory(first_pts, last_pts, n_pts, first_r.bbox),
            created_at=span_start, updated_at=min(now, span_end + timedelta(seconds=1)),
        )
        visit.row = row
        tracks.append(row)

    for g in garbage:
        tid = alloc(g.camera.idx)
        g.track_id = tid
        span_start = g.seen_at - timedelta(seconds=rng.uniform(1, 5))
        span_end = g.seen_at + timedelta(seconds=rng.uniform(0.5, 3))
        fps = rng.uniform(10, 24)
        frame_count = max(4, min(120, int((span_end - span_start).total_seconds() * fps) + rng.randint(2, 10)))
        first_pts = max(0.0, g.pts_ms - rng.uniform(400, 2500))
        last_pts = first_pts + (span_end - span_start).total_seconds() * 1000.0
        n_pts = min(frame_count, rng.randint(4, 8))
        tracks.append(VehicleTrack(
            camera_id=g.camera.camera_id, track_id=tid,
            vehicle_class=g.vehicle_class,
            plate=None,  # garbage reads never tag the track with a plate
            first_seen=span_start, last_seen=span_end,
            first_pts_ms=round(first_pts, 1), last_pts_ms=round(last_pts, 1),
            frame_count=frame_count,
            trajectory=trajectory(first_pts, last_pts, n_pts, g.bbox),
            created_at=span_start, updated_at=min(now, span_end + timedelta(seconds=1)),
        ))
    return tracks


def build_sighting_rows(
    readings: list[Reading], vehicle_rows: dict[int, Vehicle],
    reliable_threshold: float,
) -> list[AnprSighting]:
    rows: list[AnprSighting] = []
    for r in readings:
        reliable = r.kind == "reliable"
        vid = vehicle_rows[r.vehicle.idx].id if (reliable and r.vehicle is not None) else None
        # Mirrors anpr.PlateRead: uncertain = grammar-invalid OR low confidence.
        uncertain = not (r.plate_valid and r.ocr >= reliable_threshold)
        if reliable:
            uncertain = False
        rows.append(AnprSighting(
            vehicle_id=vid,
            plate=r.plate[:16],
            plate_raw=r.plate_raw[:64],
            camera_id=r.camera.camera_id,
            track_id=r.track_id,
            vehicle_class=r.vehicle_class,
            ocr_confidence=r.ocr,
            detection_confidence=r.det,
            plate_valid=r.plate_valid,
            plate_uncertain=bool(uncertain),
            source=DEMO_SOURCE,
            bbox_x=r.bbox[0], bbox_y=r.bbox[1], bbox_w=r.bbox[2], bbox_h=r.bbox[3],
            pts_ms=r.pts_ms,
            latitude=r.camera.latitude, longitude=r.camera.longitude,
            location_name=r.camera.location_name,
            seen_at=r.seen_at,
        ))
        r.row = rows[-1]
    return rows


def refresh_vehicle_aggregates(session: Session, vehicle_rows: dict[int, Vehicle]) -> None:
    """Recompute Vehicle Identity stats FROM the sightings actually in the DB —
    identical semantics to ``vehicle_intel.record_anpr_sighting`` (reliable
    reads only: those are exactly the rows with vehicle_id set)."""
    now = _utcnow()
    for v in vehicle_rows.values():
        total, first_seen, last_seen, cam_count, best_conf = session.execute(
            select(
                func.count(AnprSighting.id),
                func.min(AnprSighting.seen_at),
                func.max(AnprSighting.seen_at),
                func.count(func.distinct(AnprSighting.camera_id)),
                func.max(AnprSighting.ocr_confidence),
            ).where(AnprSighting.vehicle_id == v.id)
        ).one()
        last_cam = session.scalar(
            select(AnprSighting.camera_id)
            .where(AnprSighting.vehicle_id == v.id)
            .order_by(AnprSighting.seen_at.desc(), AnprSighting.id.desc())
            .limit(1)
        )
        v.total_sightings = int(total or 0)
        v.first_seen = first_seen
        v.last_seen = last_seen
        v.last_camera_id = last_cam
        v.camera_count = int(cam_count or 0)
        v.best_confidence = float(best_conf) if best_conf is not None else None
        v.updated_at = now
    session.flush()


def build_journey_rows(points: list[dict[str, Any]], vehicle_rows: dict[int, Vehicle],
                       now: datetime) -> list[JourneyPoint]:
    rows: list[JourneyPoint] = []
    for pt in points:
        r: Reading = pt["reading"]
        v: VehiclePlan = pt["vehicle"]
        reason = pt["anomaly_reason"]
        rows.append(JourneyPoint(
            vehicle_id=vehicle_rows[v.idx].id,
            plate=v.plate,
            journey_id=pt["journey_id"],
            sequence=pt["sequence"],
            camera_id=r.camera.camera_id,
            seen_at=r.seen_at,
            latitude=r.camera.latitude, longitude=r.camera.longitude,
            location_name=r.camera.location_name,
            confidence=r.ocr,
            distance_km=pt["distance_km"],
            interval_seconds=pt["interval_seconds"],
            speed_kph=pt["speed_kph"],
            anomaly=pt["anomaly"],
            anomaly_reason=(reason[:128] if reason else None),
            created_at=min(now, r.seen_at + timedelta(seconds=1)),
        ))
    return rows


# --------------------------------------------------------------------------- #
# Watchlist / matches / alerts
# --------------------------------------------------------------------------- #
WATCHLIST_SPECS: list[tuple[Any, ...]] = [
    # (vehicle_idx | None, entry_type, category, priority, active, label, alias, description)
    (0, "vehicle", CATEGORY_STOLEN, "critical", True,
     "DEMO — Stolen white SUV (synthetic FIR)", "Demo SUV Alpha",
     "Synthetic demo record: white SUV reported stolen in a fictitious complaint. Not a real case."),
    (1, "vehicle", CATEGORY_STOLEN, "high", True,
     "DEMO — Stolen scooter (synthetic FIR)", None,
     "Synthetic demo record: two-wheeler theft, fictitious complaint. Not a real case."),
    (2, "vehicle", CATEGORY_WANTED, "critical", True,
     "DEMO — Wanted subject's sedan (synthetic)", "Demo Sedan Bravo",
     "Synthetic demo record: vehicle linked to a fictitious absconder. Not a real person or case."),
    (3, "vehicle", CATEGORY_WANTED, "high", True,
     "DEMO — Wanted subject's hatchback (synthetic)", None,
     "Synthetic demo record. Not a real person or case."),
    (4, "vehicle", CATEGORY_SUSPECT, "high", True,
     "DEMO — Suspect vehicle, cargo theft probe (synthetic)", "Demo Cargo Charlie",
     "Synthetic demo record: highway cargo theft investigation, fictitious. Not a real case."),
    (5, "vehicle", CATEGORY_SUSPECT, "medium", True,
     "DEMO — Suspect vehicle, night surveillance (synthetic)", None,
     "Synthetic demo record. Not a real person or case."),
    (6, "vehicle", CATEGORY_SUSPECT, "medium", True,
     "DEMO — Suspect motorcycle, snatch-chain probe (synthetic)", None,
     "Synthetic demo record. Not a real person or case."),
    (7, "vehicle", CATEGORY_TRAFFIC, "low", True,
     "DEMO — Repeat signal jumper (synthetic)", None,
     "Synthetic demo record: habitual traffic violations, fictitious e-challan history."),
    (8, "vehicle", CATEGORY_TRAFFIC, "medium", True,
     "DEMO — Overdue e-challan defaulter (synthetic)", None,
     "Synthetic demo record. Fictitious penalty history."),
    (9, "vehicle", CATEGORY_MISSING, "high", True,
     "DEMO — Vehicle of missing person (synthetic)", "Demo Missing Delta",
     "Synthetic demo record: linked to a fictitious missing-person report. Not a real person."),
    (10, "vehicle", CATEGORY_OTHERS, "medium", True,
     "DEMO — Linked to warehouse break-in (synthetic)", None,
     "Synthetic demo record. Not a real case."),
    (_INACTIVE_ENTRY_VEHICLE_IDX, "vehicle", CATEGORY_TRAFFIC, "low", False,
     "DEMO — Cleared after verification (inactive)", None,
     "Synthetic demo record: deactivated after fictitious verification."),
    (None, "person", CATEGORY_SUSPECT, "high", True,
     "DEMO — Person subject Alpha (synthetic)", None,
     "Synthetic demo person descriptor. Not a real individual."),
    (None, "person", CATEGORY_MISSING, "medium", True,
     "DEMO — Person subject Beta (synthetic)", None,
     "Synthetic demo person descriptor. Not a real individual."),
    (None, "other", CATEGORY_OTHERS, "low", False,
     "DEMO — Suspicious white tempo descriptor (inactive)", None,
     "Synthetic demo descriptor entry (no plate). Not a real case."),
]

# Entries created BEFORE their subject's first sighting (so every reliable read
# of the plate can match — like a long-standing watchlist entry).
_EARLY_ENTRY_VEHICLES = {0, 1, 2, 4, 7, 9}


def upsert_watchlist_entries(
    rng: random.Random, session: Session, vehicles: list[VehiclePlan],
    reliable: list[Reading], now: datetime,
) -> list[WatchlistEntry]:
    first_seen: dict[str, datetime] = {}
    last_seen: dict[str, datetime] = {}
    for r in reliable:
        if r.vehicle is None:
            continue
        p = r.vehicle.plate
        first_seen[p] = min(first_seen.get(p, r.seen_at), r.seen_at)
        last_seen[p] = max(last_seen.get(p, r.seen_at), r.seen_at)

    rows: list[WatchlistEntry] = []
    for spec in WATCHLIST_SPECS:
        vidx, etype, category, priority, active, label, alias, description = spec
        plate = vehicles[vidx].plate if vidx is not None else None
        plate_raw = _plate_raw_style(rng, plate) if plate else None

        if plate and plate in first_seen:
            if vidx in _EARLY_ENTRY_VEHICLES or not active:
                created = first_seen[plate] - timedelta(hours=rng.uniform(6, 48))
            else:
                span = (last_seen[plate] - first_seen[plate]).total_seconds()
                created = first_seen[plate] + timedelta(seconds=span * rng.uniform(0.3, 0.7))
            created = max(created, now - timedelta(days=WINDOW_DAYS + 2))
        else:
            created = now - timedelta(days=rng.uniform(3, 25))

        entry = session.scalar(
            select(WatchlistEntry).where(
                WatchlistEntry.created_by == DEMO_CREATED_BY,
                WatchlistEntry.label == label,
            )
        )
        if entry is None:
            entry = WatchlistEntry(created_at=created, match_count=0)
            session.add(entry)
        entry.plate = plate
        entry.plate_raw = plate_raw
        entry.entry_type = etype
        entry.label = label
        entry.alias = alias
        entry.description = description
        entry.category = category
        entry.priority = priority
        entry.is_active = active
        entry.created_by = DEMO_CREATED_BY
        entry.created_at = created
        entry.updated_at = min(now, created + timedelta(days=rng.uniform(0.2, 2)))
        rows.append(entry)
    session.flush()
    return rows


def build_matches(
    session: Session, entries: list[WatchlistEntry], reliable: list[Reading],
) -> list[tuple[WatchlistMatch, WatchlistEntry, Reading]]:
    """One match per reliable sighting of an ACTIVE vehicle-entry plate that
    occurred at/after the entry's creation — exactly the pipeline's contract.
    (sighting_id, entry_id) uniqueness is guaranteed by construction."""
    out: list[tuple[WatchlistMatch, WatchlistEntry, Reading]] = []
    active_by_plate = {
        e.plate: e for e in entries
        if e.is_active and e.entry_type == "vehicle" and e.plate
    }
    seen_pairs: set[tuple[int, int]] = set()
    for r in reliable:
        entry = active_by_plate.get(r.plate)
        if entry is None or r.row is None or r.seen_at < entry.created_at:
            continue
        pair = (r.row.id, entry.id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        m = WatchlistMatch(
            entry_id=entry.id,
            plate=r.plate,
            camera_id=r.camera.camera_id,
            sighting_id=r.row.id,
            confidence=r.ocr,
            latitude=r.camera.latitude, longitude=r.camera.longitude,
            location_name=r.camera.location_name,
            matched_at=r.seen_at,
            created_at=r.seen_at + timedelta(seconds=1),
        )
        session.add(m)
        out.append((m, entry, r))
    session.flush()

    # Denormalized entry stats must match the actual match rows exactly
    # (same fields watchlist.process_anpr_hit maintains).
    for e in entries:
        cnt, last_at = session.execute(
            select(func.count(WatchlistMatch.id), func.max(WatchlistMatch.matched_at))
            .where(WatchlistMatch.entry_id == e.id)
        ).one()
        e.match_count = int(cnt or 0)
        e.last_match_at = last_at
    session.flush()
    return out


def build_alerts(
    rng: random.Random, session: Session,
    matches: list[tuple[WatchlistMatch, WatchlistEntry, Reading]],
    anomalies: list[dict[str, Any]],
    health_rows: dict[str, CameraHealthStatus],
    cam_rows: dict[str, Camera],
    now: datetime,
) -> list[Alert]:
    alerts: list[Alert] = []
    seq = 0

    def next_alert_id() -> str:
        nonlocal seq
        seq += 1
        return f"{DEMO_ALERT_ID_PREFIX}{seq:06d}"

    def lifecycle(alert: Alert, created_at: datetime, *, allow_resolve: bool = True) -> None:
        age_h = (now - created_at).total_seconds() / 3600.0
        if age_h < 36:
            alert.status = ALERT_STATUS_NEW
            return
        roll = rng.random()
        ack_by = rng.choice(["demo_operator", "demo_supervisor", "demo_admin"])
        resolved_cap = 0.35 if allow_resolve else 0.0
        if roll < resolved_cap:
            alert.status = ALERT_STATUS_RESOLVED
            alert.acknowledged_at = created_at + timedelta(minutes=rng.uniform(5, 90))
            alert.acknowledged_by = ack_by
            alert.resolved_at = alert.acknowledged_at + timedelta(hours=rng.uniform(1, 8))
            alert.resolved_by = rng.choice(["demo_supervisor", "demo_investigator"])
            alert.resolution_note = rng.choice([
                "DEMO — false positive, plate re-verified against ANPR history",
                "DEMO — vehicle intercepted and field-verified by patrol unit",
                "DEMO — duplicate read of stationary vehicle, closed",
                "DEMO — synthetic record resolved during demo review",
            ])
        elif roll < resolved_cap + 0.25:
            alert.status = ALERT_STATUS_ACKNOWLEDGED
            alert.acknowledged_at = created_at + timedelta(minutes=rng.uniform(5, 90))
            alert.acknowledged_by = ack_by
        elif roll < resolved_cap + 0.45:
            alert.status = ALERT_STATUS_INVESTIGATING
            alert.acknowledged_at = created_at + timedelta(minutes=rng.uniform(5, 60))
            alert.acknowledged_by = "demo_investigator"
        elif roll < resolved_cap + 0.53:
            alert.status = ALERT_STATUS_ESCALATED
            alert.acknowledged_at = created_at + timedelta(minutes=rng.uniform(5, 45))
            alert.acknowledged_by = "demo_operator"
        else:
            alert.status = ALERT_STATUS_NEW
        alert.updated_at = max(
            created_at, alert.resolved_at or alert.acknowledged_at or created_at
        )

    # --- WATCHLIST_MATCH alerts (dedupe-bucketed like the real engine) ----- #
    groups: dict[tuple[int, str, int], list[tuple[WatchlistMatch, WatchlistEntry, Reading]]] = {}
    for m, entry, r in matches:
        bucket = int(m.matched_at.timestamp() // _ALERT_DEDUPE_WINDOW_S)
        groups.setdefault((entry.id, m.camera_id, bucket), []).append((m, entry, r))

    for (entry_id, camera_id, bucket), group in sorted(
        groups.items(), key=lambda kv: kv[1][0][0].matched_at
    ):
        m0, entry, _r0 = group[0]
        created = m0.matched_at + timedelta(seconds=2)
        if entry.alias:
            message = (
                f"Watchlist match: {entry.label} ({entry.alias}) detected at "
                f"{m0.location_name or m0.camera_id}"
            )
        else:
            message = (
                f"Watchlist match: {entry.label} detected at {m0.location_name or m0.camera_id}"
            )
        if entry.description:
            message += f" — {entry.description[:180]}"
        alert = Alert(
            alert_id=next_alert_id(),
            type=ALERT_TYPE_WATCHLIST_MATCH,
            severity=_PRIORITY_SEVERITY.get(entry.priority, "medium"),
            status=ALERT_STATUS_NEW,
            plate=m0.plate,
            camera_id=m0.camera_id,
            location_name=m0.location_name,
            latitude=m0.latitude, longitude=m0.longitude,
            message=message,
            source_type="watchlist_match",
            source_ref=f"watchlist_match:{m0.id}",
            dedupe_key=f"{DEMO_ALERT_DEDUPE_PREFIX}watchlist_match:{entry_id}:{camera_id}:{bucket}",
            created_at=created,
            updated_at=created,
        )
        lifecycle(alert, created)
        session.add(alert)
        session.flush()
        for m, _entry, _r in group:
            m.alert_id = alert.id  # suppression folds the group into one alert
        alerts.append(alert)

    # --- JOURNEY_ANOMALY alerts -------------------------------------------- #
    for pt in anomalies:
        r: Reading = pt["reading"]
        created = r.seen_at + timedelta(seconds=3)
        bucket = int(created.timestamp() // _ALERT_DEDUPE_WINDOW_S)
        alert = Alert(
            alert_id=next_alert_id(),
            type=ALERT_TYPE_JOURNEY_ANOMALY,
            severity="medium",
            status=ALERT_STATUS_NEW,
            plate=r.plate,
            camera_id=r.camera.camera_id,
            location_name=r.camera.location_name,
            latitude=r.camera.latitude, longitude=r.camera.longitude,
            message=(
                f"Journey anomaly for {r.plate}: {pt['anomaly_reason']} after {r.camera.camera_id}"
            ),
            source_type="journey",
            source_ref=f"journey:{r.plate}:{pt['journey_id']}",
            dedupe_key=f"{DEMO_ALERT_DEDUPE_PREFIX}journey:{r.plate}:{r.camera.camera_id}:{bucket}",
            created_at=created,
            updated_at=created,
        )
        lifecycle(alert, created)
        session.add(alert)
        alerts.append(alert)

    # --- Camera-failure alerts (still-failing cameras → never RESOLVED) ----- #
    for cam_id in sorted(health_rows):
        row = health_rows[cam_id]
        cam = cam_rows[cam_id]
        if row.state not in (HEALTH_OFFLINE, HEALTH_ERROR):
            continue
        failure_type = ALERT_TYPE_CAMERA_OFFLINE if row.state == HEALTH_OFFLINE else ALERT_TYPE_CAMERA_ERROR
        severity = "high" if row.state == HEALTH_OFFLINE else "medium"
        word = "offline" if row.state == HEALTH_OFFLINE else "stream error"
        created = (row.last_frame_at or now) + timedelta(minutes=rng.uniform(2, 8))
        alert = Alert(
            alert_id=next_alert_id(),
            type=failure_type,
            severity=severity,
            status=ALERT_STATUS_NEW,
            camera_id=cam_id,
            location_name=cam.location_name,
            latitude=cam.latitude, longitude=cam.longitude,
            message=f"Camera {cam_id} {word}: {(row.last_error or 'stream failure')[:200]}",
            source_type="camera_health",
            source_ref=f"camera:{cam_id}",
            dedupe_key=f"{DEMO_ALERT_DEDUPE_PREFIX}camera_health:{cam_id}",
            created_at=created,
            updated_at=created,
        )
        lifecycle(alert, created, allow_resolve=False)
        session.add(alert)
        alerts.append(alert)

    session.flush()
    return alerts


# --------------------------------------------------------------------------- #
# Evidence snapshots (tiny placeholder JPEGs — metadata + reference only,
# never continuous video in PostgreSQL)
# --------------------------------------------------------------------------- #
def build_evidence(
    rng: random.Random, session: Session,
    matches: list[tuple[WatchlistMatch, WatchlistEntry, Reading]],
    alerts: list[Alert],
    reliable: list[Reading],
    vehicles: list[VehiclePlan],
    settings,
    now: datetime,
) -> list[EvidenceSnapshot]:
    root = Path(settings.evidence_frames_dir)
    snapshots: list[EvidenceSnapshot] = []

    def write_snapshot(*, event_type: str, event_id: str, camera_id: str,
                       plate: str | None, captured_at: datetime,
                       bbox: tuple[float, float, float, float] | None,
                       note: str) -> EvidenceSnapshot:
        captured_at = min(captured_at, now - timedelta(seconds=5))
        day_dir = captured_at.strftime("%Y/%m/%d")
        ts = captured_at.strftime("%Y%m%d_%H%M%S_%f")
        safe_camera = "".join(c if c.isalnum() or c in "-_." else "_" for c in camera_id)[:64]
        safe_event = "".join(c if c.isalnum() else "_" for c in event_type)[:32]
        # Same relative-path convention as app.services.evidence, under demo/.
        relative = f"{DEMO_EVIDENCE_DIR_PREFIX}{day_dir}/{safe_camera}_{safe_event}_{ts}.jpg"
        full = root / relative
        full.parent.mkdir(parents=True, exist_ok=True)
        jpeg = _demo_jpeg(f"{event_type}:{event_id}:{camera_id}")
        full.write_bytes(jpeg)
        snap = EvidenceSnapshot(
            event_type=event_type,
            event_id=str(event_id)[:64],
            camera_id=camera_id,
            plate=plate,
            captured_at=captured_at,
            bbox=({"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]} if bbox else None),
            file_path=relative,
            sha256=hashlib.sha256(jpeg).hexdigest(),
            size_bytes=len(jpeg),
            content_type="image/jpeg",
            note=note[:255],
            retention_until=(
                captured_at + timedelta(days=settings.evidence_retention_days)
                if settings.evidence_retention_days > 0 else None
            ),
            created_at=captured_at + timedelta(seconds=1),
        )
        session.add(snap)
        snapshots.append(snap)
        return snap

    matches_by_plate: dict[str, list[tuple[WatchlistMatch, WatchlistEntry, Reading]]] = {}
    for item in matches:
        matches_by_plate.setdefault(item[0].plate, []).append(item)
    used_match_ids: set[int] = set()

    def snapshot_matches_for(plate: str, want: int) -> list[EvidenceSnapshot]:
        out: list[EvidenceSnapshot] = []
        items = sorted(matches_by_plate.get(plate, []),
                       key=lambda it: it[0].matched_at, reverse=True)
        for m, _entry, _r in items:
            if len(out) >= want or m.id in used_match_ids:
                continue
            used_match_ids.add(m.id)
            snap = write_snapshot(
                event_type="watchlist_match", event_id=str(m.id), camera_id=m.camera_id,
                plate=m.plate, captured_at=m.matched_at + timedelta(seconds=1), bbox=None,
                note="DEMO — synthetic full-frame placeholder captured on watchlist match",
            )
            m.evidence_id = snap.id
            if m.alert_id and rng.random() < 0.7:
                a = session.get(Alert, m.alert_id)
                if a is not None and a.evidence_id is None:
                    a.evidence_id = snap.id
            out.append(snap)
        return out

    # 1) Investigation-case plates: 2-3 full-frame match snapshots each.
    case_plates = {vehicles[vidx].plate for vidx in _CASE_VEHICLE_IDX}
    for vidx in _CASE_VEHICLE_IDX:
        if vidx in _ANOMALY_VEHICLE_IDX:
            continue  # anomaly case gets crops + an alert snapshot below
        snapshot_matches_for(vehicles[vidx].plate, want=3 if vidx == _CASE_VEHICLE_IDX[0] else 2)

    # 2) One snapshot per remaining matched active entry.
    for plate in sorted(p for p in matches_by_plate if p not in case_plates):
        snapshot_matches_for(plate, want=1)

    # 3) Anomaly case: vehicle crops for reads of that plate + alert snapshot.
    anomaly_plate = vehicles[_ANOMALY_VEHICLE_IDX[0]].plate
    anomaly_reads = sorted(
        (r for r in reliable if r.vehicle is not None and r.vehicle.plate == anomaly_plate
         and r.row is not None),
        key=lambda r: r.seen_at, reverse=True,
    )[:2]
    for r in anomaly_reads:
        snap = write_snapshot(
            event_type="anpr_sighting", event_id=str(r.row.id), camera_id=r.camera.camera_id,
            plate=r.plate, captured_at=r.seen_at + timedelta(seconds=1), bbox=r.bbox,
            note="DEMO — synthetic vehicle-crop placeholder on ANPR read",
        )
        r.row.evidence_path = snap.file_path

    journey_alerts = [a for a in alerts if a.type == ALERT_TYPE_JOURNEY_ANOMALY]
    if journey_alerts:
        a = journey_alerts[0]
        snap = write_snapshot(
            event_type="alert", event_id=a.alert_id, camera_id=a.camera_id or cameras_fallback_id(),
            plate=a.plate, captured_at=a.created_at + timedelta(seconds=1), bbox=None,
            note="DEMO — synthetic snapshot attached to journey-anomaly alert",
        )
        if a.evidence_id is None:
            a.evidence_id = snap.id

    # 4) Extra ANPR crops for the primary stolen-vehicle case plate.
    primary_plate = vehicles[_CASE_VEHICLE_IDX[0]].plate
    primary_reads = sorted(
        (r for r in reliable
         if r.vehicle is not None and r.vehicle.plate == primary_plate
         and r.row is not None and not r.row.evidence_path),
        key=lambda r: r.seen_at, reverse=True,
    )[:2]
    for r in primary_reads:
        snap = write_snapshot(
            event_type="anpr_sighting", event_id=str(r.row.id), camera_id=r.camera.camera_id,
            plate=r.plate, captured_at=r.seen_at + timedelta(seconds=1), bbox=r.bbox,
            note="DEMO — synthetic vehicle-crop placeholder on ANPR read",
        )
        r.row.evidence_path = snap.file_path

    # 5) Last-known-frame snapshots for the offline-camera alerts.
    for a in [x for x in alerts if x.type == ALERT_TYPE_CAMERA_OFFLINE][:2]:
        snap = write_snapshot(
            event_type="alert", event_id=a.alert_id,
            camera_id=a.camera_id or cameras_fallback_id(),
            plate=None, captured_at=a.created_at - timedelta(seconds=30), bbox=None,
            note="DEMO — synthetic last-known-frame placeholder before signal loss",
        )
        if a.evidence_id is None:
            a.evidence_id = snap.id

    # 6) Top up to ~25 with recent high-confidence ANPR crops across the fleet.
    pool = sorted(
        (r for r in reliable
         if r.row is not None and not r.row.evidence_path and r.ocr >= 0.93),
        key=lambda r: r.seen_at, reverse=True,
    )
    for r in pool:
        if len(snapshots) >= 25:
            break
        snap = write_snapshot(
            event_type="anpr_sighting", event_id=str(r.row.id), camera_id=r.camera.camera_id,
            plate=r.plate, captured_at=r.seen_at + timedelta(seconds=1), bbox=r.bbox,
            note="DEMO — synthetic vehicle-crop placeholder on high-confidence ANPR read",
        )
        r.row.evidence_path = snap.file_path

    session.flush()
    return snapshots


def cameras_fallback_id() -> str:
    return f"{DEMO_CAMERA_PREFIX}001"


# --------------------------------------------------------------------------- #
# Investigation cases + case evidence
# --------------------------------------------------------------------------- #
CASE_SPECS: list[tuple[int, str, str, str, str]] = [
    # (vehicle_idx, title, priority, status, officer)
    (_CASE_VEHICLE_IDX[0],
     "DEMO — Stolen white SUV recovery probe (synthetic)", "critical",
     CASE_STATUS_IN_PROGRESS, "DEMO Insp. R. Mehta (synthetic)"),
    (_CASE_VEHICLE_IDX[1],
     "DEMO — Wanted subject sedan movement profile (synthetic)", "high",
     CASE_STATUS_OPEN, "DEMO Insp. S. Patel (synthetic)"),
    (_CASE_VEHICLE_IDX[2],
     "DEMO — Stolen scooter chain-snatch correlation (synthetic)", "high",
     CASE_STATUS_IN_PROGRESS, "DEMO PSI K. Joshi (synthetic)"),
    (_CASE_VEHICLE_IDX[3],
     "DEMO — Suspect vehicle cargo-theft linkage (synthetic)", "high",
     CASE_STATUS_OPEN, "DEMO Insp. R. Mehta (synthetic)"),
    (_CASE_VEHICLE_IDX[4],
     "DEMO — Impossible-travel / cloned-plate probe (synthetic)", "medium",
     CASE_STATUS_OPEN, "DEMO Insp. A. Chauhan (synthetic)"),
    (_CASE_VEHICLE_IDX[5],
     "DEMO — Missing person's vehicle trace (synthetic)", "high",
     CASE_STATUS_CLOSED, "DEMO PSI K. Joshi (synthetic)"),
    (_CASE_VEHICLE_IDX[6],
     "DEMO — Repeat traffic offender history (synthetic)", "low",
     CASE_STATUS_CLOSED, "DEMO Insp. S. Patel (synthetic)"),
]


def build_cases(
    rng: random.Random, session: Session, vehicles: list[VehiclePlan],
    snapshots: list[EvidenceSnapshot], now: datetime,
) -> tuple[list[InvestigationCase], list[CaseEvidence]]:
    cases: list[InvestigationCase] = []
    links: list[CaseEvidence] = []
    for i, (vidx, title, priority, status, officer) in enumerate(CASE_SPECS):
        plate = vehicles[vidx].plate
        snaps = sorted((s for s in snapshots if s.plate == plate), key=lambda s: s.captured_at)
        last_event = max((s.captured_at for s in snaps), default=now - timedelta(days=2))
        created = min(now - timedelta(hours=rng.uniform(2, 48)),
                      last_event + timedelta(hours=rng.uniform(1, 8)))
        row = InvestigationCase(
            case_number=f"{DEMO_CASE_PREFIX}{i + 1:06d}",
            subject_plate=plate,
            title=title,
            priority=priority,
            status=status,
            notes=(
                f"Synthetic DEMO case file for {plate}. All subjects, events and "
                "descriptions are fictitious and were generated by "
                "scripts/seed_demo_data.py for dashboard demonstration only."
            ),
            officer=officer,
            created_by="demo_investigator" if i % 2 == 0 else "demo_admin",
            created_at=created,
            updated_at=min(now - timedelta(minutes=30),
                           created + timedelta(hours=rng.uniform(2, 40))),
            closed_at=(
                min(now - timedelta(hours=1), created + timedelta(days=rng.uniform(1, 5)))
                if status == CASE_STATUS_CLOSED else None
            ),
        )
        session.add(row)
        cases.append(row)
    session.flush()

    for case in cases:
        snaps = sorted((s for s in snapshots if s.plate == case.subject_plate),
                       key=lambda s: s.captured_at)
        for s in snaps[:4]:
            link = CaseEvidence(
                case_id=case.id,
                evidence_id=s.id,
                added_at=min(now, max(case.created_at, s.captured_at)
                             + timedelta(minutes=rng.uniform(5, 600))),
            )
            session.add(link)
            links.append(link)
    session.flush()
    return cases, links


# --------------------------------------------------------------------------- #
# Audit trail (written through the project's audit service — redaction intact)
# --------------------------------------------------------------------------- #
def build_audit_rows(
    rng: random.Random, session: Session, entries: list[WatchlistEntry],
    cases: list[InvestigationCase], alerts: list[Alert], users: dict[str, User],
    snapshots: list[EvidenceSnapshot], now: datetime,
) -> None:
    """~20 marked audit rows, back-dated to the events they describe."""

    def rec(*, action: str, username: str, role: str, resource_type: str,
            resource_id: str | int | None, detail: str, at: datetime,
            method: str = "POST", path: str = "/", extra: dict | None = None) -> None:
        user = users.get(username)
        row = audit_service.record(
            db=session,
            commit=False,
            action=action,
            username=username,
            role=role,
            user_id=(user.id if user else None),
            resource_type=resource_type,
            resource_id=resource_id,
            result="success",
            detail=f"[demo_seed] {detail}",
            ip_address="127.0.0.1",
            user_agent="DemoSeed/1.0 (synthetic)",
            method=method,
            path=path,
            context={"demo_seed": True, **(extra or {})},
        )
        if row is not None:
            row.created_at = min(at, now - timedelta(seconds=1))

    for u in ("demo_admin", "demo_supervisor", "demo_investigator", "demo_operator"):
        user = users.get(u)
        rec(action=ACTION_LOGIN_SUCCESS, username=u,
            role=(user.role_id if user else "VIEWER"), resource_type="session",
            resource_id=None, detail=f"Demo login for {u}",
            at=now - timedelta(hours=rng.uniform(2, 72)), path="/api/auth/login")

    for e in entries[:5]:
        rec(action=ACTION_WATCHLIST_CREATE, username="demo_admin", role="ADMIN",
            resource_type="watchlist_entry", resource_id=e.id,
            detail=f"Created demo watchlist entry '{e.label}' ({e.category}/{e.priority})",
            at=e.created_at + timedelta(minutes=rng.uniform(1, 10)),
            path="/api/watchlist", extra={"plate": e.plate, "category": e.category})

    inactive = next((e for e in entries if not e.is_active and e.entry_type == "vehicle"), None)
    if inactive is not None:
        rec(action=ACTION_WATCHLIST_UPDATE, username="demo_supervisor", role="SUPERVISOR",
            resource_type="watchlist_entry", resource_id=inactive.id,
            detail=f"Deactivated demo watchlist entry '{inactive.label}'",
            at=inactive.updated_at + timedelta(minutes=5),
            method="PATCH", path=f"/api/watchlist/{inactive.id}")

    for a in [x for x in alerts
              if x.acknowledged_at and x.type == ALERT_TYPE_WATCHLIST_MATCH][:2]:
        rec(action=ACTION_ALERT_ACKNOWLEDGE, username=a.acknowledged_by or "demo_operator",
            role="OPERATOR", resource_type="alert", resource_id=a.alert_id,
            detail=f"Acknowledged demo alert {a.alert_id} ({a.type})",
            at=a.acknowledged_at or now, method="POST",
            path=f"/api/alerts/{a.alert_id}/acknowledge")
    for a in [x for x in alerts if x.resolved_at][:2]:
        rec(action=ACTION_ALERT_RESOLVE, username=a.resolved_by or "demo_supervisor",
            role="SUPERVISOR", resource_type="alert", resource_id=a.alert_id,
            detail=f"Resolved demo alert {a.alert_id}: {(a.resolution_note or '')[:100]}",
            at=a.resolved_at or now, method="POST",
            path=f"/api/alerts/{a.alert_id}/resolve")
    for a in [x for x in alerts if x.status == ALERT_STATUS_ESCALATED][:1]:
        rec(action=ACTION_ALERT_STATUS, username="demo_supervisor", role="SUPERVISOR",
            resource_type="alert", resource_id=a.alert_id,
            detail=f"Escalated demo alert {a.alert_id} to joint control room",
            at=(a.acknowledged_at or a.created_at) + timedelta(minutes=20),
            method="POST", path=f"/api/alerts/{a.alert_id}/status")

    for c in cases[:3]:
        rec(action=ACTION_CASE_CREATE, username=c.created_by or "demo_investigator",
            role="INVESTIGATOR", resource_type="investigation_case",
            resource_id=c.case_number,
            detail=f"Opened demo investigation case {c.case_number} for {c.subject_plate}",
            at=c.created_at + timedelta(minutes=rng.uniform(1, 8)),
            path="/api/investigations")

    if snapshots:
        s = snapshots[0]
        rec(action=ACTION_EVIDENCE_ACCESS, username="demo_investigator", role="INVESTIGATOR",
            resource_type="evidence", resource_id=s.id,
            detail=f"Viewed demo evidence snapshot #{s.id} ({s.event_type}:{s.event_id})",
            at=min(now - timedelta(hours=1), s.captured_at + timedelta(hours=2)),
            method="GET", path=f"/api/evidence/{s.id}")
    if cases:
        c = cases[0]
        rec(action=ACTION_INVESTIGATION_ACCESS, username="demo_supervisor", role="SUPERVISOR",
            resource_type="investigation_case", resource_id=c.case_number,
            detail=f"Reviewed demo case file {c.case_number}",
            at=min(now - timedelta(minutes=30), c.updated_at + timedelta(hours=3)),
            method="GET", path=f"/api/investigations/{c.id}")

    session.flush()


# --------------------------------------------------------------------------- #
# Reports — generated AFTER the main commit through the app's own report
# service (real builders + CSV writer over the freshly seeded PostgreSQL data).
# --------------------------------------------------------------------------- #
REPORT_SPECS: list[tuple[str, str]] = [
    ("DEMO — ANPR Activity Report (30 days)", REPORT_TYPE_ANPR_ACTIVITY),
    ("DEMO — Vehicle Journey Report (30 days)", REPORT_TYPE_VEHICLE_JOURNEY),
    ("DEMO — Watchlist Alerts Report (30 days)", REPORT_TYPE_WATCHLIST_ALERTS),
    ("DEMO — Camera Health Report (fleet snapshot)", REPORT_TYPE_CAMERA_HEALTH),
    ("DEMO — Investigation Report (open + closed cases)", REPORT_TYPE_INVESTIGATION),
]


def regenerate_demo_reports(now: datetime) -> list[dict[str, Any]]:
    """Delete previous demo reports (rows + files) and regenerate all five via
    ``app.services.reports.create_report`` — the same code path the API uses.
    Returns plain dicts (the session is closed before the caller inspects them)."""
    from app.services import reports as reports_service

    session = SessionLocal()
    outputs: list[dict[str, Any]] = []
    try:
        old_files = [p for p in session.scalars(
            select(Report.file_path).where(Report.created_by == DEMO_CREATED_BY)
        ).all() if p]
        session.execute(sa_delete(Report).where(Report.created_by == DEMO_CREATED_BY))
        session.commit()
        settings = get_settings()
        rep_root = Path(settings.reports_dir).resolve()
        for rel in old_files:
            _remove_file_guarded(rel, rep_root)

        admin = session.scalar(select(User).where(User.username == "demo_admin"))
        principal = Principal(
            user_id=(admin.id if admin else "demo_seed"),
            username="demo_admin",
            full_name=(admin.full_name if admin else "Demo Seed"),
            role="ADMIN",
            permissions=set(),
        )
        for name, rtype in REPORT_SPECS:
            report = reports_service.create_report(
                session,
                name=name,
                report_type=rtype,
                date_from=now - timedelta(days=WINDOW_DAYS),
                date_to=now,
                fmt=REPORT_FORMAT_CSV,
                classification="internal",
                created_by=DEMO_CREATED_BY,
                created_by_role="ADMIN",
                principal=principal,
            )
            # Capture plain values while the row is still bound to the session.
            outputs.append({
                "type": rtype,
                "report_id": report.report_id,
                "status": report.status,
                "row_count": report.row_count,
                "error": report.error,
            })
            flag = "OK " if report.status == REPORT_STATUS_COMPLETED else "FAIL"
            print(f"Report:     [{flag}] {report.report_id} {rtype:<18} rows={report.row_count}")
        return outputs
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# Validation (runs inside the transaction, before COMMIT — and again after)
# --------------------------------------------------------------------------- #
def validate(session: Session) -> list[str]:
    """Relational + aggregate consistency checks over the DEMO dataset.
    Returns a list of failure messages (empty = valid)."""
    problems: list[str] = []
    settings = get_settings()

    def scalar(stmt) -> int:
        return int(session.scalar(stmt) or 0)

    demo_vehicle_ids = select(Vehicle.id).where(Vehicle.plate.op("~")(DEMO_PLATE_RE))
    demo_entry_ids = select(WatchlistEntry.id).where(
        WatchlistEntry.created_by == DEMO_CREATED_BY)
    demo_case_ids = select(InvestigationCase.id).where(
        InvestigationCase.case_number.like(f"{DEMO_CASE_PREFIX}%"))

    n = scalar(select(func.count()).select_from(AnprSighting).where(
        AnprSighting.source == DEMO_SOURCE,
        ~AnprSighting.camera_id.in_(select(Camera.camera_id)),
    ))
    if n:
        problems.append(f"{n} demo ANPR sightings reference non-existent cameras")

    n = scalar(select(func.count()).select_from(AnprSighting).where(
        AnprSighting.source == DEMO_SOURCE,
        AnprSighting.vehicle_id.isnot(None),
        ~AnprSighting.vehicle_id.in_(select(Vehicle.id)),
    ))
    if n:
        problems.append(f"{n} demo ANPR sightings reference non-existent vehicles")

    n = scalar(select(func.count()).select_from(JourneyPoint).where(
        JourneyPoint.vehicle_id.in_(demo_vehicle_ids),
        ~JourneyPoint.vehicle_id.in_(select(Vehicle.id)),
    ))
    if n:
        problems.append(f"{n} demo journey points reference non-existent vehicles")

    n = scalar(select(func.count()).select_from(JourneyPoint).where(
        JourneyPoint.vehicle_id.in_(demo_vehicle_ids),
        ~JourneyPoint.camera_id.in_(select(Camera.camera_id)),
    ))
    if n:
        problems.append(f"{n} demo journey points reference non-existent cameras")

    n = scalar(select(func.count()).select_from(WatchlistMatch).where(
        WatchlistMatch.entry_id.in_(demo_entry_ids),
        ~WatchlistMatch.sighting_id.in_(select(AnprSighting.id)),
    ))
    if n:
        problems.append(f"{n} demo watchlist matches reference non-existent sightings")

    n = scalar(select(func.count()).select_from(WatchlistMatch).where(
        WatchlistMatch.entry_id.in_(demo_entry_ids),
        ~WatchlistMatch.entry_id.in_(select(WatchlistEntry.id)),
    ))
    if n:
        problems.append(f"{n} demo watchlist matches reference non-existent entries")

    n = scalar(select(func.count()).select_from(CaseEvidence).where(
        CaseEvidence.case_id.in_(demo_case_ids),
        or_(
            ~CaseEvidence.case_id.in_(select(InvestigationCase.id)),
            ~CaseEvidence.evidence_id.in_(select(EvidenceSnapshot.id)),
        ),
    ))
    if n:
        problems.append(f"{n} demo case_evidence links reference missing case/evidence rows")

    n = scalar(select(func.count()).select_from(CameraHealthStatus).where(
        CameraHealthStatus.camera_id.like(_demo_camera_like()),
        ~CameraHealthStatus.camera_id.in_(select(Camera.camera_id)),
    ))
    if n:
        problems.append(f"{n} demo health statuses reference non-existent cameras")

    # Uncertain reads must never carry a vehicle identity; reliable reads must.
    n = scalar(select(func.count()).select_from(AnprSighting).where(
        AnprSighting.source == DEMO_SOURCE,
        AnprSighting.plate_uncertain.is_(True),
        AnprSighting.vehicle_id.isnot(None),
    ))
    if n:
        problems.append(f"{n} uncertain demo sightings incorrectly reference a vehicle")

    # Reliable reads must satisfy the reliability contract.
    n = scalar(select(func.count()).select_from(AnprSighting).where(
        AnprSighting.source == DEMO_SOURCE,
        AnprSighting.plate_valid.is_(True),
        AnprSighting.plate_uncertain.is_(False),
        AnprSighting.ocr_confidence < settings.anpr_reliable_confidence,
    ))
    if n:
        problems.append(f"{n} 'reliable' demo reads are below ANPR_RELIABLE_CONFIDENCE")

    # (camera_id, track_id) uniqueness.
    dup = session.execute(
        select(VehicleTrack.camera_id, VehicleTrack.track_id, func.count())
        .where(VehicleTrack.camera_id.like(_demo_camera_like()))
        .group_by(VehicleTrack.camera_id, VehicleTrack.track_id)
        .having(func.count() > 1)
    ).all()
    if dup:
        problems.append(f"duplicate (camera_id, track_id) demo tracks: {dup[:3]}")

    # (sighting_id, entry_id) uniqueness on matches.
    dup = session.execute(
        select(WatchlistMatch.sighting_id, WatchlistMatch.entry_id, func.count())
        .where(WatchlistMatch.entry_id.in_(demo_entry_ids))
        .group_by(WatchlistMatch.sighting_id, WatchlistMatch.entry_id)
        .having(func.count() > 1)
    ).all()
    if dup:
        problems.append(f"duplicate demo (sighting_id, entry_id) matches: {dup[:3]}")

    # (case_id, evidence_id) uniqueness.
    dup = session.execute(
        select(CaseEvidence.case_id, CaseEvidence.evidence_id, func.count())
        .where(CaseEvidence.case_id.in_(demo_case_ids))
        .group_by(CaseEvidence.case_id, CaseEvidence.evidence_id)
        .having(func.count() > 1)
    ).all()
    if dup:
        problems.append(f"duplicate demo (case_id, evidence_id) links: {dup[:3]}")

    # Vehicle aggregate consistency (total/first/last vs the sighting rows).
    mismatch = session.execute(
        select(Vehicle.plate, Vehicle.total_sightings, func.count(AnprSighting.id))
        .select_from(Vehicle)
        .outerjoin(AnprSighting, AnprSighting.vehicle_id == Vehicle.id)
        .where(Vehicle.plate.op("~")(DEMO_PLATE_RE))
        .group_by(Vehicle.id, Vehicle.plate, Vehicle.total_sightings)
        .having(Vehicle.total_sightings != func.count(AnprSighting.id))
    ).all()
    if mismatch:
        problems.append(f"vehicle.total_sightings mismatch vs sightings: {mismatch[:3]}")

    mismatch = session.execute(
        select(Vehicle.plate, Vehicle.last_seen, func.max(AnprSighting.seen_at))
        .select_from(Vehicle)
        .join(AnprSighting, AnprSighting.vehicle_id == Vehicle.id)
        .where(Vehicle.plate.op("~")(DEMO_PLATE_RE))
        .group_by(Vehicle.id, Vehicle.plate, Vehicle.last_seen)
        .having(Vehicle.last_seen != func.max(AnprSighting.seen_at))
    ).all()
    if mismatch:
        problems.append(f"vehicle.last_seen mismatch vs latest sighting: {mismatch[:3]}")

    mismatch = session.execute(
        select(Vehicle.plate, Vehicle.first_seen, func.min(AnprSighting.seen_at))
        .select_from(Vehicle)
        .join(AnprSighting, AnprSighting.vehicle_id == Vehicle.id)
        .where(Vehicle.plate.op("~")(DEMO_PLATE_RE))
        .group_by(Vehicle.id, Vehicle.plate, Vehicle.first_seen)
        .having(Vehicle.first_seen != func.min(AnprSighting.seen_at))
    ).all()
    if mismatch:
        problems.append(f"vehicle.first_seen mismatch vs earliest sighting: {mismatch[:3]}")

    # Watchlist aggregate consistency.
    mismatch = session.execute(
        select(WatchlistEntry.label, WatchlistEntry.match_count, func.count(WatchlistMatch.id))
        .select_from(WatchlistEntry)
        .outerjoin(WatchlistMatch, WatchlistMatch.entry_id == WatchlistEntry.id)
        .where(WatchlistEntry.created_by == DEMO_CREATED_BY)
        .group_by(WatchlistEntry.id, WatchlistEntry.label, WatchlistEntry.match_count)
        .having(WatchlistEntry.match_count != func.count(WatchlistMatch.id))
    ).all()
    if mismatch:
        problems.append(f"watchlist match_count mismatch vs match rows: {mismatch[:3]}")

    mismatch = session.execute(
        select(WatchlistEntry.label, WatchlistEntry.last_match_at,
               func.max(WatchlistMatch.matched_at))
        .select_from(WatchlistEntry)
        .join(WatchlistMatch, WatchlistMatch.entry_id == WatchlistEntry.id)
        .where(WatchlistEntry.created_by == DEMO_CREATED_BY)
        .group_by(WatchlistEntry.id, WatchlistEntry.label, WatchlistEntry.last_match_at)
        .having(WatchlistEntry.last_match_at != func.max(WatchlistMatch.matched_at))
    ).all()
    if mismatch:
        problems.append(f"watchlist last_match_at mismatch vs matches: {mismatch[:3]}")

    # ANPR dedupe contract: no two demo reads of the same plate+camera < 20 s apart.
    dedupe_violations = 0
    rows = session.execute(
        select(AnprSighting.plate, AnprSighting.camera_id, AnprSighting.seen_at)
        .where(AnprSighting.source == DEMO_SOURCE)
        .order_by(AnprSighting.plate, AnprSighting.camera_id, AnprSighting.seen_at)
    ).all()
    prev: tuple[str, str, datetime] | None = None
    for plate, cam, seen in rows:
        if prev and prev[0] == plate and prev[1] == cam:
            if abs((seen - prev[2]).total_seconds()) < ANPR_DEDUPE_SECONDS:
                dedupe_violations += 1
        prev = (plate, cam, seen)
    if dedupe_violations:
        problems.append(
            f"{dedupe_violations} demo sighting pairs violate the 20 s (plate, camera) dedupe window")

    return problems


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
def demo_counts(session: Session) -> dict[str, int]:
    def scalar(stmt) -> int:
        return int(session.scalar(stmt) or 0)

    demo_vehicle_ids = select(Vehicle.id).where(Vehicle.plate.op("~")(DEMO_PLATE_RE))
    demo_entry_ids = select(WatchlistEntry.id).where(
        WatchlistEntry.created_by == DEMO_CREATED_BY)
    demo_case_ids = select(InvestigationCase.id).where(
        InvestigationCase.case_number.like(f"{DEMO_CASE_PREFIX}%"))

    return {
        "Cameras": scalar(select(func.count()).select_from(Camera).where(
            Camera.camera_id.like(_demo_camera_like()))),
        "Vehicles": scalar(select(func.count()).select_from(Vehicle).where(
            Vehicle.plate.op("~")(DEMO_PLATE_RE))),
        "ANPR Sightings": scalar(select(func.count()).select_from(AnprSighting).where(
            AnprSighting.source == DEMO_SOURCE)),
        "Vehicle Tracks": scalar(select(func.count()).select_from(VehicleTrack).where(
            VehicleTrack.camera_id.like(_demo_camera_like()))),
        "Journey Points": scalar(select(func.count()).select_from(JourneyPoint).where(
            JourneyPoint.vehicle_id.in_(demo_vehicle_ids))),
        "Watchlist Entries": scalar(select(func.count()).select_from(WatchlistEntry).where(
            WatchlistEntry.created_by == DEMO_CREATED_BY)),
        "Watchlist Matches": scalar(select(func.count()).select_from(WatchlistMatch).where(
            WatchlistMatch.entry_id.in_(demo_entry_ids))),
        "Alerts": scalar(select(func.count()).select_from(Alert).where(
            Alert.dedupe_key.like(f"{DEMO_ALERT_DEDUPE_PREFIX}%"))),
        "Evidence": scalar(select(func.count()).select_from(EvidenceSnapshot).where(
            EvidenceSnapshot.file_path.like(f"{DEMO_EVIDENCE_DIR_PREFIX}%"))),
        "Investigation Cases": scalar(select(func.count()).select_from(InvestigationCase).where(
            InvestigationCase.case_number.like(f"{DEMO_CASE_PREFIX}%"))),
        "Case Evidence": scalar(select(func.count()).select_from(CaseEvidence).where(
            CaseEvidence.case_id.in_(demo_case_ids))),
        "Health Status": scalar(select(func.count()).select_from(CameraHealthStatus).where(
            CameraHealthStatus.camera_id.like(_demo_camera_like()))),
        "Health Events": scalar(select(func.count()).select_from(CameraHealthEvent).where(
            CameraHealthEvent.camera_id.like(_demo_camera_like()))),
        "Demo Users": scalar(select(func.count()).select_from(User).where(
            User.username.like(DEMO_USER_LIKE, escape="\\"),
            User.created_by == DEMO_CREATED_BY)),
        "Audit Logs": scalar(select(func.count()).select_from(AuditLog).where(
            func.json_extract_path_text(AuditLog.context, "demo_seed") == "true")),
        "Reports": scalar(select(func.count()).select_from(Report).where(
            Report.created_by == DEMO_CREATED_BY)),
    }


def print_summary(counts: dict[str, int], report_notes: list[str], mode: str) -> None:
    print()
    print("=" * 50)
    print("DEMO DATA SEED COMPLETE")
    print("=" * 50)
    order = [
        "Cameras", "Vehicles", "ANPR Sightings", "Vehicle Tracks", "Journey Points",
        "Watchlist Entries", "Watchlist Matches", "Alerts", "Evidence",
        "Investigation Cases", "Case Evidence", "Health Status", "Health Events",
        "Demo Users", "Audit Logs", "Reports",
    ]
    width = max(len(k) for k in order) + 2
    for key in order:
        print(f"{key + ':':<{width}}{counts.get(key, 0):>6}")
    print()
    print(f"Database: PostgreSQL ({_mask_url(str(engine.url))})")
    print(f"Mode:     {mode}")
    for note in report_notes:
        print(f"Note:     {note}")
    print("Status:   SUCCESS")
    print("=" * 50)


# --------------------------------------------------------------------------- #
# Orchestrator
# --------------------------------------------------------------------------- #
def seed(reset: bool) -> int:
    settings = get_settings()
    rng = random.Random(RNG_SEED)
    now = _utcnow().replace(microsecond=0)

    preflight()

    session = SessionLocal()
    notes: list[str] = []
    mode = "reset + reseed" if reset else "seed/update"
    generate_facts = False
    try:
        if reset:
            deleted = purge_demo_data(session)
            total = sum(deleted.values())
            print(f"Purge:      removed {total} demo rows "
                  f"(cameras={deleted.get('cameras', 0)}, "
                  f"sightings={deleted.get('anpr_sightings', 0)}, "
                  f"alerts={deleted.get('alerts', 0)}, …) + generated files")

        facts_exist = demo_facts_exist(session)
        generate_facts = reset or not facts_exist
        if facts_exist and not reset:
            notes.append("demo fact dataset already present — dimensions refreshed, "
                         "facts left untouched (use --reset to regenerate)")

        # 1-2. Roles + demo users.
        n_roles = upsert_roles(session)
        users = upsert_users(session, now)
        print(f"Roles:      {n_roles} system roles ensured")

        # 3. Cameras.
        cam_plans = build_camera_plans(rng)
        cam_rows = upsert_cameras(session, cam_plans, now)

        # 5. Vehicles (identity rows first — sightings reference them).
        veh_plans = build_vehicle_plans(rng)
        veh_rows = upsert_vehicles(session, veh_plans, now)

        if generate_facts:
            # 4. Camera health status.
            health_rows = upsert_health_status(rng, session, cam_plans, now)

            # 6-8. Tracks + sightings (visits drive both), then aggregates.
            visits, reliable, lowconf, garbage = plan_activity(
                rng, now, settings, cam_plans, veh_plans)
            track_rows = build_track_rows(rng, visits, garbage, now)
            session.add_all(track_rows)
            session.flush()

            sighting_rows = build_sighting_rows(
                reliable + lowconf + garbage, veh_rows,
                float(settings.anpr_reliable_confidence))
            session.add_all(sighting_rows)
            session.flush()

            refresh_vehicle_aggregates(session, veh_rows)

            # 9. Journey points (same rules as vehicle_intel._extend_journey).
            journey_points, anomalies = plan_journeys(settings, reliable)
            session.add_all(build_journey_rows(journey_points, veh_rows, now))
            session.flush()

            # 10-11. Watchlist entries + matches (matches need sighting ids).
            entries = upsert_watchlist_entries(rng, session, veh_plans, reliable, now)
            matches = build_matches(session, entries, reliable)

            # 12. Alerts (+ fold matches into their alert).
            alerts = build_alerts(rng, session, matches, anomalies,
                                  health_rows, cam_rows, now)

            # 13. Evidence snapshots (files + rows + cross-links).
            snapshots = build_evidence(rng, session, matches, alerts, reliable,
                                       veh_plans, settings, now)

            # 14-15. Investigation cases + case evidence links.
            cases, case_links = build_cases(rng, session, veh_plans, snapshots, now)

            # 16. Health transition events.
            events = plan_health_events(rng, cam_plans, health_rows, now)
            session.add_all(events)
            session.flush()

            # 17. Audit rows (marked, back-dated, via the project's audit service).
            build_audit_rows(rng, session, entries, cases, alerts, users, snapshots, now)

            print(f"Planned:    {len(reliable)} reliable + {len(lowconf)} low-confidence "
                  f"+ {len(garbage)} garbage ANPR reads, {len(visits) + len(garbage)} tracks, "
                  f"{len(journey_points)} journey points ({len(anomalies)} anomalies), "
                  f"{len(matches)} matches, {len(alerts)} alerts, {len(snapshots)} evidence, "
                  f"{len(cases)} cases / {len(case_links)} links, {len(events)} health events")
        else:
            # Update mode: recompute aggregates from the data already stored.
            refresh_vehicle_aggregates(session, veh_rows)
            for entry in session.scalars(
                select(WatchlistEntry).where(WatchlistEntry.created_by == DEMO_CREATED_BY)
            ).all():
                cnt, last_at = session.execute(
                    select(func.count(WatchlistMatch.id), func.max(WatchlistMatch.matched_at))
                    .where(WatchlistMatch.entry_id == entry.id)
                ).one()
                entry.match_count = int(cnt or 0)
                entry.last_match_at = last_at
            session.flush()

        # 18. Validate INSIDE the transaction — any failure rolls everything back.
        problems = validate(session)
        if problems:
            raise SeedError("post-seed validation failed:\n  - " + "\n  - ".join(problems))
        print("Validation: all relational + aggregate checks passed (pre-commit)")

        session.commit()
    except Exception as exc:
        session.rollback()
        session.close()
        print()
        print("=" * 50)
        print("DEMO DATA SEED FAILED — transaction rolled back")
        print("=" * 50)
        print(f"Reason: {exc}")
        return 1
    finally:
        try:
            session.close()
        except Exception:
            pass

    # --- Phase 2: reports via the app's own report service (own commits) ---- #
    report_notes: list[str] = []
    try:
        reports = regenerate_demo_reports(now)
        failed = [r for r in reports if r["status"] != REPORT_STATUS_COMPLETED]
        if failed:
            report_notes.append(
                f"{len(failed)} report(s) failed to build: "
                + ", ".join(f"{r['type']}: {r['error']}" for r in failed)
            )
    except Exception as exc:
        report_notes.append(f"report generation failed (core dataset unaffected): {exc}")

    # --- Phase 3: final counts straight from the DB -------------------------- #
    session = SessionLocal()
    try:
        counts = demo_counts(session)
        problems = validate(session)  # re-validate the committed state
        if problems:
            print("VALIDATION PROBLEMS DETECTED AFTER COMMIT:")
            for p in problems:
                print(f"  - {p}")
    finally:
        session.close()

    if not generate_facts:
        notes.append("facts unchanged; counts reflect the existing demo dataset")
    print_summary(counts, notes + report_notes, mode)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.seed_demo_data",
        description="Seed/update a deterministic, clearly-marked DEMO dataset in PostgreSQL.",
        epilog=(
            "examples:\n"
            "  python -m scripts.seed_demo_data           # seed or refresh (idempotent)\n"
            "  python -m scripts.seed_demo_data --reset   # delete demo data and reseed\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="delete ONLY demo-marked rows/files first, then seed a fresh demo dataset",
    )
    args = parser.parse_args(argv)
    try:
        return seed(reset=args.reset)
    except SeedError as exc:
        print(f"\nSEED ERROR: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())

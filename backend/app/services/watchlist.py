"""Watchlist service — CRUD, stats and the genuine-ANPR-hit matcher.

Matching contract
-----------------
``process_anpr_hit`` is called by the pipeline with a **persisted, genuine**
ANPR sighting (synthetic detections never reach it). When the plate matches an
ACTIVE watchlist entry it creates **exactly one** ``WatchlistMatch`` — the
(sighting_id, entry_id) unique constraint makes duplicates impossible — and
publishes a single ``watchlist:match`` frame on the WebSocket hub. The Real-
Time Alert Engine then converts the match into an alert (see
``services/alerts.py``), optionally capturing an evidence snapshot from the
live-frame buffer.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.watchlist import (
    ENTRY_TYPES,
    PRIORITY_LEVELS,
    WatchlistEntry,
    WatchlistMatch,
)
from app.services.events import publish
from app.vision.plate_utils import clean_ocr_text, normalize_plate

logger = structlog.get_logger(__name__)

VALID_CATEGORIES = (
    "stolen",
    "wanted",
    "suspect",
    "missing",
    "traffic",
    "security",
    "others",
)

_PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


class WatchlistError(Exception):
    pass


# --------------------------------------------------------------------------- #
# CRUD
# --------------------------------------------------------------------------- #
def entry_dict(e: WatchlistEntry) -> dict[str, Any]:
    return {
        "id": e.id,
        "plate": e.plate,
        "plate_raw": e.plate_raw,
        "entry_type": e.entry_type,
        "label": e.label,
        "alias": e.alias,
        "description": e.description,
        "category": e.category,
        "priority": e.priority,
        "is_active": e.is_active,
        "created_by": e.created_by,
        "created_at": _iso(e.created_at),
        "updated_at": _iso(e.updated_at),
        "match_count": e.match_count,
        "last_match_at": _iso(e.last_match_at),
    }


def match_dict(m: WatchlistMatch, *, entry: WatchlistEntry | None = None) -> dict[str, Any]:
    data = {
        "id": m.id,
        "entry_id": m.entry_id,
        "plate": m.plate,
        "camera_id": m.camera_id,
        "sighting_id": m.sighting_id,
        "confidence": m.confidence,
        "latitude": m.latitude,
        "longitude": m.longitude,
        "location_name": m.location_name,
        "matched_at": _iso(m.matched_at),
        "alert_id": m.alert_id,
        "evidence_id": m.evidence_id,
        "evidence_url": f"/api/evidence/{m.evidence_id}/image" if m.evidence_id else None,
        "created_at": _iso(m.created_at),
    }
    if entry is not None:
        data["entry"] = entry_dict(entry)
    return data


def _normalize_plate_for_entry(plate: str | None) -> tuple[str | None, str | None]:
    """Return (normalized, raw) plate for a vehicle entry."""
    if not plate:
        return None, None
    raw = plate.strip()
    normalized, valid = normalize_plate(raw)
    if normalized is None:
        raise WatchlistError("Plate contains no usable characters")
    if not valid:
        logger.warning("watchlist.plate_invalid_format", plate=normalized)
    return normalized, raw


def create_entry(
    db: Session,
    *,
    plate: str | None = None,
    entry_type: str = "vehicle",
    label: str | None = None,
    alias: str | None = None,
    description: str | None = None,
    category: str = "others",
    priority: str = "medium",
    is_active: bool = True,
    created_by: str | None = None,
) -> WatchlistEntry:
    entry_type = (entry_type or "vehicle").lower()
    if entry_type not in ENTRY_TYPES:
        raise WatchlistError(f"Invalid entry_type '{entry_type}' (one of {ENTRY_TYPES})")
    if priority not in PRIORITY_LEVELS:
        raise WatchlistError(f"Invalid priority '{priority}' (one of {PRIORITY_LEVELS})")
    if category not in VALID_CATEGORIES:
        raise WatchlistError(f"Invalid category '{category}' (one of {VALID_CATEGORIES})")

    if entry_type == "vehicle":
        norm, raw = _normalize_plate_for_entry(plate)
        if not norm:
            raise WatchlistError("Vehicle entries require a plate number")
        label = (label or norm).strip()
    else:
        norm, raw = None, None
        if not label or not label.strip():
            raise WatchlistError("Person/other entries require a label")

    if norm is not None:
        conflict = db.scalar(
            select(WatchlistEntry).where(
                WatchlistEntry.plate == norm, WatchlistEntry.is_active.is_(True)
            )
        )
        if conflict is not None:
            raise WatchlistError(f"Plate {norm} already has an active watchlist entry (#{conflict.id})")

    entry = WatchlistEntry(
        plate=norm,
        plate_raw=raw,
        entry_type=entry_type,
        label=label,
        alias=(alias or None),
        description=(description or None),
        category=category,
        priority=priority,
        is_active=is_active,
        created_by=created_by,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info(
        "watchlist.entry_created",
        entry_id=entry.id,
        plate=entry.plate,
        category=category,
        priority=priority,
        by=created_by,
    )
    return entry


def update_entry(
    db: Session, entry: WatchlistEntry, *, actor: str, **fields: Any
) -> WatchlistEntry:
    allowed = {"label", "alias", "description", "category", "priority", "is_active", "plate"}
    unknown = set(fields) - allowed
    if unknown:
        raise WatchlistError(f"Unknown fields: {', '.join(sorted(unknown))}")
    if "category" in fields and fields["category"] not in VALID_CATEGORIES:
        raise WatchlistError(f"Invalid category '{fields['category']}'")
    if "priority" in fields and fields["priority"] not in PRIORITY_LEVELS:
        raise WatchlistError(f"Invalid priority '{fields['priority']}'")
    if "plate" in fields:
        if entry.entry_type != "vehicle":
            raise WatchlistError("Only vehicle entries have plates")
        norm, raw = _normalize_plate_for_entry(fields["plate"])
        if norm and norm != entry.plate:
            conflict = db.scalar(
                select(WatchlistEntry).where(
                    WatchlistEntry.plate == norm,
                    WatchlistEntry.is_active.is_(True),
                    WatchlistEntry.id != entry.id,
                )
            )
            if conflict is not None:
                raise WatchlistError(f"Plate {norm} already has an active watchlist entry")
            entry.plate = norm
            entry.plate_raw = raw
        fields.pop("plate")
    for key, value in fields.items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    logger.info("watchlist.entry_updated", entry_id=entry.id, by=actor)
    return entry


def delete_entry(db: Session, entry: WatchlistEntry, *, actor: str) -> None:
    logger.info("watchlist.entry_deleted", entry_id=entry.id, by=actor)
    db.delete(entry)
    db.commit()


def get_entry(db: Session, entry_id: int) -> WatchlistEntry | None:
    return db.get(WatchlistEntry, entry_id)


def list_entries(
    db: Session,
    *,
    limit: int = 100,
    offset: int = 0,
    query: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    entry_type: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[WatchlistEntry], int]:
    stmt = select(WatchlistEntry)
    count_stmt = select(func.count()).select_from(WatchlistEntry)
    if query:
        like = f"%{query.upper()}%"
        stmt = stmt.where(
            WatchlistEntry.label.ilike(f"%{query}%")
            | WatchlistEntry.plate.ilike(like)
            | WatchlistEntry.alias.ilike(f"%{query}%")
        )
        count_stmt = count_stmt.where(
            WatchlistEntry.label.ilike(f"%{query}%")
            | WatchlistEntry.plate.ilike(like)
            | WatchlistEntry.alias.ilike(f"%{query}%")
        )
    if category:
        stmt = stmt.where(WatchlistEntry.category == category)
        count_stmt = count_stmt.where(WatchlistEntry.category == category)
    if priority:
        stmt = stmt.where(WatchlistEntry.priority == priority)
        count_stmt = count_stmt.where(WatchlistEntry.priority == priority)
    if entry_type:
        stmt = stmt.where(WatchlistEntry.entry_type == entry_type)
        count_stmt = count_stmt.where(WatchlistEntry.entry_type == entry_type)
    if is_active is not None:
        stmt = stmt.where(WatchlistEntry.is_active.is_(is_active))
        count_stmt = count_stmt.where(WatchlistEntry.is_active.is_(is_active))
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(stmt.order_by(desc(WatchlistEntry.created_at)).limit(limit).offset(offset)).all()
    return list(rows), total


def list_matches(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    plate: str | None = None,
    camera_id: str | None = None,
    entry_id: int | None = None,
    since: datetime | None = None,
) -> tuple[list[WatchlistMatch], int]:
    stmt = select(WatchlistMatch)
    count_stmt = select(func.count()).select_from(WatchlistMatch)
    if plate:
        stmt = stmt.where(WatchlistMatch.plate == plate.upper().strip())
        count_stmt = count_stmt.where(WatchlistMatch.plate == plate.upper().strip())
    if camera_id:
        stmt = stmt.where(WatchlistMatch.camera_id == camera_id)
        count_stmt = count_stmt.where(WatchlistMatch.camera_id == camera_id)
    if entry_id:
        stmt = stmt.where(WatchlistMatch.entry_id == entry_id)
        count_stmt = count_stmt.where(WatchlistMatch.entry_id == entry_id)
    if since:
        stmt = stmt.where(WatchlistMatch.matched_at >= since)
        count_stmt = count_stmt.where(WatchlistMatch.matched_at >= since)
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(stmt.order_by(desc(WatchlistMatch.matched_at)).limit(limit).offset(offset)).all()
    return list(rows), total


def stats(db: Session, *, since: datetime | None = None) -> dict[str, Any]:
    total = int(db.scalar(select(func.count()).select_from(WatchlistEntry)) or 0)
    active = int(
        db.scalar(select(func.count()).select_from(WatchlistEntry).where(WatchlistEntry.is_active.is_(True))) or 0
    )
    match_stmt = select(func.count()).select_from(WatchlistMatch)
    if since:
        match_stmt = match_stmt.where(WatchlistMatch.matched_at >= since)
    matches = int(db.scalar(match_stmt) or 0)
    by_category = db.execute(
        select(WatchlistEntry.category, func.count()).group_by(WatchlistEntry.category)
    ).all()
    by_priority = db.execute(
        select(WatchlistEntry.priority, func.count())
        .where(WatchlistEntry.is_active.is_(True))
        .group_by(WatchlistEntry.priority)
    ).all()
    return {
        "total_entries": total,
        "active_entries": active,
        "inactive_entries": total - active,
        "matches": matches,
        "by_category": {row[0]: int(row[1]) for row in by_category},
        "by_priority": {row[0]: int(row[1]) for row in by_priority},
    }


# --------------------------------------------------------------------------- #
# Matching (called from the pipeline on a genuine, persisted ANPR hit)
# --------------------------------------------------------------------------- #
def find_active_entry(db: Session, plate: str) -> WatchlistEntry | None:
    """Best active entry for a plate (highest priority, oldest first)."""
    rows = db.scalars(
        select(WatchlistEntry).where(
            WatchlistEntry.plate == plate,
            WatchlistEntry.is_active.is_(True),
            WatchlistEntry.entry_type == "vehicle",
        )
    ).all()
    if not rows:
        return None
    rows.sort(key=lambda e: (_PRIORITY_RANK.get(e.priority, 99), e.id))
    return rows[0]


def process_anpr_hit(
    db: Session, sighting: dict[str, Any]
) -> tuple[WatchlistMatch, WatchlistEntry] | None:
    """Match one genuine ANPR sighting against the active watchlist.

    Creates **exactly one** match event (unique per sighting+entry) and returns
    ``(match, entry)``. The caller publishes the ``watchlist:match`` WebSocket
    frame after linking evidence / raising the alert, so exactly one frame goes
    out per genuine hit. Returns ``None`` when no active entry matches or the
    match already exists (duplicate read).
    """
    plate = clean_ocr_text(str(sighting.get("plate") or "")) if sighting else ""
    if not plate:
        return None
    entry = find_active_entry(db, plate)
    if entry is None:
        return None

    sighting_id = sighting.get("id") or sighting.get("sighting_id")
    if sighting_id is None:
        logger.warning("watchlist.match_skipped", reason="sighting has no id", plate=plate)
        return None

    # Exactly-once insert: unique (sighting_id, entry_id).
    stmt = (
        pg_insert(WatchlistMatch)
        .values(
            entry_id=entry.id,
            plate=plate,
            camera_id=sighting["camera_id"],
            sighting_id=sighting_id,
            confidence=float(sighting.get("ocr_confidence") or 0.0),
            latitude=sighting.get("latitude"),
            longitude=sighting.get("longitude"),
            location_name=sighting.get("location_name"),
            matched_at=sighting.get("seen_at") or _utcnow(),
        )
        .on_conflict_do_nothing(
            constraint="uq_watchlist_match_sighting_entry"
        )
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.rollback()
        logger.debug("watchlist.match_duplicate", plate=plate, sighting=sighting_id)
        return None
    match = db.scalar(
        select(WatchlistMatch).where(
            WatchlistMatch.sighting_id == sighting_id,
            WatchlistMatch.entry_id == entry.id,
        )
    )
    if match is None:
        db.commit()
        return None

    # Refresh entry stats.
    entry.match_count = (entry.match_count or 0) + 1
    entry.last_match_at = match.matched_at
    db.commit()

    logger.info(
        "watchlist.match",
        match_id=match.id,
        plate=plate,
        camera_id=match.camera_id,
        entry_id=entry.id,
        priority=entry.priority,
    )
    return match, entry


def matches_timeseries(db: Session, *, days: int = 7) -> list[dict[str, Any]]:
    """Matches per day for the watchlist analytics panels."""
    start = _utcnow() - timedelta(days=days)
    rows = db.execute(
        select(WatchlistMatch.matched_at).where(WatchlistMatch.matched_at >= start)
    ).scalars().all()
    buckets: dict[str, int] = {}
    for ts in rows:
        day = (ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)).strftime("%Y-%m-%d")
        buckets[day] = buckets.get(day, 0) + 1
    out = []
    for i in range(days):
        day = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        out.append({"day": day, "matches": buckets.get(day, 0)})
    return out


def top_match_locations(db: Session, *, limit: int = 5) -> list[dict[str, Any]]:
    rows = db.execute(
        select(WatchlistMatch.location_name, WatchlistMatch.camera_id, func.count())
        .group_by(WatchlistMatch.location_name, WatchlistMatch.camera_id)
        .order_by(desc(func.count()))
        .limit(limit)
    ).all()
    return [
        {
            "location_name": row[0] or row[1],
            "camera_id": row[1],
            "matches": int(row[2]),
        }
        for row in rows
    ]

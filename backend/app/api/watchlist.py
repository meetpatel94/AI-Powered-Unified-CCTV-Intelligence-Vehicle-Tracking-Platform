"""Watchlist API — CRUD, matches and analytics for the Watchlist screen."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import WATCHLIST_READ, WATCHLIST_WRITE
from app.db.session import get_db
from app.models.audit import (
    ACTION_WATCHLIST_CREATE,
    ACTION_WATCHLIST_DELETE,
    ACTION_WATCHLIST_UPDATE,
)
from app.schemas.auth import WatchlistEntryCreate, WatchlistEntryUpdate
from app.services import audit as audit_service
from app.services import watchlist as wl
from app.services.auth import Principal

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("")
def list_entries(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    query: str | None = Query(None, max_length=128),
    category: str | None = Query(None),
    priority: str | None = Query(None),
    entry_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(WATCHLIST_READ)),
) -> dict:
    rows, total = wl.list_entries(
        db,
        limit=limit,
        offset=offset,
        query=query,
        category=category,
        priority=priority,
        entry_type=entry_type,
        is_active=is_active,
    )
    return {
        "items": [wl.entry_dict(e) for e in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: WatchlistEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(WATCHLIST_WRITE)),
) -> dict:
    try:
        entry = wl.create_entry(
            db,
            plate=payload.plate,
            entry_type=payload.entry_type,
            label=payload.label,
            alias=payload.alias,
            description=payload.description,
            category=payload.category,
            priority=payload.priority,
            is_active=payload.is_active,
            created_by=principal.username,
        )
    except wl.WatchlistError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_WATCHLIST_CREATE,
        principal=principal,
        resource_type="watchlist_entry",
        resource_id=entry.id,
        detail=f"Watchlist entry created: '{entry.label}' ({entry.plate or entry.entry_type})",
        context={"plate": entry.plate, "category": entry.category, "priority": entry.priority},
        request=request,
    )
    return wl.entry_dict(entry)


@router.get("/stats")
def watchlist_stats(
    hours: float = Query(168, ge=0.01, le=8760, description="Match window (default 7 days)"),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(WATCHLIST_READ)),
) -> dict:
    since = datetime.now(timezone.utc) - timedelta(hours=hours) if hours else None
    stats = wl.stats(db, since=since)
    stats["matches_timeseries"] = wl.matches_timeseries(db, days=7)
    stats["top_match_locations"] = wl.top_match_locations(db, limit=5)
    stats["window_hours"] = hours
    return stats


@router.get("/matches")
def list_matches(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    plate: str | None = Query(None, max_length=16),
    camera_id: str | None = Query(None, max_length=64),
    entry_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(WATCHLIST_READ)),
) -> dict:
    rows, total = wl.list_matches(
        db, limit=limit, offset=offset, plate=plate, camera_id=camera_id, entry_id=entry_id
    )
    entry_ids = {m.entry_id for m in rows}
    entries = {}
    if entry_ids:
        for e in db.scalars(select(wl.WatchlistEntry).where(wl.WatchlistEntry.id.in_(entry_ids))).all():
            entries[e.id] = e
    return {
        "items": [wl.match_dict(m, entry=entries.get(m.entry_id)) for m in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{entry_id}")
def get_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(WATCHLIST_READ)),
) -> dict:
    entry = wl.get_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist entry not found")
    return wl.entry_dict(entry)


@router.patch("/{entry_id}")
def update_entry(
    entry_id: int,
    payload: WatchlistEntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(WATCHLIST_WRITE)),
) -> dict:
    entry = wl.get_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist entry not found")
    fields = payload.model_dump(exclude_unset=True)
    try:
        entry = wl.update_entry(db, entry, actor=principal.username, **fields)
    except wl.WatchlistError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_WATCHLIST_UPDATE,
        principal=principal,
        resource_type="watchlist_entry",
        resource_id=entry.id,
        detail=f"Watchlist entry #{entry.id} updated ({entry.label})",
        context={"changed_fields": sorted(fields.keys())},
        request=request,
    )
    return wl.entry_dict(entry)


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(WATCHLIST_WRITE)),
) -> dict:
    entry = wl.get_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist entry not found")
    label, plate = entry.label, entry.plate
    wl.delete_entry(db, entry, actor=principal.username)
    audit_service.record(
        db=db,
        action=ACTION_WATCHLIST_DELETE,
        principal=principal,
        resource_type="watchlist_entry",
        resource_id=entry_id,
        detail=f"Watchlist entry deleted: '{label}' ({plate or entry.entry_type})",
        context={"plate": plate},
        request=request,
    )
    return {"deleted": entry_id}

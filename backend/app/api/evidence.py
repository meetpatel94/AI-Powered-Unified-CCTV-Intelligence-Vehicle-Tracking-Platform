"""Evidence API — secure listing/retrieval of individual JPEG snapshots."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import EVIDENCE_READ
from app.db.session import get_db
from app.services import evidence as evidence_service
from app.services.auth import Principal

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("")
def list_evidence(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    camera_id: str | None = Query(None, max_length=64),
    plate: str | None = Query(None, max_length=16),
    event_type: str | None = Query(None, max_length=32),
    event_id: str | None = Query(None, max_length=64),
    since: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(EVIDENCE_READ)),
) -> dict:
    rows, total = evidence_service.list_evidence(
        db,
        limit=limit,
        offset=offset,
        camera_id=camera_id,
        plate=plate,
        event_type=event_type,
        event_id=event_id,
        since=_parse(since),
    )
    return {
        "items": [evidence_service.evidence_dict(s) for s in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{evidence_id}")
def get_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(EVIDENCE_READ)),
) -> dict:
    snap = evidence_service.get_evidence(db, evidence_id)
    if snap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    return evidence_service.evidence_dict(snap)


@router.get("/{evidence_id}/image")
def evidence_image(
    evidence_id: int,
    download: bool = Query(False),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(EVIDENCE_READ)),
) -> FileResponse:
    """Stream the JPEG. The stored path is resolved strictly under the
    configured evidence directory (path-traversal safe)."""
    snap = evidence_service.get_evidence(db, evidence_id)
    if snap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    full_path = evidence_service.resolve_evidence_path(snap.file_path)
    if full_path is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Evidence file is no longer available (retention cleanup or missing)",
        )
    filename = f"GP-EVIDENCE-{snap.id:06d}-{snap.camera_id}.jpg"
    return FileResponse(
        full_path,
        media_type=snap.content_type or "image/jpeg",
        filename=filename if download else None,
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Evidence-SHA256": snap.sha256,
            "Content-Disposition": (
                f'attachment; filename="{filename}"' if download else "inline"
            ),
        },
    )


@router.get("/{evidence_id}/verify")
def verify_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(EVIDENCE_READ)),
) -> dict:
    """Re-compute the SHA-256 of the stored file and compare with the record."""
    import hashlib

    snap = evidence_service.get_evidence(db, evidence_id)
    if snap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    full_path = evidence_service.resolve_evidence_path(snap.file_path)
    if full_path is None:
        return {"evidence_id": snap.id, "verifiable": False, "match": False}
    digest = hashlib.sha256()
    with open(full_path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    match = digest.hexdigest() == snap.sha256
    return {"evidence_id": snap.id, "verifiable": True, "match": match, "sha256": snap.sha256}

"""Evidence API — secure listing/retrieval of individual JPEG snapshots."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import EVIDENCE_READ
from app.db.session import get_db
from app.models.audit import (
    ACTION_EVIDENCE_ACCESS,
    ACTION_EVIDENCE_DOWNLOAD,
    ACTION_EVIDENCE_VERIFY,
)
from app.services import audit as audit_service
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
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(EVIDENCE_READ)),
) -> dict:
    snap = evidence_service.get_evidence(db, evidence_id)
    if snap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    audit_service.record(
        db=db,
        action=ACTION_EVIDENCE_ACCESS,
        principal=principal,
        resource_type="evidence",
        resource_id=snap.id,
        detail=f"Evidence metadata accessed: {snap.event_type} for {snap.plate or snap.camera_id}",
        context={"event_type": snap.event_type, "camera_id": snap.camera_id, "plate": snap.plate},
        request=request,
    )
    return evidence_service.evidence_dict(snap)


@router.get("/{evidence_id}/image")
def evidence_image(
    evidence_id: int,
    request: Request,
    download: bool = Query(False),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(EVIDENCE_READ)),
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
    audit_service.record(
        db=db,
        action=ACTION_EVIDENCE_DOWNLOAD if download else ACTION_EVIDENCE_ACCESS,
        principal=principal,
        resource_type="evidence",
        resource_id=snap.id,
        detail=(
            f"Evidence image {'downloaded' if download else 'viewed'}: "
            f"{snap.event_type} for {snap.plate or snap.camera_id}"
        ),
        context={"event_type": snap.event_type, "camera_id": snap.camera_id, "plate": snap.plate},
        request=request,
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
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(EVIDENCE_READ)),
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
    audit_service.record(
        db=db,
        action=ACTION_EVIDENCE_VERIFY,
        principal=principal,
        resource_type="evidence",
        resource_id=snap.id,
        detail=f"Evidence integrity verification {'MATCHED' if match else 'MISMATCHED'}",
        context={"match": match, "event_type": snap.event_type},
        result="success" if match else "failure",
        request=request,
    )
    return {"evidence_id": snap.id, "verifiable": True, "match": match, "sha256": snap.sha256}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import CAMERAS_READ, INGEST_CONTROL
from app.db.session import get_db
from app.schemas.camera import CameraRead, IngestResult
from app.services.auth import Principal
from app.services.cameras import get_camera, ingest_from_sentinel, list_cameras
from app.services.sentinel import SentinelError

router = APIRouter(prefix="/api", tags=["cameras"])


@router.get("/cameras", response_model=list[CameraRead])
def get_cameras(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(CAMERAS_READ)),
) -> list[CameraRead]:
    return [CameraRead.model_validate(c) for c in list_cameras(db)]


@router.get("/cameras/{camera_id}", response_model=CameraRead)
def get_camera_by_id(
    camera_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(CAMERAS_READ)),
) -> CameraRead:
    camera = get_camera(db, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return CameraRead.model_validate(camera)


@router.post("/ingest", response_model=IngestResult)
@router.get("/ingest", response_model=IngestResult)
def ingest_catalogue(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(INGEST_CONTROL)),
) -> IngestResult:
    """Pull the official Sentinel /api/ingest catalogue and upsert the Camera Registry.

    Camera URLs are never hard-coded. RTSP remains the primary inference feed.
    """
    try:
        result = ingest_from_sentinel(db)
    except SentinelError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return IngestResult(**result)

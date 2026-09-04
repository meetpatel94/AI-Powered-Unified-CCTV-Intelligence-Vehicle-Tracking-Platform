from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.permissions import CAMERAS_READ, INGEST_CONTROL
from app.db.session import get_db
from app.models.audit import ACTION_CAMERA_INGEST
from app.schemas.camera import CameraRead, IngestResult
from app.services import audit as audit_service
from app.services.auth import Principal
from app.services.cameras import get_camera, ingest_from_sentinel, list_cameras
from app.services.sentinel import SentinelError

router = APIRouter(prefix="/api", tags=["cameras"])


def _camera_out(camera) -> CameraRead:
    """Project a Camera row to the secret-free API schema."""
    return CameraRead(
        camera_id=camera.camera_id,
        department=camera.department,
        location_name=camera.location_name,
        latitude=camera.latitude,
        longitude=camera.longitude,
        camera_type=camera.camera_type,
        codec=camera.codec,
        resolution=camera.resolution,
        status=camera.status,
        connectivity=camera.connectivity,
        vms=camera.vms,
        owner=camera.owner,
        rtsp_configured=bool(camera.rtsp_url),
        webrtc_configured=bool(camera.webrtc_url),
        hls_configured=bool(camera.hls_url),
        hls_path=f"/api/streams/{camera.camera_id}/hls/index.m3u8" if camera.hls_url else None,
        live_frame_path=f"/api/streams/{camera.camera_id}/frame.jpg",
        live_mjpeg_path=f"/api/streams/{camera.camera_id}/live",
        created_at=camera.created_at,
        updated_at=camera.updated_at,
    )


@router.get("/cameras", response_model=list[CameraRead])
def get_cameras(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(CAMERAS_READ)),
) -> list[CameraRead]:
    return [_camera_out(c) for c in list_cameras(db)]


@router.get("/cameras/{camera_id}", response_model=CameraRead)
def get_camera_by_id(
    camera_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_permission(CAMERAS_READ)),
) -> CameraRead:
    camera = get_camera(db, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return _camera_out(camera)


@router.post("/ingest", response_model=IngestResult)
@router.get("/ingest", response_model=IngestResult)
def ingest_catalogue(
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission(INGEST_CONTROL)),
) -> IngestResult:
    """Pull the official Sentinel /api/ingest catalogue and upsert the Camera Registry.

    Camera URLs are never hard-coded. RTSP remains the primary inference feed.
    """
    try:
        result = ingest_from_sentinel(db)
    except SentinelError as exc:
        audit_service.record(
            db=db,
            action=ACTION_CAMERA_INGEST,
            principal=principal,
            resource_type="catalogue",
            resource_id="sentinel",
            result="failure",
            detail=f"Sentinel ingest failed: {exc}",
            request=request,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    audit_service.record(
        db=db,
        action=ACTION_CAMERA_INGEST,
        principal=principal,
        resource_type="catalogue",
        resource_id="sentinel",
        detail=f"Ingested {result['fetched']} cameras ({result['upserted']} upserted)",
        context={"fetched": result["fetched"], "upserted": result["upserted"], "skipped": result["skipped"]},
        request=request,
    )
    return IngestResult(**result)

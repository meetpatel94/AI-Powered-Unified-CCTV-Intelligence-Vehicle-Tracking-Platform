from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import check_database, get_db
from app.schemas.status import BackendStatus
from app.services.cameras import camera_count
from app.services.sentinel import probe_catalogue

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    db_ok = check_database()
    sentinel_ok = probe_catalogue()
    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "database": "connected" if db_ok else "unavailable",
        "sentinel": "reachable" if sentinel_ok else "unreachable",
    }


@router.get("/api/status", response_model=BackendStatus)
def backend_status(db: Session = Depends(get_db)) -> BackendStatus:
    settings = get_settings()
    db_ok = check_database()
    sentinel_ok = probe_catalogue()
    count = camera_count(db) if db_ok else None
    return BackendStatus(
        service=settings.app_name,
        environment=settings.app_env,
        database="connected" if db_ok else "unavailable",
        sentinel_catalogue="reachable" if sentinel_ok else "unreachable",
        sentinel_url=settings.sentinel_ingest_url,
        camera_count=count,
    )

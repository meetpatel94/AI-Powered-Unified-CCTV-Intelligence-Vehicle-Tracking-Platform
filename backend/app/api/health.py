from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import check_database, get_db
from app.schemas.status import BackendStatus
from app.services.cameras import camera_count
from app.services.sentinel import probe_catalogue
from app.services.stream_gateway import gateway

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    db_ok = check_database()
    sentinel_ok = probe_catalogue()
    snaps = gateway.list_snapshots()
    live = sum(1 for s in snaps if s.state.value == "LIVE")
    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "database": "connected" if db_ok else "unavailable",
        "sentinel": "reachable" if sentinel_ok else "unreachable",
        "live_streams": str(live),
    }


@router.get("/api/status", response_model=BackendStatus)
def backend_status(db: Session = Depends(get_db)) -> BackendStatus:
    settings = get_settings()
    db_ok = check_database()
    sentinel_ok = probe_catalogue()
    count = camera_count(db) if db_ok else None
    snaps = gateway.list_snapshots()
    states: dict[str, int] = {}
    for s in snaps:
        states[s.state.value] = states.get(s.state.value, 0) + 1
    return BackendStatus(
        service=settings.app_name,
        environment=settings.app_env,
        database="connected" if db_ok else "unavailable",
        sentinel_catalogue="reachable" if sentinel_ok else "unreachable",
        sentinel_url=settings.sentinel_ingest_url,
        camera_count=count,
        live_streams=sum(1 for s in snaps if s.state.value == "LIVE"),
        stream_states=states,
    )

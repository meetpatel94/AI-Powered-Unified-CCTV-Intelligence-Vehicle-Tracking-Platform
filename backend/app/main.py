"""GP CCTV Intelligence API — FastAPI application factory."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.camera_health import router as camera_health_router
from app.api.cameras import router as cameras_router
from app.api.dashboard import router as dashboard_router
from app.api.evidence import router as evidence_router
from app.api.gis import router as gis_router
from app.api.health import router as health_router
from app.api.intelligence import router as intelligence_router
from app.api.investigation import router as investigation_router
from app.api.streams import router as streams_router
from app.api.users import router as users_router
from app.api.vehicles import router as vehicles_router
from app.api.watchlist import router as watchlist_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.services.bootstrap import bootstrap_streams
from app.services.camera_health import monitor as health_monitor
from app.services.evidence import retention_task
from app.services.events import hub
from app.services.pipeline import manager
from app.services.stream_gateway import gateway

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Bridge the realtime hub to the running event loop for thread-safe publish.
    hub.bind_loop(asyncio.get_running_loop())

    # Dev convenience: create ORM tables if Alembic has not been run.
    if settings.auto_create_tables:
        from app.db.base import Base
        from app.db.session import engine
        from app import models  # noqa: F401 — register metadata

        Base.metadata.create_all(bind=engine)

    # Seed system roles (+ optional bootstrap admin) and start background tasks.
    import structlog

    db = SessionLocal()
    try:
        from app.services.auth import bootstrap_auth

        bootstrap_auth(db)
    except Exception as exc:  # keep the API up even if roles cannot seed
        structlog.get_logger(__name__).error("startup.auth_bootstrap_failed", error=str(exc))
    finally:
        db.close()

    bootstrap_streams()

    # Attach the Vehicle Intelligence Pipeline to cameras the gateway brings
    # LIVE. Camera list is dynamic (from the Sentinel registry) — nothing here
    # hard-codes an RTSP/camera URL.
    if settings.vehicle_pipeline_enabled:
        manager.start_auto_monitor()

    # Camera health monitor (state machine + camera:health / camera:state WS).
    health_monitor.start()

    # Evidence retention cleanup (hourly).
    if settings.evidence_frames_enabled:
        retention_task.start()

    yield

    retention_task.stop()
    health_monitor.stop()
    manager.stop_all()
    gateway.stop_all()


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description=(
        "Gujarat Police Unified CCTV Intelligence Platform. Camera catalogue is loaded "
        "dynamically from Sentinel /api/ingest; RTSP is the primary AI/inference feed. "
        "Modules: Camera Registry, Stream Gateway, Vehicle Intelligence (YOLO/ANPR/"
        "tracking/journeys), Watchlist, Real-Time Alerts, GIS, Camera Health, Dashboard "
        "Analytics, Investigation, Evidence Snapshots and Auth/RBAC."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(health_router)
# NOTE: camera_health_router must be registered BEFORE cameras_router — its
# /api/cameras/health routes would otherwise be captured by the generic
# /api/cameras/{camera_id} path parameter route.
app.include_router(camera_health_router)
app.include_router(cameras_router)
app.include_router(streams_router)
app.include_router(vehicles_router)
app.include_router(intelligence_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(watchlist_router)
app.include_router(alerts_router)
app.include_router(gis_router)
app.include_router(dashboard_router)
app.include_router(investigation_router)
app.include_router(evidence_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "health": "/health",
        "status": "/api/status",
        "cameras": "/api/cameras",
        "ingest": "/api/ingest",
        "streams": "/api/streams",
        "vehicles": "/api/vehicles/search?q=",
        "detections": "/api/detections/recent",
        "tracking": "/api/tracking/recent",
        "journeys": "/api/journeys/recent",
        "pipeline": "/api/pipeline",
        "watchlist": "/api/watchlist",
        "alerts": "/api/alerts/recent",
        "gis_cameras": "/api/gis/cameras",
        "gis_route": "/api/gis/vehicle/{plate}/route",
        "gis_nearby": "/api/gis/nearby?lat=&lng=",
        "camera_health": "/api/cameras/health",
        "dashboard_kpis": "/api/dashboard/kpis",
        "analytics": "/api/analytics/summary",
        "investigation": "/api/investigation/{plate}/timeline",
        "cases": "/api/investigation/cases",
        "evidence": "/api/evidence",
        "auth": "/api/auth/login",
        "users": "/api/users",
        "roles": "/api/roles",
        "realtime_ws": "/api/ws",
    }


"""GP CCTV Intelligence API — FastAPI application factory."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alerts import router as alerts_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.camera_health import router as camera_health_router
from app.api.cameras import router as cameras_router
from app.api.dashboard import router as dashboard_router
from app.api.evidence import router as evidence_router
from app.api.gis import router as gis_router
from app.api.health import router as health_router
from app.api.intelligence import router as intelligence_router
from app.api.investigation import router as investigation_router
from app.api.reports import router as reports_router
from app.api.streams import router as streams_router
from app.api.system import router as system_router
from app.api.users import router as users_router
from app.api.vehicles import router as vehicles_router
from app.api.watchlist import router as watchlist_router
from app.core.config import ConfigError, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    ErrorCaptureMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.db.session import SessionLocal, check_database
from app.services.bootstrap import bootstrap_streams
from app.services.camera_health import monitor as health_monitor
from app.services.evidence import retention_task
from app.services.events import hub
from app.services.pipeline import manager
from app.services.stream_gateway import gateway

configure_logging()
settings = get_settings()

# Fail fast on an unsafe configuration (production secrets, AUTH, etc.).
settings.validate_startup()


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
        # Load the model once at startup (health probe + page-cache warm); a
        # missing/unloadable model reports MODEL_NOT_READY and produces no
        # detections — the API and streams stay up regardless.
        try:
            from app.vision.detector import preflight_detector

            preflight_detector()
        except Exception:
            structlog.get_logger(__name__).exception("ai.preflight.failed")
        manager.start_auto_monitor()
        # One bounded ``ai:status`` frame immediately after startup.
        try:
            from app.services.pipeline import publish_ai_status

            publish_ai_status()
        except Exception:
            structlog.get_logger(__name__).exception("ai.status.initial_publish_failed")

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
    version="0.4.0",
    description=(
        "Gujarat Police Unified CCTV Intelligence Platform. Camera catalogue is loaded "
        "dynamically from Sentinel /api/ingest; RTSP is the primary AI/inference feed. "
        "Modules: Camera Registry, Stream Gateway, Vehicle Intelligence (YOLO/ANPR/"
        "tracking/journeys), Watchlist, Real-Time Alerts, GIS, Camera Health, Dashboard "
        "Analytics, Investigation, Evidence Snapshots, Auth/RBAC, Audit Logging, Reports "
        "and System Monitoring."
    ),
    lifespan=lifespan,
)

# --- Middleware (order: outermost first) ----------------------------------- #
# Security headers on every response.
app.add_middleware(SecurityHeadersMiddleware)
# Capture 5xx into the metrics error ring.
app.add_middleware(ErrorCaptureMiddleware)
# Rate limiting on sensitive endpoints (login, writes).
app.add_middleware(RateLimitMiddleware)

_cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    # Production requires an explicit allow-list; dev open-mode falls back to "*"
    # for localhost convenience only.
    allow_origins=_cors_origins or (["*"] if not settings.is_production else []),
    allow_credentials=settings.is_production or "*" not in (_cors_origins or ["*"]),
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

register_error_handlers(app)

app.include_router(health_router)
app.include_router(system_router)
app.include_router(audit_router)
app.include_router(reports_router)
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
        "version": "0.4.0",
        "docs": "/docs",
        "health": "/health",
        "readiness": "/api/system/readiness",
        "metrics": "/api/system/metrics",
        "status": "/api/status",
        "cameras": "/api/cameras",
        "ingest": "/api/ingest",
        "streams": "/api/streams",
        "vehicles": "/api/vehicles/search?q=",
        "detections": "/api/detections/recent",
        "tracking": "/api/tracking/recent",
        "journeys": "/api/journeys/recent",
        "pipeline": "/api/pipeline",
        "ai_status": "/api/ai/status",
        "watchlist": "/api/watchlist",
        "alerts": "/api/alerts/recent",
        "gis_cameras": "/api/gis/cameras",
        "camera_health": "/api/cameras/health",
        "reports": "/api/reports",
        "audit_logs": "/api/audit-logs",
        "auth": "/api/auth/login",
        "users": "/api/users",
        "realtime_ws": "/api/ws",
    }

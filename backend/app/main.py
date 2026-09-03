"""GP CCTV Intelligence API — FastAPI application factory."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.cameras import router as cameras_router
from app.api.health import router as health_router
from app.api.intelligence import router as intelligence_router
from app.api.streams import router as streams_router
from app.api.vehicles import router as vehicles_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.bootstrap import bootstrap_streams
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

    bootstrap_streams()

    # Attach the Vehicle Intelligence Pipeline to cameras the gateway brings
    # LIVE. Camera list is dynamic (from the Sentinel registry) — nothing here
    # hard-codes an RTSP/camera URL.
    if settings.vehicle_pipeline_enabled:
        manager.start_auto_monitor()

    yield

    manager.stop_all()
    gateway.stop_all()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Backend foundation for the Gujarat Police Unified CCTV Intelligence Platform. "
        "Camera catalogue is loaded dynamically from Sentinel /api/ingest. "
        "RTSP is the primary AI/inference feed. YOLO/ANPR/tracking are not implemented yet."
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

app.include_router(health_router)
app.include_router(cameras_router)
app.include_router(streams_router)
app.include_router(vehicles_router)
app.include_router(intelligence_router)


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
        "realtime_ws": "/api/ws",
    }

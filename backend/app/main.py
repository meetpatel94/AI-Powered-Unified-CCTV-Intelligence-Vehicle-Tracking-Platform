"""GP CCTV Intelligence API — FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.cameras import router as cameras_router
from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Backend foundation for the Gujarat Police Unified CCTV Intelligence Platform. "
        "Camera catalogue is loaded dynamically from Sentinel /api/ingest. "
        "RTSP is the primary AI/inference feed. YOLO/ANPR/tracking are not implemented yet."
    ),
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


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "health": "/health",
        "status": "/api/status",
        "cameras": "/api/cameras",
        "ingest": "/api/ingest",
    }

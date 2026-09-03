"""ORM models — register every model so Alembic sees the full metadata."""

from app.models.alerts import Alert
from app.models.auth import Role, User, UserSession
from app.models.camera import Camera
from app.models.evidence import EvidenceSnapshot
from app.models.health import CameraHealthEvent, CameraHealthStatus
from app.models.investigation import CaseEvidence, InvestigationCase
from app.models.vehicle import AnprSighting, JourneyPoint, Vehicle, VehicleTrack
from app.models.watchlist import WatchlistEntry, WatchlistMatch

__all__ = [
    "Camera",
    "Vehicle",
    "AnprSighting",
    "VehicleTrack",
    "JourneyPoint",
    "WatchlistEntry",
    "WatchlistMatch",
    "Alert",
    "CameraHealthStatus",
    "CameraHealthEvent",
    "InvestigationCase",
    "CaseEvidence",
    "EvidenceSnapshot",
    "Role",
    "User",
    "UserSession",
]

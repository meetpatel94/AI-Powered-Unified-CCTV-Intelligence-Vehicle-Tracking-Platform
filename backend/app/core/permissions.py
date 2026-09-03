"""Permission catalogue and the default role→permission matrix.

Permissions are ``"<resource>:<action>"`` strings. Every protected API route
declares the permission it needs via ``require_permission(...)``; the matrix
below is seeded into the ``roles`` table on startup (system roles).
"""

from __future__ import annotations

# --- Permission keys -------------------------------------------------------- #
DASHBOARD_READ = "dashboard:read"
ANALYTICS_READ = "analytics:read"
DETECTIONS_READ = "detections:read"
VEHICLES_READ = "vehicles:read"
GIS_READ = "gis:read"
CAMERAS_READ = "cameras:read"
CAMERAS_CONTROL = "cameras:control"
STREAMS_READ = "streams:read"
HEALTH_READ = "health:read"
PIPELINE_READ = "pipeline:read"
PIPELINE_CONTROL = "pipeline:control"
WATCHLIST_READ = "watchlist:read"
WATCHLIST_WRITE = "watchlist:write"
ALERTS_READ = "alerts:read"
ALERTS_ACKNOWLEDGE = "alerts:acknowledge"
ALERTS_RESOLVE = "alerts:resolve"
INVESTIGATION_READ = "investigation:read"
INVESTIGATION_WRITE = "investigation:write"
EVIDENCE_READ = "evidence:read"
EVIDENCE_WRITE = "evidence:write"
USERS_READ = "users:read"
USERS_WRITE = "users:write"
ROLES_READ = "roles:read"
ROLES_WRITE = "roles:write"
INGEST_CONTROL = "ingest:control"
# Phase 4 — production hardening.
REPORTS_READ = "reports:read"
REPORTS_GENERATE = "reports:generate"
AUDIT_READ = "audit:read"
SYSTEM_METRICS_READ = "system:metrics"

ALL_PERMISSIONS: tuple[str, ...] = (
    DASHBOARD_READ,
    ANALYTICS_READ,
    DETECTIONS_READ,
    VEHICLES_READ,
    GIS_READ,
    CAMERAS_READ,
    CAMERAS_CONTROL,
    STREAMS_READ,
    HEALTH_READ,
    PIPELINE_READ,
    PIPELINE_CONTROL,
    WATCHLIST_READ,
    WATCHLIST_WRITE,
    ALERTS_READ,
    ALERTS_ACKNOWLEDGE,
    ALERTS_RESOLVE,
    INVESTIGATION_READ,
    INVESTIGATION_WRITE,
    EVIDENCE_READ,
    EVIDENCE_WRITE,
    USERS_READ,
    USERS_WRITE,
    ROLES_READ,
    ROLES_WRITE,
    INGEST_CONTROL,
    REPORTS_READ,
    REPORTS_GENERATE,
    AUDIT_READ,
    SYSTEM_METRICS_READ,
)

_READ_PERMISSIONS: tuple[str, ...] = (
    DASHBOARD_READ,
    ANALYTICS_READ,
    DETECTIONS_READ,
    VEHICLES_READ,
    GIS_READ,
    CAMERAS_READ,
    STREAMS_READ,
    HEALTH_READ,
    PIPELINE_READ,
    WATCHLIST_READ,
    ALERTS_READ,
    INVESTIGATION_READ,
    EVIDENCE_READ,
    ROLES_READ,
    REPORTS_READ,
    SYSTEM_METRICS_READ,
)

# --- System role definitions ------------------------------------------------ #
SYSTEM_ROLES: tuple[str, ...] = ("ADMIN", "SUPERVISOR", "INVESTIGATOR", "OPERATOR", "VIEWER")

ROLE_DEFINITIONS: dict[str, dict] = {
    "ADMIN": {
        "name": "Administrator",
        "description": "Full platform control, including users, roles and camera ingestion.",
        "permissions": list(ALL_PERMISSIONS),
    },
    "SUPERVISOR": {
        "name": "Supervisor",
        "description": "Control-room duty officer: monitors everything, manages the watchlist, "
        "acknowledges/resolves alerts, opens investigations and controls cameras.",
        "permissions": [
            *_READ_PERMISSIONS,
            WATCHLIST_WRITE,
            ALERTS_ACKNOWLEDGE,
            ALERTS_RESOLVE,
            INVESTIGATION_WRITE,
            EVIDENCE_WRITE,
            CAMERAS_CONTROL,
            PIPELINE_CONTROL,
            INGEST_CONTROL,
            REPORTS_GENERATE,
            USERS_READ,
        ],
    },
    "INVESTIGATOR": {
        "name": "Investigator",
        "description": "Investigation officer: full read access plus case management and "
        "alert acknowledgement.",
        "permissions": [
            *_READ_PERMISSIONS,
            ALERTS_ACKNOWLEDGE,
            INVESTIGATION_WRITE,
            EVIDENCE_WRITE,
            REPORTS_GENERATE,
        ],
    },
    "OPERATOR": {
        "name": "Operator",
        "description": "Control-room operator: monitors feeds, acknowledges alerts and "
        "starts/stops camera streams.",
        "permissions": [
            *_READ_PERMISSIONS,
            ALERTS_ACKNOWLEDGE,
            CAMERAS_CONTROL,
        ],
    },
    "VIEWER": {
        "name": "Viewer",
        "description": "Read-only situational awareness.",
        "permissions": list(_READ_PERMISSIONS),
    },
}


def is_valid_permission(permission: str) -> bool:
    return permission in ALL_PERMISSIONS

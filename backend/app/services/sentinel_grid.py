"""Sentinel CCTV Camera Grid integration client.

SOURCE OF TRUTH
---------------
Camera catalogue : ``SENTINEL_CATALOGUE_URL`` (default
                   https://cctv.corp8.cloud/cameras.json)
HLS              : ``SENTINEL_HLS_URL_TEMPLATE``
RTSP             : ``SENTINEL_RTSP_URL_TEMPLATE`` (TCP transport is forced by
                   the stream gateway via ``-rtsp_transport tcp``)
WebRTC / WHEP    : ``SENTINEL_WEBRTC_URL_TEMPLATE``

Rules enforced here
-------------------
* Camera ids are DYNAMIC (cam01 … camNN). Nothing is hard-coded — the list is
  always read from the catalogue at runtime.
* Credentials come exclusively from ``SENTINEL_EMAIL`` / ``SENTINEL_PASSWORD``
  environment variables. The ``@`` in the email is URL-encoded (``%40``) when
  embedded in RTSP/WHEP URLs.
* Credential-bearing URLs never leave the backend: the API layer only exposes
  ``*_configured`` booleans plus the credential-free proxy paths.
* No camera coordinates or metadata are fabricated; only fields actually
  present in the catalogue are mapped.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx
import structlog

from app.core.config import get_settings
from app.services.sentinel import SentinelError, extract_records, normalize_camera

logger = structlog.get_logger(__name__)

__all__ = [
    "SentinelError",
    "build_hls_url",
    "build_rtsp_url",
    "build_webrtc_url",
    "fetch_grid_catalogue",
    "mask_url",
    "normalize_grid_camera",
    "probe_grid",
]


# --------------------------------------------------------------------------- #
# Credential handling
# --------------------------------------------------------------------------- #
def _credentials() -> tuple[str, str]:
    """Return (url-encoded email, url-encoded password) from the environment.

    Raises SentinelError when credentials are not configured so a missing
    ``.env`` fails loudly instead of silently producing anonymous URLs.
    """
    settings = get_settings()
    email = settings.sentinel_email.strip()
    password = settings.sentinel_password.strip()
    if not email or not password:
        raise SentinelError(
            "SENTINEL_EMAIL / SENTINEL_PASSWORD are not configured — set them in .env"
        )
    # quote() with an empty safe-set encodes '@' as %40, ':' as %3A, etc.
    return quote(email, safe=""), quote(password, safe="")


def mask_url(url: str | None) -> str:
    """Redact any userinfo so URLs are safe to log."""
    if not url:
        return ""
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" in rest:
        rest = "***@" + rest.rsplit("@", 1)[1]
    return f"{scheme}://{rest}"


# --------------------------------------------------------------------------- #
# Stream URL builders (templates come from config, ids from the catalogue)
# --------------------------------------------------------------------------- #
def build_hls_url(camera_id: str) -> str:
    """Public (credential-free) HLS playlist URL for a camera."""
    return get_settings().sentinel_hls_url_template.format(camera_id=camera_id)


def build_rtsp_url(camera_id: str) -> str:
    """Authenticated RTSP URL. Backend-only — never sent to the browser."""
    email, password = _credentials()
    return get_settings().sentinel_rtsp_url_template.format(
        camera_id=camera_id, email=email, password=password
    )


def build_webrtc_url(camera_id: str) -> str:
    """Authenticated WebRTC/WHEP URL. Backend-only — never sent to the browser."""
    email, password = _credentials()
    return get_settings().sentinel_webrtc_url_template.format(
        camera_id=camera_id, email=email, password=password
    )


# --------------------------------------------------------------------------- #
# Catalogue
# --------------------------------------------------------------------------- #
def normalize_grid_camera(record: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize one catalogue record onto Camera Registry columns.

    Reuses the vendor-agnostic mapper in ``app.services.sentinel`` and then
    fills the three stream URLs from the configured Grid templates when the
    catalogue itself does not carry explicit URLs. Nothing else is invented:
    location/coordinates/type stay ``None`` when absent from the catalogue.
    """
    normalized = normalize_camera(record)
    if not normalized:
        return None
    camera_id = normalized["camera_id"]

    if not normalized.get("hls_url"):
        normalized["hls_url"] = build_hls_url(camera_id)
    try:
        if not normalized.get("rtsp_url"):
            normalized["rtsp_url"] = build_rtsp_url(camera_id)
        if not normalized.get("webrtc_url"):
            normalized["webrtc_url"] = build_webrtc_url(camera_id)
    except SentinelError as exc:
        # Catalogue is still usable for metadata/HLS; RTSP simply stays unset.
        logger.warning(
            "sentinel.grid.credentials_missing", camera_id=camera_id, error=str(exc)
        )
    return normalized


def _auth() -> tuple[str, str] | None:
    settings = get_settings()
    if settings.sentinel_credentials_configured:
        # Raw (un-encoded) values: httpx performs its own header encoding.
        return settings.sentinel_email.strip(), settings.sentinel_password.strip()
    return None


def fetch_grid_catalogue() -> list[dict[str, Any]]:
    """GET the dynamic camera catalogue. Raises SentinelError on failure."""
    settings = get_settings()
    url = settings.sentinel_catalogue_url
    headers = {"Accept": "application/json", "User-Agent": "GP-CCTV-Intelligence/1.0"}
    if settings.sentinel_api_key:
        headers["Authorization"] = f"Bearer {settings.sentinel_api_key}"
    logger.info("sentinel.grid.fetch.start", url=url)
    try:
        with httpx.Client(
            timeout=httpx.Timeout(settings.sentinel_timeout_seconds),
            verify=settings.sentinel_verify_tls,
            follow_redirects=True,
            auth=_auth(),
        ) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        logger.error("sentinel.grid.fetch.timeout", url=url, error=str(exc))
        raise SentinelError(f"Sentinel catalogue timed out: {exc}") from exc
    except httpx.HTTPStatusError as exc:
        logger.error(
            "sentinel.grid.fetch.http_error", url=url, status=exc.response.status_code
        )
        raise SentinelError(
            f"Sentinel catalogue HTTP {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        logger.error("sentinel.grid.fetch.network", url=url, error=str(exc))
        raise SentinelError(f"Sentinel catalogue unreachable: {exc}") from exc
    except ValueError as exc:
        logger.error("sentinel.grid.fetch.invalid_json", url=url)
        raise SentinelError("Sentinel catalogue returned non-JSON") from exc

    records = extract_records(payload)
    logger.info("sentinel.grid.fetch.ok", url=url, count=len(records))
    return records


def probe_grid() -> bool:
    """Lightweight reachability check for /health and /api/status."""
    settings = get_settings()
    try:
        with httpx.Client(
            timeout=httpx.Timeout(min(settings.sentinel_timeout_seconds, 5.0)),
            verify=settings.sentinel_verify_tls,
            follow_redirects=True,
            auth=_auth(),
        ) as client:
            return client.get(settings.sentinel_catalogue_url).status_code < 500
    except httpx.HTTPError:
        return False

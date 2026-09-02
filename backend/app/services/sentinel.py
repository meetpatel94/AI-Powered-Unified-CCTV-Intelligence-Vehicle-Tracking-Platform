"""Gujarat Police Sentinel camera catalogue client.

The official dynamic source is GET/POST {SENTINEL_BASE_URL}{SENTINEL_INGEST_PATH}
(typically https://sentinel.gujarat.gov.in/api/ingest). Camera stream URLs are
never hard-coded; they are parsed from the catalogue response and stored in the
Camera Registry. RTSP is the primary AI/inference feed.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# Alternate keys used by catalogue payloads so we can normalize without
# assuming a single vendor schema.
_ID_KEYS = ("camera_id", "cameraId", "id", "cam_id", "cameraID", "code")
_DEPT_KEYS = ("department", "dept", "owning_department", "org")
_LOC_KEYS = ("location_name", "location", "locationName", "name", "site", "address")
_LAT_KEYS = ("latitude", "lat", "y")
_LON_KEYS = ("longitude", "lng", "lon", "long", "x")
_TYPE_KEYS = ("camera_type", "cameraType", "type", "category")
_CODEC_KEYS = ("codec", "video_codec", "encoding")
_RES_KEYS = ("resolution", "res")
_STATUS_KEYS = ("status", "state", "health")
_CONN_KEYS = ("connectivity", "connection", "network_status")
_VMS_KEYS = ("vms", "vms_name", "video_management_system")
_OWNER_KEYS = ("owner", "owner_name", "agency")
_RTSP_KEYS = ("rtsp_url", "rtspUrl", "rtsp", "stream_url", "streamUrl", "url")
_WEBRTC_KEYS = ("webrtc_url", "webrtcUrl", "webrtc", "whep")
_HLS_KEYS = ("hls_url", "hlsUrl", "hls", "m3u8")


class SentinelError(Exception):
    """Raised when the Sentinel catalogue cannot be fetched or parsed."""


def _first(record: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
        # nested stream block
        streams = record.get("streams") or record.get("urls") or {}
        if isinstance(streams, dict) and key in streams and streams[key] not in (None, ""):
            return streams[key]
    return None


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_camera(record: dict[str, Any]) -> dict[str, Any] | None:
    """Map a raw catalogue record onto Camera Registry columns."""
    camera_id = _to_str(_first(record, _ID_KEYS))
    if not camera_id:
        return None
    return {
        "camera_id": camera_id,
        "department": _to_str(_first(record, _DEPT_KEYS)),
        "location_name": _to_str(_first(record, _LOC_KEYS)),
        "latitude": _to_float(_first(record, _LAT_KEYS)),
        "longitude": _to_float(_first(record, _LON_KEYS)),
        "camera_type": _to_str(_first(record, _TYPE_KEYS)),
        "codec": _to_str(_first(record, _CODEC_KEYS)),
        "resolution": _to_str(_first(record, _RES_KEYS)),
        "status": _to_str(_first(record, _STATUS_KEYS)),
        "connectivity": _to_str(_first(record, _CONN_KEYS)),
        "vms": _to_str(_first(record, _VMS_KEYS)),
        "owner": _to_str(_first(record, _OWNER_KEYS)),
        "rtsp_url": _to_str(_first(record, _RTSP_KEYS)),
        "webrtc_url": _to_str(_first(record, _WEBRTC_KEYS)),
        "hls_url": _to_str(_first(record, _HLS_KEYS)),
    }


def extract_records(payload: Any) -> list[dict[str, Any]]:
    """Validate and extract camera dicts from a Sentinel JSON payload."""
    if payload is None:
        raise SentinelError("Empty catalogue response")
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        for key in ("cameras", "data", "items", "results", "catalogue", "records"):
            value = payload.get(key)
            if isinstance(value, list):
                records = value
                break
        else:
            # Single camera object
            if any(k in payload for k in _ID_KEYS):
                records = [payload]
            else:
                raise SentinelError("Catalogue JSON did not contain a camera list")
    else:
        raise SentinelError(f"Unsupported catalogue payload type: {type(payload).__name__}")

    out: list[dict[str, Any]] = []
    for item in records:
        if isinstance(item, dict):
            out.append(item)
    if not out and records:
        raise SentinelError("Catalogue entries were not objects")
    return out


def _auth_headers() -> dict[str, str]:
    settings = get_settings()
    headers = {
        "Accept": "application/json",
        "User-Agent": "GP-CCTV-Intelligence/0.1",
    }
    if settings.sentinel_api_key:
        headers["Authorization"] = f"Bearer {settings.sentinel_api_key}"
        headers["X-API-Key"] = settings.sentinel_api_key
    if settings.sentinel_api_secret:
        headers["X-API-Secret"] = settings.sentinel_api_secret
    return headers


def fetch_catalogue() -> list[dict[str, Any]]:
    """GET the official /api/ingest catalogue. Raises SentinelError on failure."""
    settings = get_settings()
    url = settings.sentinel_ingest_url
    timeout = httpx.Timeout(settings.sentinel_timeout_seconds)
    logger.info("sentinel.fetch.start", url=url, timeout=settings.sentinel_timeout_seconds)
    try:
        with httpx.Client(timeout=timeout, verify=settings.sentinel_verify_tls, follow_redirects=True) as client:
            response = client.get(url, headers=_auth_headers())
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        logger.error("sentinel.fetch.timeout", url=url, error=str(exc))
        raise SentinelError(f"Sentinel catalogue timed out after {settings.sentinel_timeout_seconds}s") from exc
    except httpx.HTTPStatusError as exc:
        logger.error("sentinel.fetch.http_error", status=exc.response.status_code, url=url)
        raise SentinelError(f"Sentinel catalogue HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        logger.error("sentinel.fetch.network", url=url, error=str(exc))
        raise SentinelError(f"Sentinel catalogue unreachable: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        logger.error("sentinel.fetch.invalid_json", url=url)
        raise SentinelError("Sentinel catalogue returned non-JSON") from exc

    records = extract_records(payload)
    logger.info("sentinel.fetch.ok", url=url, count=len(records))
    return records


def probe_catalogue() -> bool:
    """Lightweight connectivity check used by /health and /api/status."""
    settings = get_settings()
    timeout = httpx.Timeout(min(settings.sentinel_timeout_seconds, 5.0))
    try:
        with httpx.Client(timeout=timeout, verify=settings.sentinel_verify_tls, follow_redirects=True) as client:
            response = client.get(settings.sentinel_ingest_url, headers=_auth_headers())
            return response.status_code < 500
    except httpx.HTTPError:
        return False

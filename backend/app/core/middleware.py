"""Security and rate-limiting middleware.

* ``SecurityHeadersMiddleware`` — adds conservative security response headers
  to every response (no server banner leakage, no MIME sniffing, referrer
  policy, frame protection for the command centre).
* ``RateLimitMiddleware`` — a fixed-window, per-client-IP in-memory limiter
  applied to sensitive endpoints (login/token, control/state-changing POSTs).
  It deliberately uses NO external store so the platform stays simple; for a
  multi-replica deployment replace the in-process dict with a shared store.

The limiter fails OPEN when rate limiting is disabled or on unexpected state;
it never takes the API down. 429 responses carry ``Retry-After``.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings
from app.services.metrics import errors as error_ring

logger = structlog.get_logger(__name__)

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-XSS-Protection": "0",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    # The dashboard is same-origin behind the reverse proxy; HSTS is only
    # meaningful over HTTPS but is safe to emit in all production setups.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for key, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(key, value)
        # Don't advertise the framework (uvicorn sets 'server').
        if "server" in response.headers:
            del response.headers["server"]
        return response


# --- Rate limiting --------------------------------------------------------- #
# Endpoint "buckets": path-prefix → per-minute limit. The most specific match
# (longest prefix) wins.
def _bucket_for(method: str, path: str) -> tuple[str, int] | None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return None
    write = method.upper() in ("POST", "PUT", "PATCH", "DELETE")

    # Authentication / token endpoints — tightest limits.
    if path.endswith("/auth/login"):
        return ("login", settings.rate_limit_login_per_minute)
    if path.endswith("/auth/refresh") or path.endswith("/auth/logout"):
        return ("token", settings.rate_limit_token_per_minute)
    if "/users" in path and write:
        return ("token", settings.rate_limit_token_per_minute)
    # State-changing control endpoints.
    if write and (
        "/streams/" in path
        or "/pipeline/" in path
        or "/stream/restart" in path
        or "/stream/refresh" in path
        or "/ingest" in path
        or "/watchlist" in path
        or "/alerts/" in path
        or "/reports/generate" in path
    ):
        return ("write", settings.rate_limit_write_per_minute)
    if write:
        return ("write", settings.rate_limit_write_per_minute)
    return ("generic", settings.rate_limit_generic_per_minute)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *args, **kwargs) -> None:
        super().__init__(app, *args, **kwargs)
        # bucket_key -> ip -> deque[timestamps]
        self._hits: dict[str, dict[str, Deque[float]]] = defaultdict(dict)
        self._lock = threading.Lock()
        self._window = 60.0

    def _client_id(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
        return request.client.host if request.client else "unknown"

    def _check(self, bucket: str, limit: int, client: str) -> tuple[bool, float]:
        now = time.monotonic()
        cutoff = now - self._window
        with self._lock:
            ip_map = self._hits[bucket]
            hits = ip_map.get(client)
            if hits is None:
                hits = deque()
                ip_map[client] = hits
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= limit:
                retry = self._window - (now - hits[0])
                return False, max(1.0, retry)
            hits.append(now)
            return True, 0.0

    async def dispatch(self, request: Request, call_next) -> Response:
        # Don't rate-limit the realtime WebSocket upgrade or health probes.
        path = request.url.path
        if request.scope.get("type") == "websocket" or path in (
            "/health",
            "/api/system/health",
            "/api/system/readiness",
        ):
            return await call_next(request)

        bucket = _bucket_for(request.method, path)
        if bucket is not None:
            name, limit = bucket
            if limit > 0:
                client = self._client_id(request)
                allowed, retry = self._check(name, limit, client)
                if not allowed:
                    logger.warning(
                        "rate_limit.exceeded",
                        bucket=name,
                        ip=client,
                        path=path,
                        method=request.method,
                    )
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": "Rate limit exceeded — please retry shortly.",
                            "retry_after_seconds": int(retry),
                        },
                        headers={"Retry-After": str(int(retry))},
                    )
        return await call_next(request)


class ErrorCaptureMiddleware(BaseHTTPMiddleware):
    """Record 5xx responses (message only — never bodies/headers/secrets) into
    the metrics error ring for /api/system/metrics."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        try:
            if response.status_code >= 500:
                error_ring.add(
                    "http",
                    f"{request.method} {request.url.path} -> {response.status_code}",
                    path=request.url.path,
                )
        except Exception:
            pass
        return response

"""Structured logging setup with mandatory secret redaction.

Every log record passes through :func:`redact_processor` before rendering, so
credentials embedded in RTSP/HTTP URLs, bearer tokens, JWTs and
password/secret/api_key fields are masked no matter which module logged them.
"""

import logging
import sys
from typing import Any

import structlog

from app.core.config import get_settings
from app.services.audit import redact_text, sanitize_context

_SECRET_KEY_HINTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "jwt",
    "rtsp_url",
    "webrtc_url",
    "hls_url",
    "stream_url",
)


def redact_processor(_logger: Any, _name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    """Mask secrets anywhere in the structured event (keys + values)."""
    clean: dict[str, Any] = {}
    for key, value in event_dict.items():
        if isinstance(value, dict):
            clean[key] = sanitize_context(value)
        elif isinstance(value, (list, tuple)):
            clean[key] = [redact_text(v) if isinstance(v, str) else v for v in value][:100]
        elif isinstance(value, str):
            lk = str(key).lower()
            if any(hint in lk for hint in _SECRET_KEY_HINTS):
                clean[key] = "***REDACTED***"
            else:
                clean[key] = redact_text(value)
        else:
            clean[key] = value
    return clean


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_processor,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer()
            if settings.app_env == "development"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

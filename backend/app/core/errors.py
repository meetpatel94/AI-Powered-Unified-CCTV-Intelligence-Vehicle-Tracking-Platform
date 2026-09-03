"""Centralized error handling — uniform JSON error envelopes.

Every unhandled exception is logged (structured) with an error id and returned
as a JSON ``{"detail": ..., "error_id": ...}`` response, so the dashboard never
gets an HTML traceback and operators can quote the error id.
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logger = structlog.get_logger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = []
        for error in exc.errors():
            location = ".".join(str(p) for p in error.get("loc", []))
            details.append(f"{location}: {error.get('msg')}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "; ".join(details) or "Validation error", "errors": exc.errors()},
        )

    @app.exception_handler(SQLAlchemyError)
    async def _database_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        error_id = uuid.uuid4().hex[:12]
        logger.error(
            "api.database_error",
            error_id=error_id,
            path=request.url.path,
            method=request.method,
            error=str(exc.__cause__ or exc),
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Database error — please retry", "error_id": error_id},
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        error_id = uuid.uuid4().hex[:12]
        logger.exception(
            "api.unhandled_error",
            error_id=error_id,
            path=request.url.path,
            method=request.method,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error", "error_id": error_id},
        )

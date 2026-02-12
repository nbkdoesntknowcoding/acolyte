"""Global exception handlers for the Acolyte API.

Converts all exceptions into the standard error envelope:
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable message",
        "details": {...} | [...] | null,
        "timestamp": "2026-02-10T12:00:00Z"
    }
}

Handler registration order in main.py:
1. AcolyteException — catches all our business exceptions
2. RequestValidationError — catches Pydantic validation errors
3. IntegrityError — catches SQLAlchemy constraint violations that slip past services
4. HTTPException — catches raw HTTPExceptions from FastAPI internals
5. Exception — catches everything else (unhandled errors)

Since AcolyteException does NOT inherit from HTTPException, there is no
overlap between handlers 1 and 4. FastAPI selects handlers based on
exception class specificity (MRO walk).
"""

import logging
import traceback
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.shared.exceptions import AcolyteException, RateLimitException, UnauthorizedException

logger = logging.getLogger(__name__)

# Maps HTTP status codes to generic error codes.
# Used by the HTTPException handler to wrap raw HTTPExceptions from
# FastAPI internals (HTTPBearer, auth middleware, etc.).
_STATUS_TO_CODE: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
}


def _error_response(
    status_code: int,
    code: str,
    message: str,
    details: dict | list | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Build a standard error JSONResponse."""
    body = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }
    return JSONResponse(status_code=status_code, content=body, headers=headers)


async def acolyte_exception_handler(request: Request, exc: AcolyteException) -> JSONResponse:
    """Handle all AcolyteException subclasses.

    These are our business exceptions (NotFoundException, DuplicateException, etc.).
    They carry status_code, error_code, message, and optional details.
    """
    headers = None

    if isinstance(exc, RateLimitException):
        headers = {"Retry-After": str(exc.retry_after)}
    elif isinstance(exc, UnauthorizedException):
        headers = {"WWW-Authenticate": "Bearer"}

    return _error_response(
        status_code=exc.status_code,
        code=exc.error_code,
        message=exc.message,
        details=exc.details,
        headers=headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic RequestValidationError (malformed request body/query/path).

    Converts Pydantic's error list into our standard format with field-level
    details for the frontend to display inline validation errors.
    """
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })

    return _error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="Request validation failed",
        details=errors,
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Safety net for SQLAlchemy IntegrityError that slips past service-level handling.

    Services SHOULD catch IntegrityError locally (they know the context — which
    entity and field caused the conflict). This handler catches any that leak
    through with a generic message.
    """
    logger.warning(
        "Unhandled IntegrityError on %s %s (should be caught in service layer): %s",
        request.method,
        request.url.path,
        str(exc.orig) if exc.orig else str(exc),
    )
    return _error_response(
        status_code=409,
        code="DUPLICATE_ENTITY",
        message="A record with this value already exists",
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Wrap raw HTTPExceptions from FastAPI internals in the standard error format.

    This catches HTTPExceptions raised by:
    - HTTPBearer(auto_error=True) → 403 when no Bearer token
    - Auth dependencies → 401, 403, 500
    - Permission dependencies → 400, 403, 503
    - File routes → 400, 403, 413, 500
    - Any other middleware or FastAPI internal
    """
    code = _STATUS_TO_CODE.get(exc.status_code, "UNKNOWN_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)

    headers = dict(exc.headers) if exc.headers else None

    return _error_response(
        status_code=exc.status_code,
        code=code,
        message=message,
        headers=headers,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last resort: catch any unhandled exception.

    Logs the full traceback for debugging but returns a generic message
    to the client — never leak stack traces or internal details.
    """
    logger.error(
        "Unhandled exception on %s %s: %s\n%s",
        request.method,
        request.url.path,
        str(exc),
        traceback.format_exc(),
    )
    return _error_response(
        status_code=500,
        code="INTERNAL_ERROR",
        message="An unexpected error occurred",
    )

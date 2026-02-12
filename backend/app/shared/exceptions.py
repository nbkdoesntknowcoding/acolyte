"""Custom exceptions for the Acolyte platform.

Hierarchy:
    AcolyteException (base — does NOT inherit HTTPException)
    ├── NotFoundException (404)
    ├── DuplicateException (409)
    ├── ValidationException (422)
    ├── ForbiddenException (403)
    ├── UnauthorizedException (401)
    ├── TenantMismatchException (403)
    ├── RateLimitException (429)
    └── ExternalServiceException (502)

Design:
- AcolyteException does NOT inherit from HTTPException. This keeps
  handler dispatch clean: our handler catches AcolyteException, a
  separate handler wraps raw HTTPExceptions from FastAPI internals
  (HTTPBearer, auth middleware, etc.) into the same response format.

- Every exception carries: status_code, error_code (string constant),
  message (human-readable), details (optional dict/list for extra context).

- The global error handler in error_handlers.py converts these into
  the standard API error envelope:
  {"error": {"code": "...", "message": "...", "details": ..., "timestamp": "..."}}
"""


class AcolyteException(Exception):
    """Base exception for all Acolyte business logic errors.

    Subclasses set status_code and error_code as class-level defaults.
    Callers provide message and optional details.
    """

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str = "An unexpected error occurred",
        details: dict | list | None = None,
    ):
        self.message = message
        self.details = details
        super().__init__(message)


class NotFoundException(AcolyteException):
    """Entity not found (or hidden by RLS)."""

    status_code = 404
    error_code = "NOT_FOUND"

    def __init__(self, entity_type: str, entity_id: str = ""):
        message = f"{entity_type} not found" if not entity_id else f"{entity_type} {entity_id} not found"
        super().__init__(
            message=message,
            details={"entity_type": entity_type, "entity_id": entity_id} if entity_id else None,
        )


class DuplicateException(AcolyteException):
    """Unique constraint violation."""

    status_code = 409
    error_code = "DUPLICATE_ENTITY"

    def __init__(self, entity_type: str, field: str = "", value: str = ""):
        if field and value:
            message = f"{entity_type} with {field}='{value}' already exists"
        elif field:
            message = f"{entity_type} with duplicate {field}"
        else:
            message = f"{entity_type} already exists"
        super().__init__(
            message=message,
            details={"entity_type": entity_type, "field": field, "value": value} if field else None,
        )


class ValidationException(AcolyteException):
    """Business logic validation error (distinct from Pydantic schema validation)."""

    status_code = 422
    error_code = "VALIDATION_ERROR"

    def __init__(self, message: str = "Validation failed", errors: list | None = None):
        super().__init__(message=message, details=errors)


class ForbiddenException(AcolyteException):
    """User is authenticated but not authorized for this action."""

    status_code = 403
    error_code = "FORBIDDEN"

    def __init__(self, message: str = "Permission denied"):
        super().__init__(message=message)


class UnauthorizedException(AcolyteException):
    """User is not authenticated or token is invalid."""

    status_code = 401
    error_code = "UNAUTHORIZED"

    def __init__(self, message: str = "Authentication required"):
        super().__init__(message=message)


class TenantMismatchException(AcolyteException):
    """Cross-tenant access attempt detected."""

    status_code = 403
    error_code = "TENANT_MISMATCH"

    def __init__(self):
        super().__init__(message="Access denied: resource belongs to a different tenant")


class RateLimitException(AcolyteException):
    """Too many requests."""

    status_code = 429
    error_code = "RATE_LIMITED"

    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(
            message=f"Rate limit exceeded. Retry after {retry_after} seconds",
            details={"retry_after": retry_after},
        )


class ExternalServiceException(AcolyteException):
    """External service (AI, Permify, HMIS, etc.) is unavailable or errored."""

    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"

    def __init__(self, service_name: str, message: str = ""):
        full_message = f"{service_name} service error" if not message else f"{service_name}: {message}"
        super().__init__(
            message=full_message,
            details={"service": service_name},
        )


# ---------------------------------------------------------------------------
# Backward compatibility aliases (deprecated — use new names in new code)
#
# These allow existing imports to keep working:
#   from app.shared.exceptions import DuplicateError, ResourceNotFoundError
# Signatures are identical (same positional args), so raise statements
# work unchanged. Remove these once all call sites are migrated.
# ---------------------------------------------------------------------------

DuplicateError = DuplicateException
ResourceNotFoundError = NotFoundException
TenantNotFoundError = NotFoundException
PermissionDeniedError = ForbiddenException
AIServiceError = ExternalServiceException

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

Backward-compat aliases at the bottom maintain existing imports.
"""

from fastapi import HTTPException, status


# ---------------------------------------------------------------------------
# Base exception
# ---------------------------------------------------------------------------

class AcolyteException(Exception):
    """Base exception for all Acolyte business logic errors.

    Does NOT inherit from HTTPException — global exception handlers
    convert these to the standard error envelope.
    """

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str = "An internal error occurred", details: dict | None = None):
        self.message = message
        self.details = details
        super().__init__(message)


# ---------------------------------------------------------------------------
# Specific exceptions
# ---------------------------------------------------------------------------

class NotFoundException(AcolyteException):
    status_code = 404
    error_code = "NOT_FOUND"

    def __init__(self, entity_type: str, entity_id: str = ""):
        message = (
            f"{entity_type} not found"
            if not entity_id
            else f"{entity_type} {entity_id} not found"
        )
        super().__init__(message)


class DuplicateException(AcolyteException):
    status_code = 409
    error_code = "DUPLICATE_ENTITY"

    def __init__(self, entity_type: str, field: str = "", value: str = ""):
        if field and value:
            message = f"{entity_type} with {field}='{value}' already exists"
        else:
            message = f"Duplicate {entity_type}"
        super().__init__(message)


class ValidationException(AcolyteException):
    status_code = 422
    error_code = "VALIDATION_ERROR"

    def __init__(self, message: str = "Validation error", errors: list | None = None):
        super().__init__(message, details={"errors": errors} if errors else None)


class ForbiddenException(AcolyteException):
    status_code = 403
    error_code = "FORBIDDEN"

    def __init__(self, message: str = "Permission denied"):
        super().__init__(message)


class UnauthorizedException(AcolyteException):
    status_code = 401
    error_code = "UNAUTHORIZED"

    def __init__(self, message: str = "Authentication required"):
        super().__init__(message)


class TenantMismatchException(AcolyteException):
    status_code = 403
    error_code = "TENANT_MISMATCH"

    def __init__(self):
        super().__init__("Access denied: tenant mismatch")


class RateLimitException(AcolyteException):
    status_code = 429
    error_code = "RATE_LIMITED"

    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(f"Rate limited. Retry after {retry_after} seconds")


class ExternalServiceException(AcolyteException):
    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"

    def __init__(self, service_name: str, message: str = ""):
        full_message = (
            f"External service error: {service_name}"
            if not message
            else f"{service_name}: {message}"
        )
        super().__init__(full_message, details={"service": service_name})


# ---------------------------------------------------------------------------
# Backward-compatible aliases (existing imports continue working)
# ---------------------------------------------------------------------------

class TenantNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="College (tenant) not found",
        )


class PermissionDeniedError(HTTPException):
    def __init__(self, action: str = ""):
        detail = f"Permission denied: {action}" if action else "Permission denied"
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class ResourceNotFoundError(HTTPException):
    def __init__(self, resource: str, resource_id: str = ""):
        detail = f"{resource} not found" if not resource_id else f"{resource} {resource_id} not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


# Aliases for the old names → new hierarchy
DuplicateError = DuplicateException
AIServiceError = ExternalServiceException

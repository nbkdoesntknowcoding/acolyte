"""Custom exceptions for the Acolyte platform."""

from fastapi import HTTPException, status


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


class ValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


class DuplicateError(HTTPException):
    def __init__(self, resource: str, field: str = "", value: str = ""):
        detail = f"{resource} already exists"
        if field and value:
            detail = f"{resource} with {field}='{value}' already exists"
        elif field:
            detail = f"{resource} with duplicate {field}"
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )


class AIServiceError(HTTPException):
    def __init__(self, detail: str = "AI service unavailable"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )

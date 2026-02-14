"""Shared Pydantic schemas used across all engines.

Re-exports all base schemas so existing imports like
`from app.shared.schemas import PaginatedResponse` continue to work.
"""

from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, Field


class HealthCheck(BaseModel):
    status: str
    service: str
    timestamp: str
    version: str


# ---------------------------------------------------------------------------
# Standard error envelope (for OpenAPI documentation)
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    """The standard error object returned by all error responses."""

    code: str = Field(..., examples=["NOT_FOUND"])
    message: str = Field(..., examples=["Department not found"])
    details: dict | list | None = None
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


class ErrorResponse(BaseModel):
    """Top-level error envelope."""

    error: ErrorDetail


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20


# ---------------------------------------------------------------------------
# Tenant context
# ---------------------------------------------------------------------------

class TenantContext(BaseModel):
    """Injected into every request via middleware."""

    user_id: UUID
    college_id: UUID
    role: str
    email: str | None = None

"""Shared Pydantic schemas used across all engines."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class HealthCheck(BaseModel):
    status: str
    service: str
    timestamp: str
    version: str


class ErrorResponse(BaseModel):
    detail: str
    code: str = "error"
    timestamp: datetime = None

    def __init__(self, **data):
        if data.get("timestamp") is None:
            data["timestamp"] = datetime.utcnow()
        super().__init__(**data)


class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20


class TenantContext(BaseModel):
    """Injected into every request via middleware."""
    user_id: UUID
    college_id: UUID
    role: str
    email: str | None = None

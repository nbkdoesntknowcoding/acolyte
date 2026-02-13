"""Base models for all engines.

TenantModel: Every tenant-scoped table inherits from this.
Provides: id (UUID), college_id (UUID, FK, indexed), created_at, updated_at.
RLS enforcement via college_id column.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""
    pass


class TenantModel(Base):
    """Abstract base for all tenant-scoped models.

    EVERY table that stores tenant data MUST inherit from this.
    The college_id column enables Row-Level Security.
    """
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = Column(
        UUID(as_uuid=True),
        ForeignKey("colleges.id"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        onupdate=text("NOW()"),
        nullable=False,
    )


class AuditLog(TenantModel):
    """Immutable append-only audit trail.

    Partitioned by month via pg_partman for performance.
    """
    __tablename__ = "audit_log"

    user_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)  # "create", "update", "delete", "read"
    entity_type = Column(String(100), nullable=False)  # "student", "faculty", "assessment"
    entity_id = Column(UUID(as_uuid=True))
    changes = Column(JSONB)  # {field: {old: x, new: y}}
    ip_address = Column(String(45))
    user_agent = Column(Text)

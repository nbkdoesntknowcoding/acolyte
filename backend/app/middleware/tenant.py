"""Multi-tenant middleware.

Sets PostgreSQL session variable for RLS enforcement.
Every request with a college_id gets tenant isolation via Row-Level Security.
"""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_tenant_context(session: AsyncSession, college_id: UUID) -> None:
    """Set the RLS context variable for the current database session.

    This MUST be called before any tenant-scoped query.
    PostgreSQL RLS policies use: current_setting('app.current_college_id')
    """
    await session.execute(
        text(f"SET app.current_college_id = '{str(college_id)}'")
    )


async def set_superadmin_context(session: AsyncSession) -> None:
    """Set superadmin bypass for cross-tenant operations.

    Use ONLY for analytics, support, and platform-admin operations.
    """
    await session.execute(text("SET app.is_superadmin = 'true'"))

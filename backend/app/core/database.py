"""Database configuration for Neon PostgreSQL.

Uses NullPool because Neon provides its own PgBouncer connection pooling.
statement_cache_size=0 is REQUIRED for PgBouncer compatibility.

Provides both async (FastAPI) and sync (Celery) session factories.
"""

from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Async engine + session (FastAPI request handlers)
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,  # REQUIRED — Neon has its own PgBouncer
    connect_args={"statement_cache_size": 0},  # REQUIRED for PgBouncer
    echo=settings.APP_DEBUG,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ---------------------------------------------------------------------------
# Sync engine + session (Celery background tasks)
# ---------------------------------------------------------------------------
_sync_url = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
)

sync_engine = create_engine(
    _sync_url,
    poolclass=NullPool,  # REQUIRED — Neon PgBouncer
    echo=settings.APP_DEBUG,
)

sync_session_factory = sessionmaker(
    sync_engine,
    class_=Session,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that provides a database session.

    Usage:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_tenant_db(college_id: UUID) -> AsyncSession:
    """Get a database session with tenant RLS context set.

    Usage:
        @router.get("/items")
        async def list_items(
            college_id: UUID = Depends(get_college_id),
            db: AsyncSession = Depends(get_db),
        ):
            await set_tenant_context(db, college_id)
            ...
    """
    async with async_session_factory() as session:
        try:
            await session.execute(
                text(f"SET app.current_college_id = '{str(college_id)}'")
            )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

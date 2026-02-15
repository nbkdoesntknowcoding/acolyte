"""Alembic environment configuration.

Imports all engine models so autogenerate detects them.
Uses async engine for Neon PostgreSQL.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import get_settings
from app.shared.models import Base

# Import ALL shared models so Alembic detects them
from app.shared.models.device_trust import *  # noqa: F401, F403
from app.shared.models.qr import *  # noqa: F401, F403
from app.shared.models.dynamic_roles import *  # noqa: F401, F403
from app.shared.models.committee import *  # noqa: F401, F403

# Import ALL engine models so Alembic detects them
from app.engines.admin.models import *  # noqa: F401, F403
from app.engines.faculty.models import *  # noqa: F401, F403
from app.engines.compliance.models import *  # noqa: F401, F403
from app.engines.student.models import *  # noqa: F401, F403
from app.engines.integration.models import *  # noqa: F401, F403
from app.engines.ai.models import *  # noqa: F401, F403

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

settings = get_settings()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL scripts)."""
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async mode for Neon PostgreSQL.

    Retries connection up to 3 times to handle Neon serverless cold-start
    (can take 5-10s to wake from idle, causing CancelledError on first attempt).
    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    max_retries = 3
    for attempt in range(max_retries):
        try:
            connectable = async_engine_from_config(
                configuration,
                prefix="sqlalchemy.",
                poolclass=pool.NullPool,
                connect_args={
                    "timeout": 30,
                    "statement_cache_size": 0,  # Required for Neon PgBouncer
                },
            )

            async with connectable.connect() as connection:
                await connection.run_sync(do_run_migrations)

            await connectable.dispose()
            return  # Success — exit retry loop
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 5 * (attempt + 1)
                print(f"Migration connection attempt {attempt + 1}/{max_retries} failed: {e}")
                print(f"Retrying in {wait}s (Neon cold-start)...")
                await asyncio.sleep(wait)
            else:
                raise


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

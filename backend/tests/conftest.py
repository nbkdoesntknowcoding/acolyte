"""Test fixtures for the Acolyte platform.

Provides: async test client, test tenants, RLS verification helpers.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_COLLEGE_A_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
TEST_COLLEGE_B_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


@pytest_asyncio.fixture
async def client():
    """Async test client for FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def college_a_id():
    return TEST_COLLEGE_A_ID


@pytest.fixture
def college_b_id():
    return TEST_COLLEGE_B_ID

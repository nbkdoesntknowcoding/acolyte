"""Authentication & authorization dependencies for FastAPI routes.

Usage in route handlers:

    from app.dependencies.auth import get_current_user, require_role
    from app.middleware.clerk_auth import CurrentUser, UserRole

    # Any authenticated user
    @router.get("/profile")
    async def profile(user: CurrentUser = Depends(get_current_user)):
        return {"user_id": user.user_id, "role": user.role}

    # Only faculty or above
    @router.get("/assessments")
    async def list_assessments(user: CurrentUser = Depends(require_faculty_or_above)):
        ...

    # Custom role check
    @router.post("/grades")
    async def submit_grades(
        user: CurrentUser = Depends(require_role(UserRole.FACULTY, UserRole.HOD)),
    ):
        ...
"""

import logging
from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.database import get_db
from app.middleware.clerk_auth import (
    CurrentUser,
    UserRole,
    extract_current_user,
    verify_clerk_jwt,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bearer token extraction
# ---------------------------------------------------------------------------

# auto_error=False so we can differentiate 401 vs optional
_bearer_scheme = HTTPBearer(auto_error=False)
_bearer_scheme_required = HTTPBearer(auto_error=True)


# ---------------------------------------------------------------------------
# get_current_user — the primary auth dependency
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme_required),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    """Validate the Bearer token and return the authenticated user.

    Raises:
        HTTPException 401: Missing/invalid/expired token.
        HTTPException 403: Token valid but user has no organization (tenant).
    """
    token = credentials.credentials

    try:
        payload = await verify_clerk_jwt(token, settings)
    except JWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValueError as exc:
        # JWKS config issue
        logger.error("Auth config error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service misconfigured",
        )

    try:
        user = extract_current_user(payload)
    except ValueError as exc:
        # Missing org_id or invalid org_id format
        logger.warning("User context extraction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    return user


# ---------------------------------------------------------------------------
# get_optional_user — for public endpoints that benefit from auth context
# ---------------------------------------------------------------------------

async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    """Return CurrentUser if a valid Bearer token is present, else None.

    Use this for public endpoints where auth is optional but you want
    to personalize the response for authenticated users.
    """
    if credentials is None:
        return None

    try:
        payload = await verify_clerk_jwt(credentials.credentials, settings)
        return extract_current_user(payload)
    except (JWTError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Role-based authorization dependencies
# ---------------------------------------------------------------------------

def require_role(*roles: UserRole) -> Callable:
    """Create a dependency that checks the user has one of the specified roles.

    Usage:
        @router.post("/items")
        async def create_item(
            user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.HOD)),
        ):
            ...
    """
    allowed = set(roles)

    async def _check_role(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorized. Required: {', '.join(r.value for r in allowed)}",
            )
        return user

    return _check_role


# Convenience shortcuts for common role checks

require_college_admin = require_role(
    UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT,
)
"""Dependency: user must be an admin, dean, or management."""

require_faculty_or_above = require_role(
    UserRole.FACULTY, UserRole.HOD, UserRole.DEAN, UserRole.ADMIN,
)
"""Dependency: user must be faculty, HOD, dean, or admin."""

require_compliance = require_role(
    UserRole.COMPLIANCE_OFFICER, UserRole.DEAN, UserRole.ADMIN, UserRole.MANAGEMENT,
)
"""Dependency: user must have compliance access."""

require_student = require_role(UserRole.STUDENT)
"""Dependency: user must be a student."""


# ---------------------------------------------------------------------------
# Tenant-scoped database session — sets RLS context from CurrentUser
# ---------------------------------------------------------------------------

async def get_tenant_db(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncSession:
    """Get a database session with RLS tenant context set from the authenticated user.

    This is the primary dependency for any route that reads/writes tenant data.
    It sets `app.current_college_id` on the PostgreSQL session so RLS policies
    filter rows to only the user's college.

    Usage:
        @router.get("/students")
        async def list_students(
            user: CurrentUser = Depends(get_current_user),
            db: AsyncSession = Depends(get_tenant_db),
        ):
            result = await db.execute(select(Student))  # RLS-filtered
            ...
    """
    # NOTE: SET does not support parameterized queries in asyncpg ($1 syntax).
    # We must use text() with string interpolation. The college_id is a UUID from
    # a verified JWT, so injection is not a concern here.
    await db.execute(
        text(f"SET app.current_college_id = '{user.college_id}'")
    )
    return db


async def get_superadmin_db(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncSession:
    """Get a database session with superadmin RLS bypass.

    Only for platform-level operations (analytics, support, cross-tenant reports).
    Requires MANAGEMENT role.
    """
    if user.role != UserRole.MANAGEMENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access requires management role",
        )
    await db.execute(text("SET app.is_superadmin = 'true'"))
    return db


# ---------------------------------------------------------------------------
# College ID extraction — for backward compat with existing routes
# ---------------------------------------------------------------------------

async def get_college_id(
    user: CurrentUser = Depends(get_current_user),
) -> UUID:
    """Extract the college_id (tenant ID) from the authenticated user."""
    return user.college_id

"""Platform admin authentication dependencies.

Platform admins are Acolyte team members identified by either:
1. A special Clerk metadata flag (public_metadata.is_platform_admin = true)
2. Membership in the platform admin Clerk organization (org_slug match)

These are NOT college users — they manage the B2B platform itself.
"""

import logging
import os
import uuid as uuid_mod
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.database import get_db
from app.middleware.clerk_auth import verify_clerk_jwt

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=True)

# Platform admin org slug — set via env var, default "acolyte-platform"
_PLATFORM_ADMIN_ORG_SLUG = os.environ.get(
    "PLATFORM_ADMIN_ORG_SLUG", "acolyte-platform"
)


# ---------------------------------------------------------------------------
# Platform admin user model
# ---------------------------------------------------------------------------


class PlatformAdminUser(BaseModel):
    """Authenticated platform admin context.

    Lighter than CurrentUser — platform admins don't belong to a college.
    """

    user_id: str = Field(description="Clerk user ID (user_xxx)")
    email: str | None = None
    full_name: str | None = None

    @property
    def actor_uuid(self) -> UUID:
        """Deterministic UUID derived from Clerk user ID.

        Clerk user IDs (``user_xxx``) aren't UUIDs, so we derive one
        deterministically using UUID5 for storage in UUID columns
        (PlatformAuditLog.actor_id, License.created_by, etc.).
        """
        return uuid_mod.uuid5(uuid_mod.NAMESPACE_URL, self.user_id)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------


async def require_platform_admin(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> PlatformAdminUser:
    """Verify the authenticated user is a platform admin.

    Checks (in order):
    1. JWT must be valid (Clerk RS256 verification)
    2. ``public_metadata.is_platform_admin == true``, OR
    3. ``org_slug`` matches ``PLATFORM_ADMIN_ORG_SLUG`` env var

    Returns 401 for invalid tokens, 403 for non-admins.
    """
    token = credentials.credentials

    try:
        payload = await verify_clerk_jwt(token, settings)
    except JWTError as exc:
        logger.warning("Platform admin JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValueError as exc:
        logger.error("Auth config error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service misconfigured",
        )

    # Check platform admin status via metadata or org membership
    metadata = payload.get("public_metadata", {}) or {}
    org_slug = payload.get("org_slug", "")

    is_admin = (
        metadata.get("is_platform_admin") is True
        or org_slug == _PLATFORM_ADMIN_ORG_SLUG
    )

    if not is_admin:
        user_id = payload.get("sub", "unknown")
        logger.warning(
            "Non-admin %s attempted platform access (org_slug=%s)",
            user_id,
            org_slug,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Platform admin access required. "
                "This endpoint is restricted to Acolyte team members."
            ),
        )

    # Extract user info
    user_id = payload.get("sub", "")
    email = payload.get("email")
    first_name = payload.get("first_name", "")
    last_name = payload.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or None

    return PlatformAdminUser(
        user_id=user_id,
        email=email,
        full_name=full_name,
    )


async def get_platform_db(
    _admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> AsyncSession:
    """Database session for platform admin operations.

    Sets the superadmin RLS bypass so queries can access tenant-scoped
    tables (students, faculty, AI budgets, etc.) across all colleges.
    Platform-level tables (licenses, alerts) don't have RLS but the
    bypass is harmless for them.

    FastAPI caches dependency results per-request, so handlers can
    depend on both ``require_platform_admin`` (for the user) and
    ``get_platform_db`` (for the session) without duplicate auth calls.
    """
    await db.execute(text("SET app.is_superadmin = 'true'"))
    return db

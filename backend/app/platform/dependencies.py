"""Platform admin authentication dependencies.

Platform admins are Acolyte team members identified by either:
1. A special Clerk metadata flag (public_metadata.is_platform_admin = true)
2. Membership in the platform admin Clerk organization (org_slug match)

These are NOT college users — they manage the B2B platform itself.

NOTE: Clerk's default session token does NOT include public_metadata.
When the JWT lacks it, we fall back to the Clerk Backend API to fetch
the user's metadata. This adds ~100ms per request but only affects
platform admin endpoints (internal team only, low traffic).
"""

import logging
import os
import uuid as uuid_mod
from uuid import UUID

import httpx
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


async def _fetch_clerk_user_metadata(
    user_id: str, settings: Settings
) -> dict:
    """Fetch a user's public_metadata from the Clerk Backend API.

    Fallback for when the default session JWT doesn't include
    public_metadata (Clerk doesn't include it by default).
    """
    secret_key = settings.CLERK_SECRET_KEY
    if not secret_key:
        logger.warning("CLERK_SECRET_KEY not set — cannot fetch user metadata")
        return {}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {secret_key}"},
            )
            if resp.status_code != 200:
                logger.warning(
                    "Clerk user fetch failed: %s %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return {}
            data = resp.json()
            return data.get("public_metadata", {}) or {}
    except Exception as exc:
        logger.warning("Clerk API call failed: %s", exc)
        return {}


async def require_platform_admin(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> PlatformAdminUser:
    """Verify the authenticated user is a platform admin.

    Checks (in order):
    1. JWT must be valid (Clerk RS256 verification)
    2. ``public_metadata.is_platform_admin == true`` (from JWT or Clerk API), OR
    3. ``org_slug`` matches ``PLATFORM_ADMIN_ORG_SLUG`` env var

    If the JWT doesn't include public_metadata (Clerk default), falls back
    to the Clerk Backend API to fetch the user's metadata.

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

    user_id = payload.get("sub", "")

    # Check platform admin status via JWT metadata or org membership
    metadata = payload.get("public_metadata", {}) or {}
    org_slug = payload.get("org_slug", "")

    is_admin = (
        metadata.get("is_platform_admin") is True
        or org_slug == _PLATFORM_ADMIN_ORG_SLUG
    )

    # Fallback: Clerk's default session token doesn't include public_metadata.
    # Fetch from Clerk Backend API for platform admin verification.
    if not is_admin and not metadata and user_id:
        metadata = await _fetch_clerk_user_metadata(user_id, settings)
        is_admin = metadata.get("is_platform_admin") is True

    if not is_admin:
        logger.warning(
            "Non-admin %s attempted platform access (org_slug=%s)",
            user_id or "unknown",
            org_slug,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Platform admin access required. "
                "This endpoint is restricted to Acolyte team members."
            ),
        )

    # Extract user info — prefer JWT claims, fall back to metadata
    email = payload.get("email") or metadata.get("email")
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

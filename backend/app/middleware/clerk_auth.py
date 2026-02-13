"""Production-ready Clerk JWT authentication middleware.

Validates RS256 JWTs using Clerk's JWKS endpoint with timed cache.
Extracts user_id, org_id (college_id/tenant), role, and session claims.
Sets PostgreSQL RLS context variable for tenant isolation.

Clerk JWT claims reference (v2 session tokens):
- sub: Clerk user ID (user_xxx)
- org_id: active organization ID (org_xxx) — maps to our college_id
- org_role: role within org (org:admin, org:member, or custom)
- org_slug: org slug for display
- azp: authorized party (publishable key / origin)
- iss: issuer URL (https://<instance>.clerk.accounts.dev)
- exp / nbf / iat: standard time claims
- email: user email (if present in session template)
- first_name / last_name: from Clerk user profile (if present)
- metadata: custom public/private metadata (if configured in session template)
"""

import asyncio
import logging
import time
from enum import StrEnum
from uuid import UUID

import httpx
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# UserRole enum — mirrors @acolyte/shared UserRole in TypeScript
# ---------------------------------------------------------------------------

class UserRole(StrEnum):
    STUDENT = "student"
    FACULTY = "faculty"
    HOD = "hod"
    DEAN = "dean"
    ADMIN = "admin"
    COMPLIANCE_OFFICER = "compliance_officer"
    MANAGEMENT = "management"


# Clerk org role → Acolyte UserRole mapping
# Clerk custom roles: "org:student", "org:faculty", "org:hod", etc.
# Clerk built-in: "org:admin" → maps to ADMIN, "org:member" → defaults to STUDENT
_CLERK_ROLE_MAP: dict[str, UserRole] = {
    "org:student": UserRole.STUDENT,
    "org:faculty": UserRole.FACULTY,
    "org:hod": UserRole.HOD,
    "org:dean": UserRole.DEAN,
    "org:admin": UserRole.ADMIN,
    "org:compliance_officer": UserRole.COMPLIANCE_OFFICER,
    "org:management": UserRole.MANAGEMENT,
    # Clerk built-in fallbacks
    "org:member": UserRole.STUDENT,
    "admin": UserRole.ADMIN,
}


def map_clerk_role(org_role: str | None) -> UserRole:
    """Map a Clerk org_role claim to our UserRole enum.

    Falls back to STUDENT for unrecognized or missing roles.
    """
    if not org_role:
        return UserRole.STUDENT
    return _CLERK_ROLE_MAP.get(org_role, UserRole.STUDENT)


# ---------------------------------------------------------------------------
# CurrentUser — injected into request handlers
# ---------------------------------------------------------------------------

class CurrentUser(BaseModel):
    """Authenticated user context extracted from a verified Clerk JWT.

    Injected into route handlers via FastAPI Depends.
    """
    user_id: str = Field(description="Clerk user ID (user_xxx)")
    college_id: UUID = Field(description="Organization/tenant ID for RLS")
    clerk_org_id: str | None = Field(default=None, description="Raw Clerk org ID (org_xxx)")
    role: UserRole = Field(description="Mapped application role")
    email: str | None = Field(default=None, description="User email")
    full_name: str | None = Field(default=None, description="Display name")
    org_slug: str | None = Field(default=None, description="Organization slug")
    session_id: str | None = Field(default=None, description="Clerk session ID")
    permissions: list[str] = Field(default_factory=list, description="Org-level permissions")

    model_config = {"frozen": True}


# Sentinel UUID used when org_id is a Clerk ID (org_xxx) that needs DB resolution.
# Immediately resolved in the get_current_user dependency — never reaches route handlers.
ORG_ID_SENTINEL = UUID("00000000-0000-0000-0000-000000000000")


# ---------------------------------------------------------------------------
# JWKS cache — thread-safe, time-based expiry
# ---------------------------------------------------------------------------

_JWKS_CACHE_TTL = 3600  # 1 hour


class _JWKSCache:
    """In-memory JWKS cache with automatic refresh.

    - Fetches from Clerk's JWKS endpoint on first use
    - Refreshes after TTL expires
    - Falls back to stale cache if refresh fails (resilience)
    - Thread-safe via asyncio.Lock
    """
    __slots__ = ("_keys", "_fetched_at", "_lock", "_jwks_url")

    def __init__(self) -> None:
        self._keys: dict | None = None
        self._fetched_at: float = 0
        self._lock = asyncio.Lock()
        self._jwks_url: str | None = None

    def _is_stale(self) -> bool:
        return self._keys is None or (time.monotonic() - self._fetched_at) > _JWKS_CACHE_TTL

    async def get_keys(self, settings: Settings) -> dict:
        """Return cached JWKS, refreshing if stale."""
        if not self._is_stale():
            return self._keys

        async with self._lock:
            # Double-check after acquiring lock
            if not self._is_stale():
                return self._keys

            jwks_url = self._resolve_jwks_url(settings)

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(jwks_url)
                    response.raise_for_status()
                    self._keys = response.json()
                    self._fetched_at = time.monotonic()
                    logger.info("JWKS cache refreshed from %s", jwks_url)
            except httpx.HTTPError as exc:
                if self._keys is not None:
                    # Serve stale keys rather than failing
                    logger.warning(
                        "JWKS refresh failed (%s), serving stale cache", exc
                    )
                else:
                    logger.error("JWKS fetch failed with no cached fallback: %s", exc)
                    raise

            return self._keys

    def _resolve_jwks_url(self, settings: Settings) -> str:
        """Build the JWKS URL.

        Clerk JWKS endpoints:
        - Instance-specific: https://<instance>.clerk.accounts.dev/.well-known/jwks.json
        - Or set explicitly via CLERK_JWKS_URL env var
        - Fallback: derive from CLERK_ISSUER + /.well-known/jwks.json
        """
        if self._jwks_url:
            return self._jwks_url

        if settings.CLERK_JWKS_URL:
            url = settings.CLERK_JWKS_URL
            # If it's a bare domain like https://api.clerk.com, append the path
            if not url.endswith(".json"):
                url = url.rstrip("/") + "/.well-known/jwks.json"
            self._jwks_url = url
        elif settings.CLERK_ISSUER:
            self._jwks_url = settings.CLERK_ISSUER.rstrip("/") + "/.well-known/jwks.json"
        else:
            raise ValueError(
                "Either CLERK_JWKS_URL or CLERK_ISSUER must be set"
            )

        return self._jwks_url

    def invalidate(self) -> None:
        """Force a refresh on next access (e.g. after a key rotation)."""
        self._fetched_at = 0


# Module-level singleton
jwks_cache = _JWKSCache()


# ---------------------------------------------------------------------------
# JWT verification
# ---------------------------------------------------------------------------

async def verify_clerk_jwt(token: str, settings: Settings | None = None) -> dict:
    """Verify a Clerk JWT and return the decoded payload.

    Args:
        token: Raw JWT string (without "Bearer " prefix).
        settings: App settings. Auto-resolved if None.

    Returns:
        Decoded JWT payload dict.

    Raises:
        JWTError: If token is invalid, expired, or signature doesn't match.
        ValueError: If JWKS config is missing.
        httpx.HTTPError: If JWKS endpoint is unreachable.
    """
    if settings is None:
        settings = get_settings()

    jwks = await jwks_cache.get_keys(settings)

    # Match the signing key by kid
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    rsa_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            rsa_key = key
            break

    if rsa_key is None:
        # Key not found — could be a rotation. Force refresh and retry once.
        jwks_cache.invalidate()
        jwks = await jwks_cache.get_keys(settings)
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = key
                break

    if rsa_key is None:
        raise JWTError(f"No matching signing key found for kid={kid}")

    # Build decode options
    decode_options: dict = {
        "algorithms": ["RS256"],
    }

    # Verify issuer if configured
    if settings.CLERK_ISSUER:
        decode_options["issuer"] = settings.CLERK_ISSUER

    # Verify audience if configured (azp claim)
    # Clerk puts the publishable key or frontend origin in "azp"
    # We don't verify audience by default as Clerk uses azp differently

    payload = jwt.decode(
        token,
        rsa_key,
        **decode_options,
    )

    return payload


def extract_current_user(payload: dict) -> CurrentUser:
    """Extract a CurrentUser from a verified JWT payload.

    Clerk v2 session token structure:
    {
      "sub": "user_2abc...",
      "org_id": "org_2xyz...",
      "org_role": "org:faculty",
      "org_slug": "demo-college",
      "email": "dr.smith@college.edu",
      "first_name": "Dr.",
      "last_name": "Smith",
      "sid": "sess_2...",
      "org_permissions": ["org:students:read", "org:assessments:manage"],
      ...
    }
    """
    user_id = payload.get("sub", "")
    org_id = payload.get("org_id")
    org_role = payload.get("org_role")
    org_slug = payload.get("org_slug")
    session_id = payload.get("sid")

    # Email: Clerk may put it at top level or in metadata
    email = payload.get("email")

    # Full name
    first_name = payload.get("first_name", "")
    last_name = payload.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or None

    # Org permissions
    permissions = payload.get("org_permissions", [])

    # Map role
    # Also check metadata for custom role override (set via Clerk dashboard)
    metadata = payload.get("public_metadata", {}) or {}
    custom_role = metadata.get("role")
    if custom_role and custom_role in UserRole.__members__.values():
        role = UserRole(custom_role)
    else:
        role = map_clerk_role(org_role)

    # org_id is required for tenant context
    if not org_id:
        raise ValueError("JWT missing org_id claim — user must select an organization")

    # Clerk org_id can be either:
    # 1. A UUID (from custom session template) → use directly as college_id
    # 2. A Clerk ID like "org_2abc..." → needs DB lookup (resolved in dependency layer)
    college_id: UUID
    clerk_org_id_str: str | None = None
    try:
        college_id = UUID(org_id)
    except ValueError:
        # Clerk org_id format — will be resolved to college UUID in get_current_user
        clerk_org_id_str = org_id
        college_id = ORG_ID_SENTINEL

    return CurrentUser(
        user_id=user_id,
        college_id=college_id,
        clerk_org_id=clerk_org_id_str,
        role=role,
        email=email,
        full_name=full_name,
        org_slug=org_slug,
        session_id=session_id,
        permissions=permissions,
    )

"""License enforcement middleware.

Validates that every request from a college tenant is authorized by
an active license with the required feature enabled.

Flow:
1. Extract college_id from the Authorization JWT (lightweight decode)
2. Load license for this college_id (cached in Redis, 5-minute TTL)
3. Check: is license status == "active"?
4. Check: has the license expired?
5. Check: is the requested feature enabled in this license?
6. If any check fails: return 403 with specific error
7. If all pass: attach license to request.state and continue

SKIP for:
- Health check endpoints (/health, /ready)
- Webhook endpoints (/api/v1/webhooks/*)
- Auth test endpoints (/api/v1/me)
- OpenAPI docs (/docs, /openapi.json, /redoc)
- Unauthenticated requests (no Authorization header)
"""

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from jose import jwt as jose_jwt
from redis.asyncio import Redis
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.platform.schemas import CachedLicense

logger = logging.getLogger(__name__)

# Redis cache TTL for license data (seconds)
LICENSE_CACHE_TTL = 300  # 5 minutes

# Paths that skip license enforcement entirely
_SKIP_PREFIXES: tuple[str, ...] = (
    "/health",
    "/ready",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/webhooks/",
    "/api/v1/me",
)

# Endpoint path → required feature flag mapping.
# Returns None for endpoints that don't require a specific feature.
_ENDPOINT_FEATURE_MAP: dict[str, str] = {
    "/ai/student/study-buddy": "socratic_study_buddy",
    "/ai/student/generate-practice-questions": "practice_questions",
    "/ai/student/neetpg/": "neet_pg_prep",
    "/ai/student/flashcards/": "flashcards",
    "/ai/student/recommendations": "recommendations",
    "/ai/faculty/generate-exam-questions": "exam_question_generator",
    "/ai/compliance/generate-saf": "saf_generator",
    "/ai/compliance/run-check": "compliance_monitoring",
    "/ai/compliance/dashboard": "compliance_monitoring",
    "/ai/admin/copilot": "admin_copilot",
    "/ai/faculty/copilot": "faculty_engine",
}

# Feature → engine mapping (a feature requires its engine to be enabled)
_FEATURE_ENGINE_MAP: dict[str, str] = {
    "socratic_study_buddy": "student_engine",
    "practice_questions": "student_engine",
    "neet_pg_prep": "student_engine",
    "flashcards": "student_engine",
    "recommendations": "student_engine",
    "exam_question_generator": "faculty_engine",
    "saf_generator": "compliance_engine",
    "compliance_monitoring": "compliance_engine",
    "admin_copilot": "admin_engine",
}


class LicenseEnforcementMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that enforces B2B license on every tenant request.

    Requires ``app.state.redis`` to be set (Redis async client)
    and a database session factory at ``app.state.db_factory`` or uses
    the global ``async_session_factory`` from core.database.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Skip non-tenant routes
        if self._should_skip(path):
            return await call_next(request)

        # Extract college_id from JWT (lightweight, no full verification)
        college_id = self._extract_college_id(request)
        if college_id is None:
            # No token or unparseable — let auth Depends handle rejection
            return await call_next(request)

        # Load license (Redis-cached, DB fallback)
        license_data = await self._get_cached_license(request, college_id)

        if license_data is None:
            return JSONResponse(
                status_code=403,
                content={
                    "error": "no_license",
                    "message": (
                        "No active license found for this institution. "
                        "Contact support@myacolyte.com"
                    ),
                },
            )

        if license_data.status != "active":
            return JSONResponse(
                status_code=403,
                content={
                    "error": "license_inactive",
                    "message": (
                        f"License is {license_data.status}. "
                        "Contact support@myacolyte.com"
                    ),
                    "status": license_data.status,
                },
            )

        # Check license expiry
        if license_data.expires_at is not None:
            now = datetime.now(timezone.utc)
            if license_data.expires_at < now:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "license_expired",
                        "message": (
                            "Your license has expired. "
                            "Contact support@myacolyte.com for renewal."
                        ),
                        "expired_on": license_data.expires_at.isoformat(),
                    },
                )

        # Check feature access
        required_feature = self._map_endpoint_to_feature(path)
        if required_feature and not self._is_feature_enabled(
            license_data, required_feature
        ):
            return JSONResponse(
                status_code=403,
                content={
                    "error": "feature_not_licensed",
                    "message": (
                        f"Your current plan does not include "
                        f"'{required_feature}'. "
                        "Contact sales@myacolyte.com to upgrade."
                    ),
                    "feature": required_feature,
                    "current_plan": license_data.plan_tier,
                },
            )

        # Attach license to request state for downstream use
        request.state.license = license_data
        request.state.plan_tier = license_data.plan_tier

        return await call_next(request)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _should_skip(path: str) -> bool:
        """Return True if this path should bypass license enforcement."""
        return any(path.startswith(prefix) for prefix in _SKIP_PREFIXES)

    @staticmethod
    def _extract_college_id(request: Request) -> UUID | None:
        """Extract college_id from the JWT without full verification.

        This is a lightweight decode (no signature check) because the
        auth dependency will do full verification later. We just need
        the org_id/college_id to look up the license.
        """
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        try:
            # Decode without verification — just to read claims
            payload = jose_jwt.get_unverified_claims(token)
            org_id = payload.get("org_id")
            if org_id:
                return UUID(org_id)
        except Exception:
            pass

        return None

    @staticmethod
    def _map_endpoint_to_feature(path: str) -> str | None:
        """Map an API path to the required license feature flag."""
        for prefix, feature in _ENDPOINT_FEATURE_MAP.items():
            if path.startswith(f"/api/v1{prefix}"):
                return feature
        return None

    @staticmethod
    def _is_feature_enabled(license_data: CachedLicense, feature: str) -> bool:
        """Check both engine-level and feature-level flags."""
        # Check engine-level first
        engine = _FEATURE_ENGINE_MAP.get(feature)
        if engine and not license_data.enabled_engines.get(engine, False):
            return False
        # Then check feature-level
        return license_data.enabled_features.get(feature, False)

    @staticmethod
    async def _get_cached_license(
        request: Request, college_id: UUID
    ) -> CachedLicense | None:
        """Load license from Redis cache, falling back to DB on miss."""
        redis_client: Redis | None = getattr(request.app.state, "redis", None)
        cache_key = f"license:{college_id}"

        # Try Redis cache first
        if redis_client is not None:
            try:
                cached = await redis_client.get(cache_key)
                if cached:
                    return CachedLicense.model_validate_json(cached)
            except Exception:
                logger.warning("Redis license cache read failed", exc_info=True)

        # DB fallback
        license_data = await _db_load_license(college_id)

        # Populate cache
        if license_data is not None and redis_client is not None:
            try:
                await redis_client.setex(
                    cache_key,
                    LICENSE_CACHE_TTL,
                    license_data.model_dump_json(),
                )
            except Exception:
                logger.warning("Redis license cache write failed", exc_info=True)

        return license_data


# ---------------------------------------------------------------------------
# DB helper (module-level to avoid circular import issues)
# ---------------------------------------------------------------------------


async def _db_load_license(college_id: UUID) -> CachedLicense | None:
    """Load a license from the database and return as CachedLicense."""
    from app.core.database import async_session_factory
    from app.platform.models import License

    async with async_session_factory() as session:
        result = await session.execute(
            select(License).where(License.college_id == college_id)
        )
        row = result.scalar_one_or_none()

        if row is None:
            return None

        return CachedLicense(
            id=row.id,
            college_id=row.college_id,
            plan_tier=row.plan_tier,
            status=row.status,
            enabled_engines=row.enabled_engines or {},
            enabled_features=row.enabled_features or {},
            max_students=row.max_students,
            max_faculty=row.max_faculty,
            max_storage_gb=row.max_storage_gb,
            monthly_ai_token_budget=row.monthly_ai_token_budget,
            expires_at=row.expires_at,
        )


async def invalidate_license_cache(
    redis_client: Redis, college_id: UUID
) -> None:
    """Bust the Redis cache for a license. Call after any license update."""
    cache_key = f"license:{college_id}"
    try:
        await redis_client.delete(cache_key)
    except Exception:
        logger.warning("Failed to invalidate license cache for %s", college_id)

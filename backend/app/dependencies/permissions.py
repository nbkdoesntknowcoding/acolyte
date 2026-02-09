"""Permify-based permission dependencies for FastAPI routes.

Usage:

    from app.dependencies.permissions import require_permission

    # Check "can_grade" on the course identified by path param "course_id"
    @router.get(
        "/courses/{course_id}/grades",
        dependencies=[Depends(require_permission("course", "course_id", "can_grade"))],
    )
    async def list_grades(course_id: str):
        ...

    # Check "can_edit" on a compliance_report
    @router.put(
        "/compliance/{report_id}",
        dependencies=[Depends(require_permission("compliance_report", "report_id", "can_edit"))],
    )
    async def update_report(report_id: str):
        ...
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.dependencies.auth import get_current_user
from app.middleware.clerk_auth import CurrentUser

logger = logging.getLogger(__name__)

# Redis cache TTL for permission checks (seconds)
PERMISSION_CACHE_TTL = 60


def _cache_key(entity_type: str, entity_id: str, permission: str, user_id: str) -> str:
    """Build a deterministic Redis cache key for a permission check."""
    raw = f"permify:{entity_type}:{entity_id}:{permission}:{user_id}"
    return raw


async def _get_redis():
    """Try to get the Redis client from app state. Returns None if unavailable."""
    try:
        import redis.asyncio as aioredis
        from app.config import get_settings

        settings = get_settings()
        if not settings.REDIS_URL:
            return None
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        # Quick check
        await client.ping()
        return client
    except Exception:
        return None


async def _cached_check(
    entity_type: str,
    entity_id: str,
    permission: str,
    user_id: str,
    tenant_id: str,
    request: Request,
) -> bool:
    """Check permission with Redis cache layer.

    1. Check Redis cache first
    2. On miss, call Permify and cache the result for 60s
    3. If Redis is down, skip caching and call Permify directly
    """
    key = _cache_key(entity_type, entity_id, permission, user_id)

    # Try Redis cache
    redis = await _get_redis()
    if redis:
        try:
            cached = await redis.get(key)
            if cached is not None:
                await redis.aclose()
                return cached == "1"
        except Exception:
            pass  # Redis down, skip cache

    # Cache miss — call Permify
    from app.core.permify.client import PermifyClient

    permify: PermifyClient | None = getattr(request.app.state, "permify", None)
    if permify is None:
        logger.error("PermifyClient not initialized on app.state")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization service unavailable",
        )

    allowed = await permify.check(
        entity_type=entity_type,
        entity_id=entity_id,
        permission=permission,
        subject_id=user_id,
        tenant_id=tenant_id,
    )

    # Cache result in Redis
    if redis:
        try:
            await redis.setex(key, PERMISSION_CACHE_TTL, "1" if allowed else "0")
            await redis.aclose()
        except Exception:
            pass  # Redis down, skip caching

    return allowed


def require_permission(
    entity_type: str,
    entity_id_param: str,
    permission: str,
) -> Callable:
    """Create a FastAPI dependency that checks a Permify permission.

    Args:
        entity_type: Permify entity type (e.g. "course", "department", "college")
        entity_id_param: Name of the path/query parameter containing the entity ID
        permission: Permission to check (e.g. "can_grade", "can_edit", "can_view")

    The dependency extracts the entity ID from the request path parameters,
    gets the current user from the Clerk JWT, and checks the permission
    against Permify. Denies with 403 if not allowed.

    Example:
        @router.get("/courses/{course_id}/students")
        async def list_students(
            course_id: str,
            user: CurrentUser = Depends(require_permission("course", "course_id", "can_view")),
        ):
            ...
    """

    async def _check_permission(
        request: Request,
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        # Extract entity ID from path params
        entity_id = request.path_params.get(entity_id_param)
        if not entity_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing path parameter: {entity_id_param}",
            )

        # Use college_id as tenant_id for multi-tenant isolation
        tenant_id = str(user.college_id) if user.college_id else "t1"

        allowed = await _cached_check(
            entity_type=entity_type,
            entity_id=str(entity_id),
            permission=permission,
            user_id=user.user_id,
            tenant_id=tenant_id,
            request=request,
        )

        if not allowed:
            logger.info(
                "Permission denied: user=%s permission=%s entity=%s:%s",
                user.user_id, permission, entity_type, entity_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have '{permission}' permission on this {entity_type}",
            )

        return user

    return _check_permission


def require_entity_permission(
    entity_type: str,
    permission: str,
) -> Callable:
    """Variant that takes the entity_id directly as a function parameter.

    Use this when the entity ID isn't a path parameter but comes from
    the request body or business logic.

    Example:
        async def create_assessment(
            body: CreateAssessmentRequest,
            user: CurrentUser = Depends(get_current_user),
            request: Request,
        ):
            dep = require_entity_permission("course", "can_teach")
            await dep(request, user, entity_id=body.course_id)
    """

    async def _check(
        request: Request,
        user: CurrentUser = Depends(get_current_user),
        entity_id: str = "",
    ) -> bool:
        if not entity_id:
            return False

        tenant_id = str(user.college_id) if user.college_id else "t1"

        return await _cached_check(
            entity_type=entity_type,
            entity_id=entity_id,
            permission=permission,
            user_id=user.user_id,
            tenant_id=tenant_id,
            request=request,
        )

    return _check

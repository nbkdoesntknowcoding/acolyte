"""Redis-based rate limiting.

Limits: 1000 requests/hour, 100 requests/minute per JWT subject.
"""

from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings


async def check_rate_limit(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> None:
    """Check rate limits using Redis sliding window.

    TODO: Implement with Upstash Redis when connected.
    Currently a no-op placeholder during development.
    """
    # In development, skip rate limiting
    if settings.APP_DEBUG:
        return

    # TODO: Implement sliding window rate limiter with Redis
    # Key: f"rate_limit:{user_id}:{window}"
    # Windows: 1min (100 max), 1hr (1000 max)
    pass

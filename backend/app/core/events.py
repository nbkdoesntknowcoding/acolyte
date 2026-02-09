"""Redis Pub/Sub event bus for inter-engine async communication.

Events are fire-and-forget notifications between engines.
Direct function calls for synchronous operations within the same request.
"""

import json
from typing import Any, Callable

import redis.asyncio as redis

from app.config import get_settings

settings = get_settings()

_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def publish_event(channel: str, data: dict[str, Any]) -> None:
    """Publish an event to a Redis channel.

    Example channels:
        - "attendance.recorded"
        - "compliance.alert"
        - "assessment.submitted"
    """
    client = await get_redis()
    await client.publish(channel, json.dumps(data))


async def subscribe(channel: str, handler: Callable) -> None:
    """Subscribe to a Redis channel and process messages.

    This should be run as a background task (Celery or asyncio.create_task).
    """
    client = await get_redis()
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)

    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            await handler(data)

"""FastAPI dependency for the AI Gateway singleton.

Usage in route handlers:

    from app.engines.ai.gateway_deps import get_ai_gateway
    from app.engines.ai.gateway import AIGateway

    @router.post("/generate")
    async def generate(
        gateway: AIGateway = Depends(get_ai_gateway),
        db: AsyncSession = Depends(get_tenant_db),
    ):
        result = await gateway.complete(db, system_prompt=..., ...)
"""

from functools import lru_cache

from app.config import get_settings
from app.engines.ai.gateway import AIGateway


@lru_cache(maxsize=1)
def _create_gateway() -> AIGateway:
    """Create singleton AIGateway instance.

    Uses lru_cache to ensure only one instance is created per process.
    The Anthropic AsyncAnthropic client is safe to share across requests.
    """
    settings = get_settings()
    return AIGateway(api_key=settings.ANTHROPIC_API_KEY)


def get_ai_gateway() -> AIGateway:
    """FastAPI dependency that returns the singleton AIGateway."""
    return _create_gateway()

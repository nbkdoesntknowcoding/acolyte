"""LiteLLM Proxy Configuration — AI Gateway.

ALL LLM calls go through LiteLLM. NEVER call providers directly.
Provides: multi-provider routing, per-tenant cost tracking, retry/fallback.
"""

LITELLM_CONFIG = {
    "model_list": [
        {
            "model_name": "medical-reasoning",
            "litellm_params": {
                "model": "anthropic/claude-sonnet-4-20250514",
                "api_key": "os.environ/ANTHROPIC_API_KEY",
                "max_tokens": 4096,
            },
        },
        {
            "model_name": "structured-extraction",
            "litellm_params": {
                "model": "openai/gpt-4o",
                "api_key": "os.environ/OPENAI_API_KEY",
            },
        },
        {
            "model_name": "fast-classification",
            "litellm_params": {
                "model": "anthropic/claude-haiku",
                "api_key": "os.environ/ANTHROPIC_API_KEY",
            },
        },
    ],
    "general_settings": {
        "master_key": "os.environ/LITELLM_MASTER_KEY",
    },
    "litellm_settings": {
        "cache": True,
        "cache_params": {
            "type": "redis",
            "host": "os.environ/REDIS_HOST",
        },
        "max_budget": 100,
        "budget_duration": "1mo",
    },
}

# Budget allocation per tenant:
# Student: 60%, Faculty: 20%, Compliance: 10%, Admin: 10%
BUDGET_ALLOCATION = {
    "student": 0.60,
    "faculty": 0.20,
    "compliance": 0.10,
    "admin": 0.10,
}

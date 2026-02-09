"""CORS configuration.

Applied in main.py via FastAPI's CORSMiddleware.
This module provides the configuration values.
"""

from app.config import get_settings

ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
ALLOWED_HEADERS = ["*"]


def get_cors_config() -> dict:
    settings = get_settings()
    return {
        "allow_origins": settings.cors_origins_list,
        "allow_credentials": True,
        "allow_methods": ALLOWED_METHODS,
        "allow_headers": ALLOWED_HEADERS,
    }

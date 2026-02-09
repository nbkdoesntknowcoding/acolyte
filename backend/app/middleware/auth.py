"""Clerk JWT auth — re-exports from clerk_auth module.

This file is kept for backwards compatibility. All auth logic lives in clerk_auth.py.
Import from app.middleware.clerk_auth or app.dependencies.auth instead.
"""

from app.middleware.clerk_auth import (  # noqa: F401
    CurrentUser,
    UserRole,
    extract_current_user,
    jwks_cache,
    map_clerk_role,
    verify_clerk_jwt,
)

"""Clerk JWT validation middleware.

Validates RS256 JWTs using Clerk's JWKS endpoint.
Extracts user_id, college_id, and role from token claims.
"""

from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import Settings, get_settings

security = HTTPBearer()

# Cache JWKS keys in memory
_jwks_cache: dict | None = None


async def _get_jwks(settings: Settings) -> dict:
    """Fetch and cache JWKS from Clerk."""
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            response = await client.get(settings.CLERK_JWKS_URL)
            response.raise_for_status()
            _jwks_cache = response.json()
    return _jwks_cache


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Verify Clerk JWT and return decoded payload.

    Returns dict with: sub (user_id), college_id, role, email
    """
    token = credentials.credentials

    try:
        jwks = await _get_jwks(settings)
        # Decode header to find matching key
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = None
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = key
                break

        if not rsa_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signing key",
            )

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=settings.CLERK_ISSUER,
        )

        return payload

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


async def get_current_user(payload: dict = Depends(verify_clerk_token)) -> dict:
    """Extract current user context from verified token."""
    return {
        "user_id": payload.get("sub"),
        "college_id": payload.get("college_id"),
        "role": payload.get("role", "student"),
        "email": payload.get("email"),
    }


async def get_college_id(current_user: dict = Depends(get_current_user)) -> UUID:
    """Extract college_id for tenant context."""
    college_id = current_user.get("college_id")
    if not college_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No college association found for user",
        )
    return UUID(college_id)

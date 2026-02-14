"""Clerk REST API client for backend server-to-server operations.

Used for:
1. Creating organizations programmatically
2. Adding users to organizations (auto-assignment on signup)
3. Looking up user details

All calls use CLERK_SECRET_KEY as Bearer token.
Clerk REST API base: https://api.clerk.com/v1
"""

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

CLERK_API_BASE = "https://api.clerk.com/v1"


class ClerkClient:
    """Async Clerk REST API client."""

    def __init__(self, settings: Settings) -> None:
        self._secret_key = settings.CLERK_SECRET_KEY
        if not self._secret_key:
            logger.warning("CLERK_SECRET_KEY not set — Clerk API calls will fail")
        self._client = httpx.AsyncClient(
            base_url=CLERK_API_BASE,
            headers={
                "Authorization": f"Bearer {self._secret_key}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )

    async def create_organization(
        self, name: str, slug: str | None = None, created_by: str | None = None
    ) -> dict[str, Any] | None:
        """Create a Clerk organization.

        Returns the org dict with 'id' field (org_xxx) on success, None on failure.
        """
        payload: dict[str, Any] = {"name": name}
        if slug:
            payload["slug"] = slug
        if created_by:
            payload["created_by"] = created_by
        try:
            response = await self._client.post("/organizations", json=payload)
            response.raise_for_status()
            org = response.json()
            logger.info("Created Clerk org: %s (id=%s)", name, org.get("id"))
            return org
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Failed to create Clerk org '%s': %s %s",
                name, exc.response.status_code, exc.response.text[:500],
            )
            return None

    async def add_user_to_organization(
        self, org_id: str, user_id: str, role: str = "org:member"
    ) -> bool:
        """Add a user to an organization with the specified role.

        Returns True on success (or if user is already a member).
        """
        try:
            response = await self._client.post(
                f"/organizations/{org_id}/memberships",
                json={"user_id": user_id, "role": role},
            )
            response.raise_for_status()
            logger.info(
                "Added user %s to org %s (role=%s)", user_id, org_id, role
            )
            return True
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 422:
                # User might already be a member
                logger.warning(
                    "User %s may already be in org %s: %s",
                    user_id, org_id, exc.response.text[:200],
                )
                return True
            logger.error(
                "Failed to add user %s to org %s: %s %s",
                user_id, org_id, exc.response.status_code,
                exc.response.text[:500],
            )
            return False

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        """Fetch user details from Clerk."""
        try:
            response = await self._client.get(f"/users/{user_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError:
            return None

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

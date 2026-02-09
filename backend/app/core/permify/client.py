"""Permify client for Zanzibar-style authorization.

Wraps the Permify REST API with async httpx for FastAPI compatibility.
The official `permify` Python SDK is synchronous, so we use httpx directly
for non-blocking async calls in the FastAPI event loop.

Connection:
- On Fly.io: uses internal address (acolyte-permify.internal) for low-latency
- Local dev: flyctl proxy 3476:3476 -a acolyte-permify → localhost:3476
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Schema file lives next to this module
SCHEMA_PATH = Path(__file__).parent / "schema.perm"

# Retry config
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds


def _get_base_url(settings: Settings) -> str:
    """Resolve Permify base URL, preferring Fly.io internal address."""
    # On Fly.io, use the private internal DNS for ~0ms latency
    fly_app = os.environ.get("FLY_APP_NAME")
    if fly_app:
        return "http://acolyte-permify.internal:3476"
    return settings.permify_http_url


class PermifyClient:
    """Async Permify client using REST API via httpx.

    Usage:
        client = PermifyClient()
        await client.push_schema()
        allowed = await client.check("course", course_id, "can_grade", user_id)
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._base_url = _get_base_url(self._settings)
        self._headers = self._build_headers()
        self._http: httpx.AsyncClient | None = None

    def _build_headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json"}
        if self._settings.PERMIFY_API_KEY:
            h["Authorization"] = f"Bearer {self._settings.PERMIFY_API_KEY}"
        return h

    async def _client(self) -> httpx.AsyncClient:
        """Lazy-init a shared httpx client (connection pooled)."""
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._headers,
                timeout=10.0,
            )
        return self._http

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._http and not self._http.is_closed:
            await self._http.aclose()
            self._http = None

    # ------------------------------------------------------------------
    # Retry helper
    # ------------------------------------------------------------------

    async def _request_with_retry(
        self, method: str, path: str, json: dict[str, Any]
    ) -> dict[str, Any]:
        """Make an HTTP request with exponential backoff retry."""
        last_exc: Exception | None = None

        for attempt in range(MAX_RETRIES):
            try:
                client = await self._client()
                response = await client.request(method, path, json=json)
                response.raise_for_status()
                return response.json()
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
                last_exc = exc
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(
                        "Permify request failed (attempt %d/%d): %s. Retrying in %.1fs",
                        attempt + 1, MAX_RETRIES, exc, delay,
                    )
                    await asyncio.sleep(delay)
                    # Force new client on connection errors
                    if isinstance(exc, httpx.ConnectError):
                        await self.close()

        logger.error("Permify request failed after %d retries: %s", MAX_RETRIES, last_exc)
        raise last_exc  # type: ignore[misc]

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Ping Permify to verify connectivity."""
        try:
            client = await self._client()
            response = await client.get("/healthz")
            return response.status_code == 200
        except Exception as exc:
            logger.warning("Permify health check failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Schema management
    # ------------------------------------------------------------------

    async def push_schema(self, tenant_id: str = "t1") -> str | None:
        """Read schema.perm and push to the remote Permify instance.

        Returns the schema version on success, None on failure.
        """
        if not SCHEMA_PATH.exists():
            logger.error("Schema file not found at %s", SCHEMA_PATH)
            return None

        schema_text = SCHEMA_PATH.read_text()

        try:
            result = await self._request_with_retry(
                "POST",
                f"/v1/tenants/{tenant_id}/schemas/write",
                json={"schema": schema_text},
            )
            version = result.get("schema_version", "unknown")
            logger.info("Permify schema pushed (version: %s, tenant: %s)", version, tenant_id)
            return version
        except Exception as exc:
            logger.error("Failed to push Permify schema: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Permission checks
    # ------------------------------------------------------------------

    async def check(
        self,
        entity_type: str,
        entity_id: str,
        permission: str,
        subject_id: str,
        subject_type: str = "user",
        tenant_id: str = "t1",
    ) -> bool:
        """Check if a subject has a permission on an entity.

        Returns False (fail closed) if Permify is unreachable.

        Example:
            allowed = await client.check("course", "c-123", "can_grade", "u-456")
        """
        try:
            result = await self._request_with_retry(
                "POST",
                f"/v1/tenants/{tenant_id}/permissions/check",
                json={
                    "metadata": {"depth": 20},
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject": {"type": subject_type, "id": subject_id},
                },
            )
            return result.get("can") == "CHECK_RESULT_ALLOWED"
        except Exception:
            # Fail closed — deny if Permify is unreachable
            return False

    # ------------------------------------------------------------------
    # Relationship writes
    # ------------------------------------------------------------------

    async def write_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_id: str,
        subject_type: str = "user",
        tenant_id: str = "t1",
    ) -> bool:
        """Write a single relationship tuple.

        Example:
            await client.write_relationship("department", "d-1", "hod", "u-789")
        """
        try:
            await self._request_with_retry(
                "POST",
                f"/v1/tenants/{tenant_id}/data/write",
                json={
                    "metadata": {"schema_version": ""},
                    "tuples": [
                        {
                            "entity": {"type": entity_type, "id": entity_id},
                            "relation": relation,
                            "subject": {"type": subject_type, "id": subject_id},
                        }
                    ],
                },
            )
            return True
        except Exception as exc:
            logger.error("Failed to write relationship: %s", exc)
            return False

    async def batch_write_relationships(
        self,
        tuples: list[dict[str, Any]],
        tenant_id: str = "t1",
    ) -> bool:
        """Bulk write relationship tuples.

        Each tuple: {"entity_type", "entity_id", "relation", "subject_type", "subject_id"}

        Example:
            await client.batch_write_relationships([
                {"entity_type": "college", "entity_id": "c-1", "relation": "dean", "subject_type": "user", "subject_id": "u-1"},
                {"entity_type": "college", "entity_id": "c-1", "relation": "admin", "subject_type": "user", "subject_id": "u-2"},
            ])
        """
        formatted = [
            {
                "entity": {"type": t["entity_type"], "id": t["entity_id"]},
                "relation": t["relation"],
                "subject": {"type": t.get("subject_type", "user"), "id": t["subject_id"]},
            }
            for t in tuples
        ]

        try:
            await self._request_with_retry(
                "POST",
                f"/v1/tenants/{tenant_id}/data/write",
                json={
                    "metadata": {"schema_version": ""},
                    "tuples": formatted,
                },
            )
            logger.info("Batch wrote %d relationships (tenant: %s)", len(tuples), tenant_id)
            return True
        except Exception as exc:
            logger.error("Batch write failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Relationship deletes
    # ------------------------------------------------------------------

    async def delete_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_id: str,
        subject_type: str = "user",
        tenant_id: str = "t1",
    ) -> bool:
        """Delete a single relationship tuple."""
        try:
            await self._request_with_retry(
                "POST",
                f"/v1/tenants/{tenant_id}/data/delete",
                json={
                    "tuple_filter": {
                        "entity": {"type": entity_type, "ids": [entity_id]},
                        "relation": relation,
                        "subject": {"type": subject_type, "ids": [subject_id]},
                    },
                },
            )
            return True
        except Exception as exc:
            logger.error("Failed to delete relationship: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    async def lookup_entities(
        self,
        entity_type: str,
        permission: str,
        subject_id: str,
        subject_type: str = "user",
        tenant_id: str = "t1",
        page_size: int = 100,
    ) -> list[str]:
        """Find all entity IDs of a type that a subject has a permission on.

        Example:
            course_ids = await client.lookup_entities("course", "can_teach", "u-123")
        """
        try:
            result = await self._request_with_retry(
                "POST",
                f"/v1/tenants/{tenant_id}/permissions/lookup-entity",
                json={
                    "metadata": {"depth": 20},
                    "entity_type": entity_type,
                    "permission": permission,
                    "subject": {"type": subject_type, "id": subject_id},
                    "page_size": page_size,
                },
            )
            return result.get("entity_ids", [])
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Tenant management
    # ------------------------------------------------------------------

    async def create_tenant(self, tenant_id: str, name: str) -> bool:
        """Create a new Permify tenant (called when onboarding a new college)."""
        try:
            await self._request_with_retry(
                "POST",
                "/v1/tenants/create",
                json={"id": tenant_id, "name": name},
            )
            logger.info("Created Permify tenant: %s (%s)", tenant_id, name)
            return True
        except Exception as exc:
            logger.error("Failed to create tenant %s: %s", tenant_id, exc)
            return False

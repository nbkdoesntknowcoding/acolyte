"""Push the Permify authorization schema to the remote instance.

Usage:
    cd backend
    python -m scripts.push_permify_schema

    # With a specific tenant:
    python -m scripts.push_permify_schema --tenant college-uuid

This script reads schema.perm and pushes it to Permify.
Also called from FastAPI lifespan on app startup to keep schema in sync.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.permify.client import PermifyClient


async def push_schema(tenant_id: str = "t1") -> bool:
    """Push the schema and return success status."""
    client = PermifyClient()

    # Health check first
    healthy = await client.health_check()
    if not healthy:
        print(f"ERROR: Cannot reach Permify at {client._base_url}")
        print("  - If local: run  flyctl proxy 3476:3476 -a acolyte-permify")
        print("  - If Fly.io: check acolyte-permify app status")
        await client.close()
        return False

    print(f"Connected to Permify at {client._base_url}")

    # Push schema
    version = await client.push_schema(tenant_id=tenant_id)
    await client.close()

    if version:
        print(f"Schema pushed successfully (version: {version}, tenant: {tenant_id})")
        return True
    else:
        print("ERROR: Failed to push schema")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Push Permify authorization schema")
    parser.add_argument(
        "--tenant",
        default="t1",
        help="Permify tenant ID (default: t1)",
    )
    args = parser.parse_args()

    success = asyncio.run(push_schema(args.tenant))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

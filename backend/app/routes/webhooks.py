"""Backend webhook routes for Clerk membership events.

These routes receive forwarded events from the Next.js BFF
(apps/web/app/api/webhooks/clerk/route.ts).

The BFF verifies the svix signature and forwards the payload here.
These routes are NOT public-facing — they're called server-to-server.

Routes:
- POST /api/v1/webhooks/clerk/user-created
- POST /api/v1/webhooks/clerk/membership-created
- POST /api/v1/webhooks/clerk/membership-updated
- POST /api/v1/webhooks/clerk/membership-deleted
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.permify.client import PermifyClient
from app.core.permify.sync import (
    remove_clerk_membership_from_permify,
    sync_clerk_membership_to_permify,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks/clerk", tags=["Webhooks"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class UserCreatedPayload(BaseModel):
    clerk_user_id: str
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    image_url: str | None = None


class MembershipPayload(BaseModel):
    clerk_user_id: str
    clerk_org_id: str
    org_name: str = ""
    org_slug: str = ""
    role: str  # e.g. "org:faculty"
    department_id: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/user-created")
async def handle_user_created(payload: UserCreatedPayload):
    """Handle Clerk user.created webhook.

    Creates a user record in the database (when SIS is built).
    For now, just logs the event.
    """
    logger.info(
        "Clerk user created: %s (%s)",
        payload.clerk_user_id, payload.email,
    )
    # TODO: Create user record in DB when SIS tables exist
    return {"status": "ok", "user_id": payload.clerk_user_id}


@router.post("/membership-created")
async def handle_membership_created(payload: MembershipPayload, request: Request):
    """Handle organizationMembership.created — sync to Permify."""
    permify: PermifyClient | None = getattr(request.app.state, "permify", None)
    if not permify:
        logger.error("PermifyClient not available for membership sync")
        return {"status": "error", "detail": "Permify unavailable"}

    success = await sync_clerk_membership_to_permify(
        client=permify,
        org_id=payload.clerk_org_id,
        user_id=payload.clerk_user_id,
        org_role=payload.role,
        department_id=payload.department_id,
    )

    return {
        "status": "ok" if success else "error",
        "user_id": payload.clerk_user_id,
        "org_id": payload.clerk_org_id,
        "role": payload.role,
    }


@router.post("/membership-updated")
async def handle_membership_updated(payload: MembershipPayload, request: Request):
    """Handle organizationMembership.updated — remove old, write new Permify tuples.

    Since we don't know the old role from the webhook, we remove all possible
    role tuples for this user+org, then re-sync the new role.
    """
    permify: PermifyClient | None = getattr(request.app.state, "permify", None)
    if not permify:
        logger.error("PermifyClient not available for membership sync")
        return {"status": "error", "detail": "Permify unavailable"}

    # Remove all possible roles this user might have had on this org
    for old_role in [
        "org:student", "org:faculty", "org:hod", "org:dean",
        "org:admin", "org:compliance_officer", "org:management", "org:member",
    ]:
        await remove_clerk_membership_from_permify(
            client=permify,
            org_id=payload.clerk_org_id,
            user_id=payload.clerk_user_id,
            org_role=old_role,
            department_id=payload.department_id,
        )

    # Write the new role
    success = await sync_clerk_membership_to_permify(
        client=permify,
        org_id=payload.clerk_org_id,
        user_id=payload.clerk_user_id,
        org_role=payload.role,
        department_id=payload.department_id,
    )

    return {
        "status": "ok" if success else "error",
        "user_id": payload.clerk_user_id,
        "org_id": payload.clerk_org_id,
        "new_role": payload.role,
    }


@router.post("/membership-deleted")
async def handle_membership_deleted(payload: MembershipPayload, request: Request):
    """Handle organizationMembership.deleted — remove Permify relationships."""
    permify: PermifyClient | None = getattr(request.app.state, "permify", None)
    if not permify:
        logger.error("PermifyClient not available for membership sync")
        return {"status": "error", "detail": "Permify unavailable"}

    # Remove all possible role tuples (we may not know the exact role on delete)
    for role in [
        "org:student", "org:faculty", "org:hod", "org:dean",
        "org:admin", "org:compliance_officer", "org:management", "org:member",
    ]:
        await remove_clerk_membership_from_permify(
            client=permify,
            org_id=payload.clerk_org_id,
            user_id=payload.clerk_user_id,
            org_role=role,
            department_id=payload.department_id,
        )

    logger.info(
        "Removed all Permify relationships: user=%s org=%s",
        payload.clerk_user_id, payload.clerk_org_id,
    )

    return {
        "status": "ok",
        "user_id": payload.clerk_user_id,
        "org_id": payload.clerk_org_id,
    }

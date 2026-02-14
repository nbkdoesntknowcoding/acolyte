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
async def handle_user_created(payload: UserCreatedPayload, request: Request):
    """Handle Clerk user.created webhook.

    Auto-assigns users to organizations based on email domain matching.
    If the user's email domain matches a college's allowed_domains list,
    the user is automatically added to that college's Clerk organization.
    """
    logger.info(
        "Clerk user created: %s (%s)",
        payload.clerk_user_id, payload.email,
    )

    if not payload.email or "@" not in payload.email:
        logger.warning(
            "No email for user %s, skipping auto-assignment",
            payload.clerk_user_id,
        )
        return {"status": "ok", "user_id": payload.clerk_user_id, "auto_assigned": False}

    # Extract domain from email
    domain = payload.email.rsplit("@", 1)[-1].lower()
    if not domain:
        return {"status": "ok", "user_id": payload.clerk_user_id, "auto_assigned": False}

    # Find college with matching allowed_domain
    from sqlalchemy import select
    from app.core.database import async_session_factory
    from app.engines.admin.models import College

    async with async_session_factory() as db:
        result = await db.execute(
            select(College.clerk_org_id, College.name)
            .where(College.allowed_domains.contains([domain]))
            .where(College.clerk_org_id.isnot(None))
        )
        college = result.first()

    if not college:
        logger.info(
            "No college found for domain '%s' (user %s) — user will see domain error on onboarding",
            domain, payload.clerk_user_id,
        )
        return {
            "status": "ok",
            "user_id": payload.clerk_user_id,
            "auto_assigned": False,
            "reason": f"No college registered for domain '{domain}'",
        }

    # Auto-add user to the Clerk organization
    from app.core.clerk_client import ClerkClient

    clerk: ClerkClient | None = getattr(request.app.state, "clerk", None)
    if not clerk:
        logger.error("ClerkClient not available for auto-assignment")
        return {"status": "error", "detail": "Clerk client unavailable"}

    success = await clerk.add_user_to_organization(
        org_id=college.clerk_org_id,
        user_id=payload.clerk_user_id,
        role="org:member",  # Default role; admin can upgrade via Clerk Dashboard
    )

    if success:
        logger.info(
            "Auto-assigned user %s to org %s (%s) via domain '%s'",
            payload.clerk_user_id, college.clerk_org_id, college.name, domain,
        )

    return {
        "status": "ok" if success else "error",
        "user_id": payload.clerk_user_id,
        "auto_assigned": success,
        "org_id": college.clerk_org_id,
        "college_name": college.name,
    }


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

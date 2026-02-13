"""Setup a Clerk organization and link it to a college.

Creates a Clerk org via the REST API, then updates the colleges table
with the clerk_org_id and allowed_domains for domain-based auto-assignment.

Usage:
    # Link to an existing college by ID
    cd backend && python -m scripts.setup_org \
        --college-id <uuid> \
        --org-name "The Boring People" \
        --org-slug "the-boring-people" \
        --domains theboringpeople.in

    # Create a new college + org in one step
    cd backend && python -m scripts.setup_org \
        --create-college \
        --college-name "The Boring People" \
        --college-code "TBP-001" \
        --org-name "The Boring People" \
        --org-slug "the-boring-people" \
        --domains theboringpeople.in

    # Add a user to the org (by Clerk user ID)
    cd backend && python -m scripts.setup_org \
        --create-college \
        --college-name "The Boring People" \
        --college-code "TBP-001" \
        --org-name "The Boring People" \
        --org-slug "the-boring-people" \
        --domains theboringpeople.in \
        --add-user user_xxx --user-role org:admin
"""

import argparse
import asyncio
import uuid

from sqlalchemy import select, text, update

from app.config import get_settings
from app.core.clerk_client import ClerkClient
from app.core.database import async_session_factory
from app.engines.admin.models import College


async def setup(args: argparse.Namespace) -> None:
    settings = get_settings()
    clerk = ClerkClient(settings)

    college_id = None

    async with async_session_factory() as db:
        if args.create_college:
            # Check if college code already exists
            result = await db.execute(
                select(College).where(College.code == args.college_code)
            )
            existing = result.scalar_one_or_none()

            if existing:
                college_id = existing.id
                print(f"College '{args.college_code}' already exists: {college_id}")
                if existing.clerk_org_id:
                    print(f"  Already linked to Clerk org: {existing.clerk_org_id}")
                    print("  Updating allowed_domains only.")
                    domains = [d.strip() for d in args.domains.split(",")] if args.domains else []
                    await db.execute(
                        update(College)
                        .where(College.id == college_id)
                        .values(allowed_domains=domains)
                    )
                    await db.commit()

                    # Optionally add user
                    if args.add_user:
                        role = args.user_role or "org:admin"
                        ok = await clerk.add_user_to_organization(
                            existing.clerk_org_id, args.add_user, role
                        )
                        print(f"  Add user {args.add_user} (role={role}): {'OK' if ok else 'FAILED'}")

                    await clerk.close()
                    return
            else:
                college_id = uuid.uuid4()
                new_college = College(
                    id=college_id,
                    name=args.college_name or args.org_name,
                    code=args.college_code,
                    state=args.state or "Karnataka",
                    sanctioned_intake=args.intake or 150,
                    total_intake=args.intake or 150,
                )
                db.add(new_college)
                await db.flush()
                print(f"Created college: {args.college_name or args.org_name} ({college_id})")
        else:
            if not args.college_id:
                print("ERROR: --college-id is required when not using --create-college")
                await clerk.close()
                return
            college_id = uuid.UUID(args.college_id)

            # Verify college exists
            result = await db.execute(
                select(College).where(College.id == college_id)
            )
            existing = result.scalar_one_or_none()
            if not existing:
                print(f"ERROR: College {college_id} not found")
                await clerk.close()
                return

        # Create Clerk organization
        slug_info = f" (slug: {args.org_slug})" if args.org_slug else ""
        print(f"Creating Clerk org: {args.org_name}{slug_info}...")
        org = await clerk.create_organization(
            name=args.org_name,
            slug=args.org_slug,
        )
        if not org:
            print("ERROR: Failed to create Clerk organization. Check CLERK_SECRET_KEY.")
            await clerk.close()
            return

        clerk_org_id = org["id"]
        print(f"Created Clerk org: {clerk_org_id}")

        # Update college with clerk_org_id and allowed_domains
        domains = [d.strip() for d in args.domains.split(",")] if args.domains else []
        await db.execute(
            update(College)
            .where(College.id == college_id)
            .values(clerk_org_id=clerk_org_id, allowed_domains=domains)
        )
        await db.commit()
        print(f"Linked org {clerk_org_id} -> college {college_id}")
        print(f"Allowed domains: {domains}")

        # Optionally add a user to the org
        if args.add_user:
            role = args.user_role or "org:admin"
            ok = await clerk.add_user_to_organization(clerk_org_id, args.add_user, role)
            print(f"Add user {args.add_user} (role={role}): {'OK' if ok else 'FAILED'}")

    await clerk.close()
    print("\nDone! Users with matching email domains will auto-join on sign-up.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Setup a Clerk organization and link it to a college"
    )

    # College selection
    college_group = parser.add_mutually_exclusive_group(required=True)
    college_group.add_argument("--college-id", help="Existing college UUID")
    college_group.add_argument(
        "--create-college", action="store_true",
        help="Create a new college record",
    )

    # College details (for --create-college)
    parser.add_argument("--college-name", help="College display name")
    parser.add_argument("--college-code", help="Unique college code (e.g. TBP-001)")
    parser.add_argument("--state", default="Karnataka", help="State (default: Karnataka)")
    parser.add_argument("--intake", type=int, default=150, help="Total intake (default: 150)")

    # Clerk org details
    parser.add_argument("--org-name", required=True, help="Clerk organization name")
    parser.add_argument("--org-slug", help="Clerk organization slug (optional, depends on Clerk instance)")

    # Domain mapping
    parser.add_argument(
        "--domains", required=True,
        help="Comma-separated email domains (e.g. theboringpeople.in,tbp.co.in)",
    )

    # Optional: add user to org
    parser.add_argument("--add-user", help="Clerk user ID to add to the org")
    parser.add_argument("--user-role", default="org:admin", help="Role for --add-user (default: org:admin)")

    args = parser.parse_args()

    if args.create_college and not args.college_code:
        parser.error("--college-code is required when using --create-college")

    asyncio.run(setup(args))


if __name__ == "__main__":
    main()

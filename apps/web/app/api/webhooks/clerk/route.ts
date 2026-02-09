import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';

/**
 * Clerk webhook handler.
 *
 * Verifies the webhook signature using svix, then syncs Clerk events
 * to the backend API:
 * - user.created       -> create user record
 * - organization.membership.created  -> sync role assignment
 * - organization.membership.updated  -> update role
 * - organization.membership.deleted  -> remove role
 *
 * Set CLERK_WEBHOOK_SECRET in .env.local (from Clerk Dashboard -> Webhooks).
 */

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
  object: string;
}

async function syncToBackend(path: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`Backend sync failed: ${response.status} ${await response.text()}`);
    }
  } catch (error) {
    console.error('Backend sync error:', error);
  }
}

export async function POST(request: Request) {
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Verify the webhook signature
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await request.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle events
  switch (event.type) {
    case 'user.created': {
      const { id, email_addresses, first_name, last_name, image_url } = event.data as {
        id: string;
        email_addresses: Array<{ email_address: string }>;
        first_name: string | null;
        last_name: string | null;
        image_url: string | null;
      };

      await syncToBackend('/api/v1/webhooks/clerk/user-created', {
        clerk_user_id: id,
        email: email_addresses[0]?.email_address || '',
        first_name: first_name || '',
        last_name: last_name || '',
        image_url,
      });
      break;
    }

    case 'organization.membership.created': {
      const { organization, public_user_data, role } = event.data as {
        organization: { id: string; slug: string; name: string };
        public_user_data: { user_id: string };
        role: string;
      };

      await syncToBackend('/api/v1/webhooks/clerk/membership-created', {
        clerk_user_id: public_user_data.user_id,
        clerk_org_id: organization.id,
        org_name: organization.name,
        org_slug: organization.slug,
        role,
      });
      break;
    }

    case 'organization.membership.updated': {
      const { organization, public_user_data, role } = event.data as {
        organization: { id: string; slug: string; name: string };
        public_user_data: { user_id: string };
        role: string;
      };

      await syncToBackend('/api/v1/webhooks/clerk/membership-updated', {
        clerk_user_id: public_user_data.user_id,
        clerk_org_id: organization.id,
        org_name: organization.name,
        org_slug: organization.slug,
        role,
      });
      break;
    }

    case 'organization.membership.deleted': {
      const { organization, public_user_data, role } = event.data as {
        organization: { id: string; slug: string; name: string };
        public_user_data: { user_id: string };
        role: string;
      };

      await syncToBackend('/api/v1/webhooks/clerk/membership-deleted', {
        clerk_user_id: public_user_data.user_id,
        clerk_org_id: organization.id,
        org_name: organization.name,
        org_slug: organization.slug,
        role,
      });
      break;
    }

    default:
      // Log but don't fail for unhandled event types
      console.log(`Unhandled Clerk webhook event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

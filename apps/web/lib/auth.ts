import { auth, currentUser } from '@clerk/nextjs/server';
import type { UserContext } from '@acolyte/shared';

/**
 * Get the current user context from Clerk (server-side only).
 * Extracts role and college_id from Clerk metadata.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const metadata = user.publicMetadata as {
    role?: string;
    college_id?: string;
    department_id?: string;
  };

  return {
    id: userId,
    clerk_user_id: userId,
    email: user.emailAddresses[0]?.emailAddress || '',
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    role: (metadata.role as UserContext['role']) || 'student',
    college_id: metadata.college_id || '',
    department_id: metadata.department_id,
  };
}

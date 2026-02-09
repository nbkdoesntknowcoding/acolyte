import { redirect } from 'next/navigation';
import { getCurrentUser, getDashboardPath } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getDashboardPath(user.role));
  }

  redirect('/sign-in');
}

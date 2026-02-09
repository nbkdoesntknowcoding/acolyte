import { redirect } from 'next/navigation';
import { requireAuth, getDashboardPath } from '@/lib/auth';

export default async function DashboardIndex() {
  const user = await requireAuth();
  redirect(getDashboardPath(user.role));
}

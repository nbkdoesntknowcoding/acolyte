import { requireRole } from '@/lib/auth';

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  await requireRole('dean', 'management');
  return <>{children}</>;
}

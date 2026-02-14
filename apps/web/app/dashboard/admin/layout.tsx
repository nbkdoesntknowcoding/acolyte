import { requireRole } from '@/lib/auth';
import { AdminProviders } from '@/components/admin/providers';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin');
  return <AdminProviders>{children}</AdminProviders>;
}

import { requireRole } from '@/lib/auth';

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  await requireRole('compliance_officer', 'dean', 'admin', 'management');
  return <>{children}</>;
}

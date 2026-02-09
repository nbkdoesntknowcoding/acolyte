import { requireRole } from '@/lib/auth';

export default async function FacultyLayout({ children }: { children: React.ReactNode }) {
  await requireRole('faculty', 'hod');
  return <>{children}</>;
}

export default function FacultyDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Assessments" value="--" subtitle="Pending review" />
        <DashboardCard title="Logbook Entries" value="--" subtitle="Awaiting sign-off" />
        <DashboardCard title="Question Bank" value="--" subtitle="Total items" />
        <DashboardCard title="Rotations" value="--" subtitle="Active postings" />
      </div>
      <p className="text-gray-500">
        Faculty dashboard — Assessments, Logbook, Question Bank, Rotations, Lesson Plans
      </p>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-surface p-6">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

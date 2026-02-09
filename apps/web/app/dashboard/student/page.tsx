export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Study Sessions" value="--" subtitle="This week" />
        <DashboardCard title="Flashcards Due" value="--" subtitle="For review today" />
        <DashboardCard title="Practice Tests" value="--" subtitle="Completed" />
        <DashboardCard title="Competencies" value="--" subtitle="Logged" />
      </div>
      <p className="text-gray-500">Student dashboard — Study, Practice, Flashcards, AI Chat</p>
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

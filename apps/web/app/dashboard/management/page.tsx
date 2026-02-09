export default function ManagementDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Departments" value="--" subtitle="Total" />
        <DashboardCard title="Compliance" value="--" subtitle="Institution score" />
        <DashboardCard title="Revenue" value="--" subtitle="This academic year" />
        <DashboardCard title="At-Risk Areas" value="--" subtitle="Require attention" />
      </div>
      <p className="text-gray-500">
        Management dashboard — Executive Summary, Cross-Department Analytics, Financial Reports
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

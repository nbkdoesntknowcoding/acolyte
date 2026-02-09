export default function ComplianceDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Compliance Score" value="--" subtitle="Overall" />
        <DashboardCard title="Faculty MSR" value="--" subtitle="Current ratio" />
        <DashboardCard title="AEBAS Attendance" value="--" subtitle="This month avg" />
        <DashboardCard title="Alerts" value="--" subtitle="Active warnings" />
      </div>
      <p className="text-gray-500">
        Compliance dashboard — MSR Monitoring, AEBAS, SAF Generation, Inspection Readiness, NAAC,
        NBA
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

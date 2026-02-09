export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Total Students" value="--" subtitle="Active enrollment" />
        <DashboardCard title="Faculty" value="--" subtitle="On roster" />
        <DashboardCard title="Fee Collection" value="--" subtitle="This semester" />
        <DashboardCard title="Pending Admissions" value="--" subtitle="Awaiting docs" />
      </div>
      <p className="text-gray-500">
        Admin dashboard — SIS, Fees, HR/Payroll, Hostel, Certificates, Communications
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

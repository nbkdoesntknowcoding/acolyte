'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useLicenseDetail, useLicenseAction, useUpdateLicense } from '@/lib/platform-api';

function Gauge({
  label,
  current,
  limit,
  unit,
}: {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const color =
    pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-brand-500';
  const stroke =
    pct >= 90 ? '#ef4444' : pct >= 70 ? '#eab308' : '#00C853';

  // SVG circular gauge
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center rounded-lg border border-dark-border bg-dark-surface p-4">
      <svg width="88" height="88" className="mb-2">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#2A2A2A"
          strokeWidth="6"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 44 44)"
        />
        <text
          x="44"
          y="44"
          textAnchor="middle"
          dominantBaseline="middle"
          className={`text-sm font-bold ${color}`}
          fill="currentColor"
        >
          {pct.toFixed(0)}%
        </text>
      </svg>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-[10px] text-gray-500">
        {current}{unit ? ` ${unit}` : ''} / {limit}{unit ? ` ${unit}` : ''}
      </p>
    </div>
  );
}

function FeatureToggle({
  name,
  enabled,
  onToggle,
}: {
  name: string;
  enabled: boolean;
  onToggle?: (name: string, newValue: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle?.(name, !enabled)}
      className="flex w-full items-center justify-between rounded border border-dark-border px-3 py-1.5 hover:bg-dark-elevated"
    >
      <span className="text-xs text-gray-300">
        {name.replace(/_/g, ' ')}
      </span>
      <span
        className={`h-3 w-6 rounded-full ${enabled ? 'bg-brand-500' : 'bg-dark-muted'} relative inline-block`}
      >
        <span
          className={`absolute top-0.5 h-2 w-2 rounded-full bg-white transition-transform ${enabled ? 'translate-x-3' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}

export default function LicenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data, isLoading, error } = useLicenseDetail(id);
  const licenseAction = useLicenseAction();
  const updateLicense = useUpdateLicense();

  const handleFeatureToggle = async (featureName: string, newValue: boolean) => {
    if (!data) return;
    const updated = { ...data.license.enabled_features, [featureName]: newValue };
    try {
      await updateLicense.mutateAsync({
        id,
        data: { enabled_features: updated },
      });
    } catch {
      // Error in mutation state
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>;
  }
  if (error || !data) {
    return <div className="flex h-64 items-center justify-center text-red-400">Failed to load license</div>;
  }

  const { license: lic, usage, snapshots, active_alerts } = data;

  const chartData = snapshots
    .slice()
    .reverse()
    .map((s) => ({
      date: s.snapshot_date,
      students: s.active_students,
      faculty: s.active_faculty,
      ai_tokens: s.ai_tokens_month_to_date,
    }));

  const handleAction = async (action: string, body?: Record<string, unknown>) => {
    if (action === 'suspend') {
      const reason = prompt('Reason for suspension:');
      if (!reason) return;
      body = { reason };
    }
    if (action === 'terminate') {
      const reason = prompt('Reason for termination:');
      if (!reason) return;
      body = { reason };
    }
    try {
      await licenseAction.mutateAsync({ id, action, body });
    } catch {
      // Error in mutation state
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/platform/licenses')}
          className="text-sm text-gray-400 hover:text-white"
        >
          &larr; Licenses
        </button>
        <h1 className="text-xl font-bold">{lic.plan_name}</h1>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            lic.status === 'active'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {lic.status}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p className="text-[10px] text-gray-500">Plan Tier</p>
          <p className="mt-1 text-sm font-medium">{lic.plan_tier}</p>
        </div>
        <div className="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p className="text-[10px] text-gray-500">Billing</p>
          <p className="mt-1 text-sm font-medium">{lic.billing_cycle}</p>
          {lic.price_inr && (
            <p className="text-[10px] text-gray-500">
              ₹{(lic.price_inr / 100_000).toFixed(1)}L/yr
            </p>
          )}
        </div>
        <div className="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p className="text-[10px] text-gray-500">Activated</p>
          <p className="mt-1 text-sm font-medium">
            {lic.activated_at ? new Date(lic.activated_at).toLocaleDateString() : '--'}
          </p>
        </div>
        <div className="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p className="text-[10px] text-gray-500">Expires</p>
          <p className="mt-1 text-sm font-medium">
            {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Usage gauges */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Gauge
          label="Students"
          current={usage.students.current}
          limit={usage.students.limit}
        />
        <Gauge
          label="Faculty"
          current={usage.faculty.current}
          limit={usage.faculty.limit}
        />
        <Gauge
          label="AI Budget"
          current={usage.ai_budget.current}
          limit={usage.ai_budget.limit}
          unit="USD"
        />
        <Gauge
          label="Storage"
          current={usage.storage.current}
          limit={usage.storage.limit}
          unit="GB"
        />
      </div>

      {/* Feature toggles */}
      <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-400">Feature Access</h3>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {Object.entries(lic.enabled_features).map(([name, enabled]) => (
            <FeatureToggle
              key={name}
              name={name}
              enabled={enabled}
              onToggle={handleFeatureToggle}
            />
          ))}
        </div>
        {updateLicense.isSuccess && (
          <p className="mt-2 text-xs text-green-400">Feature updated successfully</p>
        )}
        {updateLicense.isError && (
          <p className="mt-2 text-xs text-red-400">
            Failed to update: {(updateLicense.error as Error).message}
          </p>
        )}
      </div>

      {/* Usage history chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            Usage History (30d)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#111',
                    border: '1px solid #333',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="students" stroke="#00C853" fill="#00C853" fillOpacity={0.1} />
                <Area type="monotone" dataKey="faculty" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-dark-border bg-dark-surface p-4">
        <h3 className="w-full text-sm font-medium text-gray-400">Actions</h3>
        {lic.status !== 'active' && (
          <button
            onClick={() => handleAction('activate')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            Activate
          </button>
        )}
        {lic.status === 'active' && (
          <button
            onClick={() => handleAction('suspend')}
            className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
          >
            Suspend
          </button>
        )}
        {lic.status === 'suspended' && (
          <button
            onClick={() => handleAction('reinstate')}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Reinstate
          </button>
        )}
        {lic.status !== 'terminated' && (
          <button
            onClick={() => handleAction('terminate')}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Terminate
          </button>
        )}
      </div>

      {/* Active alerts for this college */}
      {active_alerts.length > 0 && (
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            Active Alerts ({active_alerts.length})
          </h3>
          <div className="space-y-2">
            {active_alerts.map((a) => (
              <div key={a.id} className="rounded border border-dark-border p-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {a.severity}
                  </span>
                  <span className="text-xs text-white">{a.title}</span>
                </div>
                <p className="mt-1 text-[10px] text-gray-500">{a.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

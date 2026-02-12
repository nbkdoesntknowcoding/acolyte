'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLicenses, useCreateLicense } from '@/lib/platform-api';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10',
  suspended: 'text-red-400 bg-red-500/10',
  expired: 'text-orange-400 bg-orange-500/10',
  cancelled: 'text-gray-400 bg-gray-500/10',
  trial: 'text-blue-400 bg-blue-500/10',
  terminated: 'text-red-500 bg-red-500/20',
};

const PLAN_TIERS = ['pilot', 'starter', 'professional', 'enterprise'];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[status] ?? 'text-gray-400 bg-gray-500/10'}`}
    >
      {status}
    </span>
  );
}

function UsageBar({ current, limit }: { current: number; limit: number }) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-brand-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-dark-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400">{current}/{limit}</span>
    </div>
  );
}

export default function LicensesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useLicenses({
    status: statusFilter || undefined,
    plan_tier: planFilter || undefined,
    search: search || undefined,
    page,
    per_page: 20,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Licenses</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Create License
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search college name or code..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
          <option value="trial">Trial</option>
          <option value="terminated">Terminated</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All plans</option>
          {PLAN_TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-dark-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border bg-dark-surface text-left text-xs text-gray-500">
              <th className="px-4 py-2.5">College</th>
              <th className="px-3 py-2.5">Plan</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Students</th>
              <th className="px-3 py-2.5">AI Budget</th>
              <th className="px-3 py-2.5">Expires</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No licenses found</td></tr>
            )}
            {data?.items.map((lic) => (
              <tr key={lic.id} className="border-b border-dark-border hover:bg-dark-elevated">
                <td className="px-4 py-2.5">
                  <Link href={`/platform/licenses/${lic.id}`} className="font-medium text-white hover:text-brand-500">
                    {lic.college_name || lic.plan_name}
                  </Link>
                  <p className="text-[10px] text-gray-500">
                    {lic.plan_name} &middot; {lic.college_id.slice(0, 8)}...
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-dark-elevated px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
                    {lic.plan_tier}
                  </span>
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={lic.status} /></td>
                <td className="px-3 py-2.5">
                  <UsageBar current={lic.current_students ?? 0} limit={lic.max_students} />
                </td>
                <td className="px-3 py-2.5">
                  <UsageBar current={lic.ai_tokens_month_to_date ?? 0} limit={lic.monthly_ai_token_budget} />
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-400">
                  {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : '--'}
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/platform/licenses/${lic.id}`} className="text-xs text-brand-500 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} licenses total</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border border-dark-border px-3 py-1 hover:bg-dark-elevated disabled:opacity-30"
            >
              Prev
            </button>
            <span className="px-2 py-1">
              {page} / {data.pages}
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="rounded border border-dark-border px-3 py-1 hover:bg-dark-elevated disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create License Modal */}
      {showCreate && <CreateLicenseModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create License Modal
// ---------------------------------------------------------------------------

function CreateLicenseModal({ onClose }: { onClose: () => void }) {
  const createLicense = useCreateLicense();
  const [form, setForm] = useState({
    college_name: '',
    college_code: '',
    state: '',
    plan_tier: 'pilot',
    billing_cycle: 'annual',
    contract_value_inr: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLicense.mutateAsync({
        ...form,
        contract_value_inr: form.contract_value_inr
          ? parseInt(form.contract_value_inr)
          : undefined,
      });
      onClose();
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-dark-border bg-dark-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Create License</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {(['college_name', 'college_code', 'state'] as const).map((field) => (
            <div key={field}>
              <label className="mb-1 block text-xs text-gray-400">
                {field.replace('_', ' ')}
              </label>
              <input
                required={field === 'college_name'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Plan Tier</label>
            <select
              value={form.plan_tier}
              onChange={(e) => setForm({ ...form, plan_tier: e.target.value })}
              className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {PLAN_TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Contract Value (INR)</label>
            <input
              type="number"
              value={form.contract_value_inr}
              onChange={(e) => setForm({ ...form, contract_value_inr: e.target.value })}
              className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {createLicense.isError && (
            <p className="text-xs text-red-400">
              {(createLicense.error as Error).message}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-dark-border px-4 py-1.5 text-sm text-gray-400 hover:bg-dark-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLicense.isPending}
              className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {createLicense.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAuditLog } from '@/lib/platform-api';

const ACTION_COLORS: Record<string, string> = {
  'license.create': 'bg-green-500/10 text-green-400',
  'license.activate': 'bg-blue-500/10 text-blue-400',
  'license.suspend': 'bg-yellow-500/10 text-yellow-400',
  'license.reinstate': 'bg-blue-500/10 text-blue-400',
  'license.terminate': 'bg-red-500/10 text-red-400',
  'license.update': 'bg-purple-500/10 text-purple-400',
  'college.create': 'bg-green-500/10 text-green-400',
  'alert.acknowledge': 'bg-yellow-500/10 text-yellow-400',
  'alert.resolve': 'bg-green-500/10 text-green-400',
};

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLog({
    action: actionFilter || undefined,
    entity_type: entityFilter || undefined,
    page,
    per_page: 25,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Audit Log</h1>
        {data && (
          <span className="text-xs text-gray-500">
            {data.total} entr{data.total !== 1 ? 'ies' : 'y'}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All actions</option>
          <option value="license.create">license.create</option>
          <option value="license.activate">license.activate</option>
          <option value="license.suspend">license.suspend</option>
          <option value="license.reinstate">license.reinstate</option>
          <option value="license.terminate">license.terminate</option>
          <option value="license.update">license.update</option>
          <option value="college.create">college.create</option>
          <option value="alert.acknowledge">alert.acknowledge</option>
          <option value="alert.resolve">alert.resolve</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All entity types</option>
          <option value="license">License</option>
          <option value="college">College</option>
          <option value="alert">Alert</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-dark-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border bg-dark-surface text-left text-xs text-gray-500">
              <th className="px-4 py-2.5">Timestamp</th>
              <th className="px-3 py-2.5">Admin</th>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Entity</th>
              <th className="px-3 py-2.5">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading audit log...
                </td>
              </tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No audit log entries match the current filters
                </td>
              </tr>
            )}
            {data?.items.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-dark-border hover:bg-dark-elevated"
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2.5">
                  <p className="text-xs text-white">
                    {entry.actor_email || entry.actor_id.slice(0, 12) + '...'}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      ACTION_COLORS[entry.action] ?? 'bg-gray-500/10 text-gray-400'
                    }`}
                  >
                    {entry.action}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <p className="text-xs text-gray-300">{entry.entity_type}</p>
                  {entry.entity_id && (
                    <p className="text-[10px] text-gray-500">
                      {entry.entity_id.slice(0, 8)}...
                    </p>
                  )}
                </td>
                <td className="max-w-xs px-3 py-2.5">
                  {entry.changes ? (
                    <p className="truncate text-[10px] text-gray-500">
                      {JSON.stringify(entry.changes).slice(0, 80)}
                      {JSON.stringify(entry.changes).length > 80 ? '...' : ''}
                    </p>
                  ) : (
                    <span className="text-[10px] text-gray-600">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {data.total} entr{data.total !== 1 ? 'ies' : 'y'} total
          </span>
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
    </div>
  );
}

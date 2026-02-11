'use client';

import { useState } from 'react';
import { useAlerts, useAlertAction, type PlatformAlert } from '@/lib/platform-api';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  error: 'bg-orange-500/20 text-orange-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  info: 'bg-blue-500/20 text-blue-400',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-500/10 text-red-400',
  acknowledged: 'bg-yellow-500/10 text-yellow-400',
  resolved: 'bg-green-500/10 text-green-400',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function AlertRow({
  alert,
  onAcknowledge,
  onResolve,
}: {
  alert: PlatformAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-dark-border">
      <div
        className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-dark-elevated"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.info}`}
        >
          {alert.severity}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white">{alert.title}</p>
          <p className="mt-0.5 truncate text-[10px] text-gray-500">
            {alert.details}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {alert.source_component && (
            <span className="rounded bg-dark-elevated px-1.5 py-0.5 text-[10px] text-gray-400">
              {alert.source_component}
            </span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[alert.status] ?? STATUS_COLORS.active}`}
          >
            {alert.status}
          </span>
          <span className="text-[10px] text-gray-500">
            {timeAgo(alert.created_at)}
          </span>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-dark-border bg-dark-bg px-4 py-3">
          <div className="space-y-2 text-xs">
            <p className="text-gray-300">{alert.details}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
              {alert.category && <span>Category: {alert.category}</span>}
              {alert.college_id && (
                <span>College: {alert.college_id.slice(0, 8)}...</span>
              )}
              {alert.source_component && (
                <span>Source: {alert.source_component}</span>
              )}
              <span>
                Created: {new Date(alert.created_at).toLocaleString()}
              </span>
              {alert.acknowledged_at && (
                <span>
                  Acknowledged:{' '}
                  {new Date(alert.acknowledged_at).toLocaleString()}
                </span>
              )}
              {alert.resolved_at && (
                <span>
                  Resolved: {new Date(alert.resolved_at).toLocaleString()}
                </span>
              )}
              {alert.resolution_notes && (
                <span>Notes: {alert.resolution_notes}</span>
              )}
            </div>
            {alert.status !== 'resolved' && (
              <div className="flex gap-2 pt-1">
                {alert.status === 'active' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcknowledge(alert.id);
                    }}
                    className="rounded bg-yellow-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-yellow-700"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve(alert.id);
                  }}
                  className="rounded bg-green-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-700"
                >
                  Resolve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAlerts({
    severity: severityFilter || undefined,
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    page,
    per_page: 25,
  });

  const alertAction = useAlertAction();

  const handleAcknowledge = (id: string) => {
    alertAction.mutate({ id, action: 'acknowledge' });
  };

  const handleResolve = (id: string) => {
    const notes = prompt('Resolution notes (optional):');
    alertAction.mutate({
      id,
      action: 'resolve',
      body: notes ? { resolution_notes: notes } : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Platform Alerts</h1>
        {data && (
          <span className="text-xs text-gray-500">
            {data.total} alert{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">All categories</option>
          <option value="system">System</option>
          <option value="license">License</option>
          <option value="ai_budget">AI Budget</option>
          <option value="compliance">Compliance</option>
        </select>
      </div>

      {/* Alert list */}
      <div className="rounded-lg border border-dark-border">
        {isLoading && (
          <div className="px-4 py-8 text-center text-gray-500">
            Loading alerts...
          </div>
        )}
        {data?.items.length === 0 && !isLoading && (
          <div className="px-4 py-8 text-center text-gray-500">
            No alerts match the current filters
          </div>
        )}
        {data?.items.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
          />
        ))}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {data.total} alert{data.total !== 1 ? 's' : ''} total
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

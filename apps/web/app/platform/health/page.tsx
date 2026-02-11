'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useHealthOverview, useHealthMetrics } from '@/lib/platform-api';

const COMPONENTS = ['api', 'database', 'redis', 'celery', 'ai_gateway', 'permify'] as const;

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  healthy: { color: 'text-green-400', bg: 'border-green-500/30', dot: 'bg-green-500' },
  degraded: { color: 'text-yellow-400', bg: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  unhealthy: { color: 'text-red-400', bg: 'border-red-500/30', dot: 'bg-red-500' },
  critical: { color: 'text-red-500', bg: 'border-red-600/30', dot: 'bg-red-600' },
  unknown: { color: 'text-gray-400', bg: 'border-gray-500/30', dot: 'bg-gray-500' },
};

function ComponentCard({
  name,
  status,
  details,
}: {
  name: string;
  status: string;
  details: Record<string, unknown>;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <div className={`rounded-lg border ${cfg.bg} bg-dark-surface p-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium capitalize text-white">
          {name.replace('_', ' ')}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs ${cfg.color}`}>{status}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {Object.entries(details).map(([k, v]) => (
          <div key={k} className="flex justify-between text-[10px]">
            <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
            <span className="text-gray-300">{String(v)}</span>
          </div>
        ))}
        {Object.keys(details).length === 0 && (
          <p className="text-[10px] text-gray-600">No metrics available</p>
        )}
      </div>
    </div>
  );
}

function MetricChart({
  title,
  component,
  metricName,
  color,
  unit,
}: {
  title: string;
  component: string;
  metricName: string;
  color: string;
  unit?: string;
}) {
  const { data } = useHealthMetrics(component, metricName);

  const chartData = (data ?? [])
    .slice()
    .reverse()
    .map((p) => ({
      time: new Date(p.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: p.value,
    }));

  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-400">{title}</h3>
      <div className="h-40">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-600">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                tick={{ fill: '#666', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#666', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (unit ? `${v}${unit}` : String(v))}
              />
              <Tooltip
                contentStyle={{
                  background: '#111',
                  border: '1px solid #333',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  const { data: health, isLoading } = useHealthOverview();

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading health data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">System Health</h1>
        {health && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              health.system_status === 'healthy'
                ? 'bg-green-500/10 text-green-400'
                : health.system_status === 'degraded'
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-red-500/10 text-red-400'
            }`}
          >
            {health.system_status}
          </span>
        )}
        <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {/* Component status cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {COMPONENTS.map((comp) => {
          const c = health?.components[comp];
          return (
            <ComponentCard
              key={comp}
              name={comp}
              status={c?.status ?? 'unknown'}
              details={(c?.details ?? {}) as Record<string, unknown>}
            />
          );
        })}
      </div>

      {/* Metric charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Database Connections"
          component="database"
          metricName="total_connections"
          color="#6366f1"
        />
        <MetricChart
          title="Redis Latency"
          component="redis"
          metricName="ping_latency_ms"
          color="#f59e0b"
          unit="ms"
        />
        <MetricChart
          title="AI Gateway Error Rate"
          component="ai_gateway"
          metricName="error_rate_pct"
          color="#ef4444"
          unit="%"
        />
        <MetricChart
          title="AI Gateway Cache Hit Rate"
          component="ai_gateway"
          metricName="cache_hit_rate_pct"
          color="#00C853"
          unit="%"
        />
        <MetricChart
          title="Celery Queue Depth"
          component="celery"
          metricName="queue_depth"
          color="#8b5cf6"
        />
        <MetricChart
          title="AI Gateway Avg Latency"
          component="ai_gateway"
          metricName="avg_latency_ms"
          color="#06b6d4"
          unit="ms"
        />
      </div>
    </div>
  );
}

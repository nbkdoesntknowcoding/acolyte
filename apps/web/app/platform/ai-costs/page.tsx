'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAICosts, useHealthMetrics } from '@/lib/platform-api';

const MODEL_COLORS: Record<string, string> = {
  'claude-sonnet': '#6366f1',
  'claude-haiku': '#a78bfa',
  'gpt-4o': '#10b981',
  'gpt-4o-mini': '#34d399',
  'text-embedding-3-large': '#f59e0b',
};
const FALLBACK_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

export default function AICostsPage() {
  const { data, isLoading } = useAICosts();
  const [sortKey, setSortKey] = useState<'cost_usd' | 'pct_used'>('cost_usd');
  const [sortAsc, setSortAsc] = useState(false);

  // Daily cost trend from health metrics
  const { data: dailyCostMetrics } = useHealthMetrics(
    'ai_gateway',
    'daily_cost_usd'
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Loading AI cost data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No cost data available
      </div>
    );
  }

  const allZero =
    data.total_cost_today_usd === 0 &&
    data.total_cost_this_month_usd === 0 &&
    data.by_college.length === 0 &&
    data.by_model.length === 0 &&
    data.by_agent.length === 0;

  // Sort colleges
  const sortedColleges = [...data.by_college].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  // Model chart data
  const modelData = data.by_model.map((m) => ({
    name: m.model,
    cost: +m.cost_usd.toFixed(2),
    tokens: m.token_count,
  }));

  // Agent chart data
  const agentData = data.by_agent
    .slice()
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 10)
    .map((a) => ({
      name: a.agent_id,
      cost: +a.cost_usd.toFixed(2),
      calls: a.call_count,
    }));

  // Daily trend from metrics endpoint
  const dailyTrend = (dailyCostMetrics ?? [])
    .slice()
    .reverse()
    .map((p) => ({
      date: new Date(p.timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }),
      cost: p.value,
    }));

  const handleSort = (key: 'cost_usd' | 'pct_used') => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">AI Costs</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="This Month"
          value={`$${data.total_cost_this_month_usd.toFixed(2)}`}
          color="text-white"
        />
        <StatCard
          label="Projected Monthly"
          value={`$${data.projected_monthly_cost_usd.toFixed(2)}`}
          sub="Based on current usage"
          color="text-yellow-400"
        />
        <StatCard
          label="Today"
          value={`$${data.total_cost_today_usd.toFixed(2)}`}
        />
        <StatCard
          label="Cache Savings"
          value={`$${data.cache_savings_usd.toFixed(2)}`}
          sub="Saved via prompt caching"
          color="text-brand-500"
        />
      </div>

      {allZero && (
        <div className="rounded-lg border border-dark-border bg-dark-surface p-6 text-center">
          <p className="text-sm text-gray-400">
            No AI calls recorded yet. Costs will appear here once colleges
            start using AI features.
          </p>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cost by model (pie) */}
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            Cost by Model
          </h3>
          {modelData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-gray-600">
              No model data
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelData}
                    dataKey="cost"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {modelData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={MODEL_COLORS[entry.name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#111',
                      border: '1px solid #333',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [`$${v}`, 'Cost']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Cost by agent (bar) */}
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            Top Agents by Cost
          </h3>
          {agentData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-gray-600">
              No agent data
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentData} layout="vertical">
                  <XAxis
                    type="number"
                    tick={{ fill: '#666', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#999', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111',
                      border: '1px solid #333',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [`$${v}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Daily cost trend */}
      {dailyTrend.length > 0 && (
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            Daily Cost Trend
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111',
                    border: '1px solid #333',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#00C853"
                  fill="#00C853"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cost by college table */}
      <div className="rounded-lg border border-dark-border">
        <div className="border-b border-dark-border bg-dark-surface px-4 py-3">
          <h3 className="text-sm font-medium text-gray-400">
            Cost by College
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-left text-xs text-gray-500">
                <th className="px-4 py-2.5">College</th>
                <th
                  className="cursor-pointer px-3 py-2.5 hover:text-white"
                  onClick={() => handleSort('cost_usd')}
                >
                  Cost (USD){' '}
                  {sortKey === 'cost_usd' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2.5">Budget</th>
                <th
                  className="cursor-pointer px-3 py-2.5 hover:text-white"
                  onClick={() => handleSort('pct_used')}
                >
                  Usage{' '}
                  {sortKey === 'pct_used' && (sortAsc ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedColleges.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No college cost data
                  </td>
                </tr>
              )}
              {sortedColleges.map((c) => {
                const pctColor =
                  c.pct_used >= 90
                    ? 'text-red-400'
                    : c.pct_used >= 70
                      ? 'text-yellow-400'
                      : 'text-gray-300';
                const barColor =
                  c.pct_used >= 90
                    ? 'bg-red-500'
                    : c.pct_used >= 70
                      ? 'bg-yellow-500'
                      : 'bg-brand-500';
                return (
                  <tr
                    key={c.college_id}
                    className="border-b border-dark-border hover:bg-dark-elevated"
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-white">
                        {c.college_name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {c.college_id.slice(0, 8)}...
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-white">
                      ${c.cost_usd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      ${c.budget_usd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-dark-muted">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{
                              width: `${Math.min(c.pct_used, 100)}%`,
                            }}
                          />
                        </div>
                        <span className={`text-[10px] ${pctColor}`}>
                          {c.pct_used.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

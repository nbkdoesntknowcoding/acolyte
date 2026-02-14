'use client';

import { useState } from 'react';
import {
  useTestSuites,
  useRunTests,
  type TestRunResult,
} from '@/lib/platform-api';

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  passed: { color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-500', label: 'All Passed' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500', label: 'Failures' },
  timeout: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', label: 'Timeout' },
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function SystemTestsPage() {
  const { data: suites, isLoading: suitesLoading, isError: suitesError, error: suitesErrorObj, status: suitesStatus } = useTestSuites();
  const runTests = useRunTests();

  // Debug: log suite query state
  console.log('[SystemTests] suites query:', { status: suitesStatus, count: suites?.length, isError: suitesError });
  const [selectedSuite, setSelectedSuite] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<TestRunResult[]>([]);
  const [activeResult, setActiveResult] = useState<TestRunResult | null>(null);

  const handleRunTests = async () => {
    try {
      const result = await runTests.mutateAsync({
        suite: selectedSuite || undefined,
        keyword: keyword || undefined,
      });
      setActiveResult(result);
      setResults((prev) => [result, ...prev].slice(0, 20));
    } catch {
      // Error handled by mutation state
    }
  };

  const statusCfg = activeResult
    ? STATUS_CONFIG[activeResult.status] ?? STATUS_CONFIG.failed
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">System Tests</h1>
          <p className="mt-1 text-xs text-gray-500">
            Run backend E2E tests from the platform admin
          </p>
        </div>
        {activeResult && statusCfg && (
          <span
            className={`rounded px-2.5 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
          >
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Suite selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Test Suite
            </label>
            <select
              value={selectedSuite}
              onChange={(e) => setSelectedSuite(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            >
              <option value="">All Suites</option>
              {suites?.map((s) => (
                <option key={s.file} value={s.file}>
                  {s.label} ({s.file})
                </option>
              ))}
            </select>
          </div>

          {/* Keyword filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Keyword Filter (pytest -k)
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. TestStudents or test_admin_can"
              className="w-full rounded-md border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-brand-500"
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleRunTests}
            disabled={runTests.isPending}
            className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
              runTests.isPending
                ? 'bg-dark-elevated text-gray-500 cursor-not-allowed'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            {runTests.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-500 border-t-white" />
                Running...
              </span>
            ) : (
              'Run Tests'
            )}
          </button>
        </div>

        {suitesLoading && (
          <p className="mt-3 text-xs text-gray-500">Loading test suites...</p>
        )}

        {suitesError && (
          <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
            <p className="text-xs text-yellow-400">
              Could not load test suites — the backend test-runner endpoint may not be deployed yet.
            </p>
            <p className="mt-1 text-[10px] text-gray-500">
              {(suitesErrorObj as Error)?.message || 'Unknown error'}
            </p>
          </div>
        )}

        {suites && (
          <p className="mt-3 text-xs text-gray-500">
            {suites.length} test suite{suites.length !== 1 ? 's' : ''} available
          </p>
        )}
      </div>

      {/* Error display */}
      {runTests.isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">
            Failed to run tests: {(runTests.error as Error)?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {/* Active result */}
      {activeResult && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Total Tests" value={activeResult.total} color="text-white" />
            <StatCard label="Passed" value={activeResult.passed} color="text-green-400" />
            <StatCard label="Failed" value={activeResult.failed} color={activeResult.failed > 0 ? 'text-red-400' : 'text-gray-500'} />
            <StatCard label="Errors" value={activeResult.errors} color={activeResult.errors > 0 ? 'text-orange-400' : 'text-gray-500'} />
            <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
              <p className="text-xs text-gray-500">Duration</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {activeResult.duration_seconds.toFixed(2)}s
              </p>
            </div>
          </div>

          {/* Pass rate bar */}
          {activeResult.total > 0 && (
            <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Pass Rate</span>
                <span className="text-sm font-medium text-white">
                  {Math.round((activeResult.passed / activeResult.total) * 100)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-dark-elevated">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(activeResult.passed / activeResult.total) * 100}%` }}
                />
                {activeResult.failed > 0 && (
                  <div
                    className="h-full -mt-3 rounded-full bg-red-500 transition-all duration-500"
                    style={{
                      width: `${(activeResult.failed / activeResult.total) * 100}%`,
                      marginLeft: `${(activeResult.passed / activeResult.total) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Test output */}
          <div className="rounded-lg border border-dark-border bg-dark-surface">
            <div className="flex items-center justify-between border-b border-dark-border px-4 py-3">
              <h2 className="text-sm font-medium text-white">Test Output</h2>
              <span className="text-[10px] text-gray-500">
                {activeResult.ran_at
                  ? new Date(activeResult.ran_at).toLocaleString()
                  : ''}
                {activeResult.suite && ` | ${activeResult.suite}`}
                {activeResult.keyword && ` | -k "${activeResult.keyword}"`}
              </span>
            </div>
            <pre className="max-h-[500px] overflow-auto p-4 font-mono text-xs leading-relaxed text-gray-300">
              {activeResult.output || 'No output'}
            </pre>
            {activeResult.stderr && (
              <>
                <div className="border-t border-dark-border px-4 py-2">
                  <span className="text-xs font-medium text-red-400">Stderr</span>
                </div>
                <pre className="max-h-[200px] overflow-auto p-4 font-mono text-xs leading-relaxed text-red-300/70">
                  {activeResult.stderr}
                </pre>
              </>
            )}
          </div>
        </>
      )}

      {/* History */}
      {results.length > 1 && (
        <div className="rounded-lg border border-dark-border bg-dark-surface">
          <div className="border-b border-dark-border px-4 py-3">
            <h2 className="text-sm font-medium text-white">Run History (this session)</h2>
          </div>
          <div className="divide-y divide-dark-border">
            {results.map((r, i) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.failed;
              return (
                <button
                  key={`${r.ran_at}-${i}`}
                  onClick={() => setActiveResult(r)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-dark-elevated ${
                    r === activeResult ? 'bg-dark-elevated' : ''
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <span className="flex-1 text-xs text-gray-300">
                    {r.suite || 'All suites'}
                    {r.keyword && ` (-k ${r.keyword})`}
                  </span>
                  <span className="text-xs text-green-400">{r.passed}P</span>
                  {r.failed > 0 && <span className="text-xs text-red-400">{r.failed}F</span>}
                  <span className="text-[10px] text-gray-500">
                    {r.duration_seconds.toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {r.ran_at ? new Date(r.ran_at).toLocaleTimeString() : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeResult && !runTests.isPending && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-dark-border">
          <div className="text-center">
            <p className="text-sm text-gray-400">No test results yet</p>
            <p className="mt-1 text-xs text-gray-600">
              Select a suite and click &quot;Run Tests&quot; to execute backend E2E tests
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

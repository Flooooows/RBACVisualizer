'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type AnomaliesResponse, type ImportListResponse } from '../lib/api';
import { AsyncState } from './async-state';
import { ProjectSelector } from './project-selector';
import { useProjectScope } from '../hooks/use-project-scope';

function severityClasses(severity: string): string {
  if (severity === 'CRITICAL') {
    return 'border-rose-700 bg-rose-950/30 text-rose-200';
  }

  if (severity === 'HIGH') {
    return 'border-amber-700 bg-amber-950/30 text-amber-200';
  }

  if (severity === 'MEDIUM') {
    return 'border-sky-700 bg-sky-950/30 text-sky-200';
  }

  return 'border-slate-700 bg-slate-900/60 text-slate-200';
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function severityWeight(severity: string): number {
  if (severity === 'CRITICAL') {
    return 4;
  }
  if (severity === 'HIGH') {
    return 3;
  }
  if (severity === 'MEDIUM') {
    return 2;
  }
  return 1;
}

export function AnomaliesClient(): JSX.Element {
  const projectScope = useProjectScope();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AnomaliesResponse['items']>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const summary = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator.total += 1;
        accumulator.bySeverity[item.severity] = (accumulator.bySeverity[item.severity] ?? 0) + 1;
        accumulator.byType[item.type] = (accumulator.byType[item.type] ?? 0) + 1;
        return accumulator;
      },
      {
        total: 0,
        bySeverity: {} as Record<string, number>,
        byType: {} as Record<string, number>,
      },
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSeverity = severityFilter === 'ALL' || item.severity === severityFilter;
      const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
      const haystack = [item.title, item.type, item.severity, JSON.stringify(item.details)]
        .join(' ')
        .toLowerCase();
      const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch);

      return matchesSeverity && matchesType && matchesSearch;
    });
  }, [items, searchTerm, severityFilter, typeFilter]);

  const severityOptions = useMemo(
    () => Object.keys(summary.bySeverity).sort(),
    [summary.bySeverity],
  );
  const typeOptions = useMemo(() => Object.keys(summary.byType).sort(), [summary.byType]);

  const topTypes = useMemo(
    () =>
      Object.entries(summary.byType)
        .sort(([, left], [, right]) => right - left)
        .slice(0, 3),
    [summary.byType],
  );

  const weightedRiskScore = useMemo(
    () => items.reduce((sum, item) => sum + severityWeight(item.severity), 0),
    [items],
  );

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        if (!projectScope.projectId) {
          setItems([]);
          return;
        }
        const imports = await apiFetch<ImportListResponse>(
          `/imports?projectId=${projectScope.projectId}`,
        );
        const latest = imports.items[0];

        if (!latest) {
          if (active) {
            setItems([]);
          }
          return;
        }

        const anomalies = await apiFetch<AnomaliesResponse>(
          `/anomalies?importId=${latest.id}&projectId=${projectScope.projectId}`,
        );
        if (active) {
          setImportId(latest.id);
          setItems(anomalies.items);
          setError(null);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load anomalies.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [projectScope.projectId]);

  if (loading || error || items.length === 0) {
    return (
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No findings yet. Broken role references and future anomaly rules will appear here after imports."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProjectSelector {...projectScope} onChange={projectScope.setProjectId} />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="app-panel p-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Risk distribution</h3>
            <span className="rounded-full bg-[#2d3449] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
              Current snapshot
            </span>
          </div>
          <div className="mt-8 flex h-64 items-end justify-between gap-2 px-4">
            {Object.entries(summary.bySeverity).map(([severity, count]) => {
              const height = `${Math.max(18, (count / Math.max(summary.total, 1)) * 100)}%`;

              return (
                <div key={severity} className="flex flex-1 flex-col items-center gap-3">
                  <div
                    className={[
                      'w-full rounded-t-xl transition-all duration-300',
                      severity === 'CRITICAL'
                        ? 'bg-rose-500/30 hover:bg-rose-500/45'
                        : severity === 'HIGH'
                          ? 'bg-amber-500/30 hover:bg-amber-500/45'
                          : severity === 'MEDIUM'
                            ? 'bg-sky-500/30 hover:bg-sky-500/45'
                            : 'bg-slate-500/25 hover:bg-slate-500/35',
                    ].join(' ')}
                    style={{ height }}
                  />
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                      {severity}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="app-panel p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Findings
              </p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-slate-50">
                {summary.total}
              </p>
            </div>
            <div className="mt-6 text-xs text-slate-400">Weighted risk score</div>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-amber-200">
              {weightedRiskScore}
            </p>
          </div>

          <div className="app-panel p-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-brand-100">
              Top finding types
            </h3>
            <div className="mt-4 space-y-3">
              {topTypes.map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-lg bg-[#131b2e] px-4 py-3"
                >
                  <p className="text-sm font-medium text-slate-100">{formatLabel(type)}</p>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="app-panel p-4">
        <h3 className="text-lg font-semibold text-white">Findings by type</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(summary.byType).map(([type, count]) => (
            <span
              key={type}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200"
            >
              {formatLabel(type)} · {count}
            </span>
          ))}
        </div>
      </div>

      <div className="app-panel grid gap-4 p-4 md:grid-cols-[1fr_1fr_1.4fr]">
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Severity
          </span>
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="app-select"
          >
            <option value="ALL">All severities</option>
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="app-select"
          >
            <option value="ALL">All types</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Search
          </span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="cluster-admin, secrets, broken-ref..."
            className="app-input"
          />
        </label>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-50">Active risk registry</h2>
        {filteredItems.map((item) => (
          <div key={item.id} className="app-panel p-6 transition hover:bg-[#1b2338]">
            {(() => {
              const details = (item.details ?? {}) as {
                subjectIds?: string[];
              };
              const firstSubjectId = details.subjectIds?.[0];

              return (
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={[
                        'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold',
                        item.severity === 'CRITICAL'
                          ? 'bg-rose-500/10 text-rose-200'
                          : item.severity === 'HIGH'
                            ? 'bg-amber-500/10 text-amber-200'
                            : item.severity === 'MEDIUM'
                              ? 'bg-sky-500/10 text-sky-200'
                              : 'bg-slate-500/10 text-slate-200',
                      ].join(' ')}
                    >
                      !
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-50">{item.title}</h3>
                        <span
                          className={[
                            'inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]',
                            severityClasses(item.severity),
                          ].join(' ')}
                        >
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{formatLabel(item.type)}</p>
                      <p className="mt-3 text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {importId && projectScope.projectId && firstSubjectId ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/subjects?importId=${encodeURIComponent(importId)}&projectId=${encodeURIComponent(projectScope.projectId)}&subjectId=${encodeURIComponent(firstSubjectId)}`}
                            className="rounded-lg bg-[#2d3449] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-[#31394d]"
                          >
                            Open subject access
                          </Link>
                          <Link
                            href={`/graph?importId=${encodeURIComponent(importId)}&projectId=${encodeURIComponent(projectScope.projectId)}&subjectId=${encodeURIComponent(firstSubjectId)}`}
                            className="rounded-lg bg-[#adc6ff] px-4 py-2 text-xs font-bold text-[#002e6a] transition hover:brightness-110"
                          >
                            Open subject graph
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <details className="w-full lg:max-w-[360px] app-panel-muted p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-200">
                      View raw finding details
                    </summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                      {JSON.stringify(item.details, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <AsyncState
          loading={false}
          error={null}
          empty
          emptyMessage="No findings match the active filters."
        />
      ) : null}
    </div>
  );
}

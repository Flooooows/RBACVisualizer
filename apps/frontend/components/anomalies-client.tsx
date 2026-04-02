'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type AnomaliesResponse, type ImportListResponse } from '../lib/api';
import { AsyncState } from './async-state';

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

export function AnomaliesClient(): JSX.Element {
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

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const imports = await apiFetch<ImportListResponse>('/imports');
        const latest = imports.items[0];

        if (!latest) {
          if (active) {
            setItems([]);
          }
          return;
        }

        const anomalies = await apiFetch<AnomaliesResponse>(`/anomalies?importId=${latest.id}`);
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
  }, []);

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-panel p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-100">Findings</p>
          <p className="mt-3 text-3xl font-semibold text-white">{summary.total}</p>
        </div>
        {Object.entries(summary.bySeverity).map(([severity, count]) => (
          <div key={severity} className="app-panel p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-100">
              {formatLabel(severity)}
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{count}</p>
          </div>
        ))}
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

      {filteredItems.map((item) => (
        <div key={item.id} className="app-panel p-4">
          {(() => {
            const details = (item.details ?? {}) as {
              subjectIds?: string[];
            };
            const firstSubjectId = details.subjectIds?.[0];

            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={[
                        'inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]',
                        severityClasses(item.severity),
                      ].join(' ')}
                    >
                      {item.severity}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{formatLabel(item.type)}</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                {importId && firstSubjectId ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/subjects?importId=${encodeURIComponent(importId)}&subjectId=${encodeURIComponent(firstSubjectId)}`}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500"
                    >
                      Open subject access
                    </Link>
                    <Link
                      href={`/graph?importId=${encodeURIComponent(importId)}&subjectId=${encodeURIComponent(firstSubjectId)}`}
                      className="rounded-full border border-brand-700 px-3 py-1 text-xs text-brand-100 transition hover:border-brand-500"
                    >
                      Open subject graph
                    </Link>
                  </div>
                ) : null}

                <details className="mt-4 app-panel-muted p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-200">
                    View raw finding details
                  </summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                    {JSON.stringify(item.details, null, 2)}
                  </pre>
                </details>
              </>
            );
          })()}
        </div>
      ))}

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

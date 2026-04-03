'use client';

import { useEffect, useState } from 'react';
import { apiFetch, type DashboardResponse, type ImportListResponse } from '../lib/api';
import { AsyncState } from './async-state';
import { ProjectSelector } from './project-selector';
import { StatCard } from './stat-card';
import { StatusChip } from './status-chip';
import { useProjectScope } from '../hooks/use-project-scope';

export function DashboardClient(): JSX.Element {
  const projectScope = useProjectScope();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        setLoading(true);
        if (!projectScope.projectId) {
          setDashboard(null);
          return;
        }
        const imports = await apiFetch<ImportListResponse>(
          `/imports?projectId=${projectScope.projectId}`,
        );
        const latest = imports.items[0];

        if (!latest) {
          if (active) {
            setDashboard(null);
            setError(null);
          }
          return;
        }

        const nextDashboard = await apiFetch<DashboardResponse>(
          `/dashboard?importId=${latest.id}&projectId=${projectScope.projectId}`,
        );
        if (active) {
          setDashboard(nextDashboard);
          setError(null);
        }
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error ? nextError.message : 'Failed to load dashboard data.',
          );
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

  if (projectScope.loading || loading || error || projectScope.error || !dashboard) {
    return (
      <AsyncState
        loading={loading || projectScope.loading}
        error={error ?? projectScope.error}
        empty={!dashboard && !loading && !error && !projectScope.loading && !projectScope.error}
        emptyMessage="No import snapshot yet. Use the Imports page to submit YAML or JSON manifests."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboard.cards.map((card) => (
          <StatCard
            key={card.id}
            label={card.label}
            value={card.value}
            accent={card.id === 'findings' ? 'amber' : card.id === 'bindings' ? 'mint' : 'blue'}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="app-panel p-5 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-brand-100/90">
                Latest snapshot
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-50">
                {dashboard.snapshotId}
              </h3>
            </div>
            <StatusChip tone={dashboard.snapshotStatus.includes('WARNING') ? 'warning' : 'success'}>
              {dashboard.snapshotStatus}
            </StatusChip>
          </div>
          <div className="mt-4">
            <ProjectSelector {...projectScope} onChange={projectScope.setProjectId} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="app-panel-muted p-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Imported</p>
              <p className="mt-3 text-base text-slate-100">
                {new Date(dashboard.importedAt).toLocaleString()}
              </p>
            </div>
            <div className="app-panel-muted p-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Completed</p>
              <p className="mt-3 text-base text-slate-100">
                {dashboard.completedAt
                  ? new Date(dashboard.completedAt).toLocaleString()
                  : 'Still processing'}
              </p>
            </div>
          </div>
        </div>

        <div className="app-panel p-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-brand-100/90">
            Analyst workflow
          </p>
          <div className="mt-5 space-y-4 text-sm text-slate-300">
            <div className="app-panel-muted p-4">
              <p className="font-medium text-slate-100">1. Review import posture</p>
              <p className="mt-2 text-slate-400">
                Confirm snapshot status, object volume, and whether findings were raised.
              </p>
            </div>
            <div className="app-panel-muted p-4">
              <p className="font-medium text-slate-100">2. Investigate anomalies</p>
              <p className="mt-2 text-slate-400">
                Pivot into findings, graph, and subject access to explain the granting path.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

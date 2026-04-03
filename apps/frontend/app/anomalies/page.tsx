import { Suspense } from 'react';
import { PageCard } from '../../components/page-card';
import { AnomaliesClient } from '../../components/anomalies-client';
import { StatusChip } from '../../components/status-chip';

export default function AnomaliesPage(): JSX.Element {
  return (
    <PageCard
      eyebrow="Risk findings"
      title="RBAC anomalies and privilege hotspots"
      description="Filter high-value RBAC findings, inspect their details, and pivot directly into graph or subject views when the anomaly includes context."
      aside={<StatusChip tone="warning">Heuristic analysis</StatusChip>}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading findings…</p>}>
        <AnomaliesClient />
      </Suspense>
    </PageCard>
  );
}

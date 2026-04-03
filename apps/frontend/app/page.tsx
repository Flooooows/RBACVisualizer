import { Suspense } from 'react';
import { PageCard } from '../components/page-card';
import { DashboardClient } from '../components/dashboard-client';
import { StatusChip } from '../components/status-chip';

export default function HomePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageCard
        eyebrow="Command center"
        title="Cluster RBAC posture dashboard"
        description="Track the latest RBAC import, review the current object footprint, and jump quickly into the highest-value investigations across your Kubernetes access graph."
        aside={<StatusChip tone="info">Kubernetes-first</StatusChip>}
      >
        <Suspense fallback={<p className="text-sm text-slate-400">Loading dashboard…</p>}>
          <DashboardClient />
        </Suspense>
      </PageCard>
    </div>
  );
}

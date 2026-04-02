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
        <DashboardClient />
      </PageCard>
    </div>
  );
}

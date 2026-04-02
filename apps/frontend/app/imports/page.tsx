import { PageCard } from '../../components/page-card';
import { ImportsClient } from '../../components/imports-client';
import { StatusChip } from '../../components/status-chip';

export default function ImportsPage(): JSX.Element {
  return (
    <PageCard
      eyebrow="Ingestion"
      title="Snapshot and cluster intake"
      description="Import RBAC data from manifests or a live Kubernetes cluster, then inspect validation, normalized object counts, and findings triggered by the snapshot."
      aside={<StatusChip tone="success">Read-only cluster import</StatusChip>}
    >
      <ImportsClient />
    </PageCard>
  );
}

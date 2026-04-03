import { Suspense } from 'react';
import { PageCard } from '../../components/page-card';
import { ResourcesClient } from '../../components/resources-client';
import { StatusChip } from '../../components/status-chip';

export default function ResourcesPage(): JSX.Element {
  return (
    <PageCard
      eyebrow="Resource lookup"
      title="Who can access this Kubernetes resource?"
      description="Search by resource and verb to discover which subjects can act, which bindings grant access, and whether the access is namespace or cluster scoped."
      aside={<StatusChip tone="default">Resource-centric</StatusChip>}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading resources…</p>}>
        <ResourcesClient />
      </Suspense>
    </PageCard>
  );
}

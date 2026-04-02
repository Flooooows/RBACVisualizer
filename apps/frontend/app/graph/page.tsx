import { Suspense } from 'react';
import { GraphClient } from '../../components/graph-client';
import { PageCard } from '../../components/page-card';
import { StatusChip } from '../../components/status-chip';

export default function GraphPage(): JSX.Element {
  return (
    <PageCard
      eyebrow="Investigation graph"
      title="Subject-focus RBAC path explorer"
      description="Trace subject-to-binding-to-role relationships in a workspace optimized for investigation, scope awareness, and permission-path inspection."
      aside={<StatusChip tone="info">React Flow projection</StatusChip>}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading graph view…</p>}>
        <GraphClient />
      </Suspense>
    </PageCard>
  );
}

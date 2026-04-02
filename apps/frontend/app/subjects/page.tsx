import { Suspense } from 'react';
import { PageCard } from '../../components/page-card';
import { SubjectsClient } from '../../components/subjects-client';
import { StatusChip } from '../../components/status-chip';

export default function SubjectsPage(): JSX.Element {
  return (
    <PageCard
      eyebrow="Identity inventory"
      title="Users, groups, and service accounts"
      description="Filter the subject catalog, inspect effective permissions, and confirm the RBAC path that grants resource access across namespace and cluster scope."
      aside={<StatusChip tone="default">Subject-centric</StatusChip>}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading subjects view…</p>}>
        <SubjectsClient />
      </Suspense>
    </PageCard>
  );
}

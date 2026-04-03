'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type ExplainAccessResponse,
  type ImportListResponse,
  type SubjectAccessResponse,
  type SubjectListResponse,
} from '../lib/api';
import { AsyncState } from './async-state';
import { ProjectSelector } from './project-selector';
import { useProjectScope } from '../hooks/use-project-scope';

export function SubjectsClient(): JSX.Element {
  const queryParams = useSearchParams();
  const projectScope = useProjectScope();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectListResponse['items']>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [access, setAccess] = useState<SubjectAccessResponse | null>(null);
  const [explain, setExplain] = useState<ExplainAccessResponse | null>(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;

    async function loadBootstrap(): Promise<void> {
      try {
        if (!projectScope.projectId) {
          setImportId(null);
          setSubjects([]);
          setSubjectId(null);
          return;
        }
        const imports = await apiFetch<ImportListResponse>(
          `/imports?projectId=${projectScope.projectId}`,
        );
        const requestedImportId = queryParams.get('importId');
        const latest =
          imports.items.find((item) => item.id === requestedImportId) ?? imports.items[0];

        if (!latest) {
          if (active) {
            setImportId(null);
            setSubjects([]);
            setSubjectId(null);
          }
          return;
        }

        const requestParams = new URLSearchParams({
          importId: latest.id,
          projectId: projectScope.projectId,
        });
        if (typeFilter !== 'ALL') {
          requestParams.set('type', typeFilter);
        }
        if (namespaceFilter.trim()) {
          requestParams.set('namespace', namespaceFilter.trim());
        }
        if (searchTerm.trim()) {
          requestParams.set('search', searchTerm.trim());
        }

        const list = await apiFetch<SubjectListResponse>(`/subjects?${requestParams.toString()}`);
        if (active) {
          setImportId(latest.id);
          setSubjects(list.items);
          const requestedSubjectId = queryParams.get('subjectId');
          setSubjectId((currentSubjectId) =>
            list.items.some((subject) => subject.id === requestedSubjectId)
              ? requestedSubjectId
              : list.items.some((subject) => subject.id === currentSubjectId)
                ? currentSubjectId
                : (list.items[0]?.id ?? null),
          );
          setError(null);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load subjects.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBootstrap();

    return () => {
      active = false;
    };
  }, [namespaceFilter, projectScope.projectId, queryParams, searchTerm, typeFilter]);

  useEffect(() => {
    if (!importId || !subjectId) {
      setAccess(null);
      setExplain(null);
      return;
    }

    let active = true;
    setLoading(true);

    async function loadAccess(): Promise<void> {
      try {
        const nextAccess = await apiFetch<SubjectAccessResponse>(
          `/subjects/${subjectId}/access?importId=${importId}&projectId=${projectScope.projectId}`,
        );
        const nextExplain = await apiFetch<ExplainAccessResponse>(
          `/subjects/${subjectId}/explain?importId=${importId}&projectId=${projectScope.projectId}&resource=pods&verb=get`,
        );
        if (active) {
          setAccess(nextAccess);
          setExplain(nextExplain);
          setError(null);
        }
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error ? nextError.message : 'Failed to load subject access.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAccess();

    return () => {
      active = false;
    };
  }, [importId, projectScope.projectId, subjectId]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId) ?? null,
    [subjectId, subjects],
  );

  const namespaceOptions = useMemo(
    () => Array.from(new Set(subjects.map((subject) => subject.namespace).filter(Boolean))).sort(),
    [subjects],
  );

  const stats = useMemo(
    () => ({
      total: subjects.length,
      serviceAccounts: subjects.filter((subject) => subject.kind === 'SERVICE_ACCOUNT').length,
      privilegedPaths: access?.permissions.length ?? 0,
      humanIdentities: subjects.filter((subject) => subject.kind !== 'SERVICE_ACCOUNT').length,
    }),
    [access?.permissions.length, subjects],
  );

  return (
    <div className="space-y-4">
      <ProjectSelector {...projectScope} onChange={projectScope.setProjectId} />
      <div className="app-panel grid gap-4 p-4 lg:grid-cols-[0.9fr_0.9fr_1.2fr_1.4fr]">
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="app-select"
          >
            <option value="ALL">All subject kinds</option>
            <option value="USER">User</option>
            <option value="GROUP">Group</option>
            <option value="SERVICE_ACCOUNT">ServiceAccount</option>
          </select>
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Namespace
          </span>
          <input
            list="subject-namespace-options"
            value={namespaceFilter}
            onChange={(event) => setNamespaceFilter(event.target.value)}
            placeholder="demo"
            className="app-input"
          />
          <datalist id="subject-namespace-options">
            {namespaceOptions.map((namespace) => (
              <option key={namespace} value={namespace ?? ''} />
            ))}
          </datalist>
        </label>

        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Search
          </span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="alice, app, system:masters..."
            className="app-input"
          />
        </label>

        <label htmlFor="subject-access-select" className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Subject
          </span>
          <select
            id="subject-access-select"
            value={subjectId ?? ''}
            onChange={(event) => setSubjectId(event.target.value || null)}
            className="app-select"
          >
            <option value="">Select a subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.kind} / {subject.namespace ? `${subject.namespace}/` : ''}
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        {selectedSubject ? (
          <p className="text-sm text-slate-400 lg:col-span-4">
            Tracing permissions for {selectedSubject.name}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Total Subjects
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">{stats.total}</p>
        </div>
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Service Accounts
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.serviceAccounts}
          </p>
        </div>
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Human identities
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.humanIdentities}
          </p>
        </div>
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Active paths
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.privilegedPaths}
          </p>
        </div>
      </div>

      {loading || error || !access ? (
        <AsyncState
          loading={loading}
          error={error}
          empty={!loading && !error && !access}
          emptyMessage="Import a snapshot with subjects to inspect effective access."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr_0.9fr]">
          <div className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-50">Subject inventory</h3>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-100">
                {subjects.length} shown
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {subjects.map((subject) => {
                const active = subject.id === subjectId;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setSubjectId(subject.id)}
                    className={[
                      'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition',
                      active ? 'bg-[#171f33]' : 'hover:bg-[#171f33]',
                    ].join(' ')}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-50">{subject.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {subject.kind}
                        {subject.namespace ? ` • ${subject.namespace}` : ' • cluster identity'}
                      </p>
                    </div>
                    <span
                      className={[
                        'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                        active
                          ? 'bg-brand-500/10 text-brand-100 ring-1 ring-brand-100/20'
                          : 'bg-[#2d3449] text-slate-300',
                      ].join(' ')}
                    >
                      {subject.kind === 'SERVICE_ACCOUNT' ? 'workload' : 'identity'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-50">Effective permissions</h3>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                {access.permissions.length} paths
              </span>
            </div>
            {access.permissions.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate-400">
                No resolved permissions for this subject in the selected snapshot.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {access.permissions.map((permission, index) => (
                  <div
                    key={`${permission.bindingId}-${permission.ruleIndex}-${index}`}
                    className="px-5 py-4 text-sm text-slate-300 transition hover:bg-[#171f33]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {permission.bindingName} → {permission.roleName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-100">
                          {permission.bindingKind} · {permission.roleKind} · {permission.scopeType}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#2d3449] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                        {permission.bindingNamespace ?? 'cluster'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                      <p>
                        Resources:{' '}
                        <span className="font-medium text-slate-100">
                          {permission.resources.join(', ') || 'non-resource'}
                        </span>
                      </p>
                      <p>
                        Verbs:{' '}
                        <span className="font-medium text-slate-100">
                          {permission.verbs.join(', ') || '*'}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="app-panel p-5">
            <h3 className="text-lg font-semibold text-white">
              Why does this subject have pod read access?
            </h3>
            {explain ? (
              explain.allowed ? (
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p className="text-emerald-300">
                    Allowed via {explain.matches.length} matching path(s).
                  </p>
                  {explain.matches.map((match, index) => (
                    <div
                      key={`${match.bindingId}-${match.ruleIndex}-${index}`}
                      className="app-panel-muted p-3"
                    >
                      <p className="font-medium text-white">{match.bindingName}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {match.roleKind} {match.roleName}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  No matching `get pods` permission path was found.
                </p>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

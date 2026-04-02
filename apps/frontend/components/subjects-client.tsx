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

export function SubjectsClient(): JSX.Element {
  const queryParams = useSearchParams();
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
        const imports = await apiFetch<ImportListResponse>('/imports');
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

        const requestParams = new URLSearchParams({ importId: latest.id });
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
  }, [namespaceFilter, queryParams, searchTerm, typeFilter]);

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
          `/subjects/${subjectId}/access?importId=${importId}`,
        );
        const nextExplain = await apiFetch<ExplainAccessResponse>(
          `/subjects/${subjectId}/explain?importId=${importId}&resource=pods&verb=get`,
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
  }, [importId, subjectId]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId) ?? null,
    [subjectId, subjects],
  );

  const namespaceOptions = useMemo(
    () => Array.from(new Set(subjects.map((subject) => subject.namespace).filter(Boolean))).sort(),
    [subjects],
  );

  return (
    <div className="space-y-4">
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

      {loading || error || !access ? (
        <AsyncState
          loading={loading}
          error={error}
          empty={!loading && !error && !access}
          emptyMessage="Import a snapshot with subjects to inspect effective access."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="app-panel space-y-3 p-4">
            <h3 className="text-lg font-semibold text-white">Effective permissions</h3>
            {access.permissions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No resolved permissions for this subject in the selected snapshot.
              </p>
            ) : (
              access.permissions.map((permission, index) => (
                <div
                  key={`${permission.bindingId}-${permission.ruleIndex}-${index}`}
                  className="app-panel-muted p-4 text-sm text-slate-300"
                >
                  <p className="font-medium text-white">
                    {permission.bindingKind} {permission.bindingName} → {permission.roleKind}{' '}
                    {permission.roleName}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-brand-100">
                    {permission.scopeType}{' '}
                    {permission.bindingNamespace ? `• ${permission.bindingNamespace}` : ''}
                  </p>
                  <p className="mt-3">
                    Resources:{' '}
                    <span className="text-white">
                      {permission.resources.join(', ') || 'non-resource'}
                    </span>
                  </p>
                  <p className="mt-1">
                    Verbs: <span className="text-white">{permission.verbs.join(', ') || '*'}</span>
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="app-panel p-4">
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ImportListResponse, type ResourceAccessResponse } from '../lib/api';
import { AsyncState } from './async-state';

export function ResourcesClient(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resource, setResource] = useState('pods');
  const [verb, setVerb] = useState('get');
  const [namespace, setNamespace] = useState('');
  const [items, setItems] = useState<ResourceAccessResponse['items']>([]);
  const [importId, setImportId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      totalSubjects: items.length,
      totalBindings: items.reduce((sum, item) => sum + item.matches.length, 0),
      namespacedSubjects: items.filter((item) => item.subject.namespace).length,
      clusterSubjects: items.filter((item) => !item.subject.namespace).length,
    }),
    [items],
  );

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        setLoading(true);
        const imports = await apiFetch<ImportListResponse>('/imports');
        const latest = imports.items[0];

        if (!latest) {
          if (active) {
            setItems([]);
            setImportId(null);
          }
          return;
        }

        const searchParams = new URLSearchParams({
          importId: latest.id,
          resource,
          verb,
        });
        if (namespace.trim()) {
          searchParams.set('namespace', namespace.trim());
        }

        const next = await apiFetch<ResourceAccessResponse>(
          `/resources/access?${searchParams.toString()}`,
        );
        if (active) {
          setImportId(latest.id);
          setItems(next.items);
          setError(null);
        }
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error ? nextError.message : 'Failed to load resource access.',
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
  }, [namespace, resource, verb]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Subjects matched
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.totalSubjects}
          </p>
        </div>
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Granting paths
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.totalBindings}
          </p>
        </div>
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Namespaced</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.namespacedSubjects}
          </p>
        </div>
        <div className="app-panel p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Cluster identities
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50">
            {stats.clusterSubjects}
          </p>
        </div>
      </div>

      <div className="app-panel grid gap-4 p-4 lg:grid-cols-[1fr_0.8fr_1fr_auto]">
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Resource
          </span>
          <input
            value={resource}
            onChange={(event) => setResource(event.target.value)}
            placeholder="pods"
            className="app-input"
          />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">Verb</span>
          <input
            value={verb}
            onChange={(event) => setVerb(event.target.value)}
            placeholder="get"
            className="app-input"
          />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
            Namespace filter
          </span>
          <input
            value={namespace}
            onChange={(event) => setNamespace(event.target.value)}
            placeholder="demo"
            className="app-input"
          />
        </label>
        <div className="self-end text-sm text-slate-400">
          {importId ? <p>Snapshot {importId}</p> : null}
        </div>
      </div>

      {loading || error || items.length === 0 ? (
        <AsyncState
          loading={loading}
          error={error}
          empty={!loading && !error && items.length === 0}
          emptyMessage="No matching subjects for this resource/verb query yet. Import a snapshot and try again."
        />
      ) : (
        <div className="space-y-4">
          <div className="hidden overflow-hidden app-panel lg:block">
            <div className="grid grid-cols-[minmax(0,1.4fr)_180px_140px_minmax(0,1.1fr)] border-b border-white/5 bg-[#131b2e] px-6 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              <span>Subject</span>
              <span>Type</span>
              <span>Scope</span>
              <span>Granting paths</span>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((item) => (
                <div
                  key={item.subject.id}
                  className="grid grid-cols-[minmax(0,1.4fr)_180px_140px_minmax(0,1.1fr)] gap-4 px-6 py-5 text-sm text-slate-300 transition hover:bg-[#171f33]"
                >
                  <div>
                    <p className="font-semibold text-slate-50">
                      {item.subject.namespace ? `${item.subject.namespace}/` : ''}
                      {item.subject.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Queried for {verb} {resource}
                    </p>
                  </div>
                  <div className="text-xs uppercase tracking-[0.18em] text-brand-100">
                    {item.subject.kind}
                  </div>
                  <div>
                    <span className="rounded-full bg-[#2d3449] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                      {item.subject.namespace ? 'namespace' : 'cluster'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {item.matches.map((match, index) => (
                      <div
                        key={`${match.bindingId}-${match.ruleIndex}-${index}`}
                        className="rounded-lg bg-[#131b2e] px-3 py-2"
                      >
                        <p className="font-medium text-slate-100">{match.bindingName}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {match.bindingKind} → {match.roleKind} {match.roleName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((item) => (
              <div key={item.subject.id} className="app-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-50">
                      {item.subject.namespace ? `${item.subject.namespace}/` : ''}
                      {item.subject.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-100">
                      {item.subject.kind}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#2d3449] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                    {item.subject.namespace ? 'namespace' : 'cluster'}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {item.matches.map((match, index) => (
                    <div
                      key={`${match.bindingId}-${match.ruleIndex}-${index}`}
                      className="app-panel-muted p-3"
                    >
                      <p className="font-medium text-slate-100">{match.bindingName}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {match.bindingKind} → {match.roleKind} {match.roleName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

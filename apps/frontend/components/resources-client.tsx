'use client';

import { useEffect, useState } from 'react';
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
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.subject.id} className="app-panel p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-100">
                {item.subject.kind}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                {item.subject.namespace ? `${item.subject.namespace}/` : ''}
                {item.subject.name}
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {item.matches.map((match, index) => (
                  <div
                    key={`${match.bindingId}-${match.ruleIndex}-${index}`}
                    className="app-panel-muted p-3"
                  >
                    <p className="font-medium text-white">{match.bindingName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {match.bindingKind} → {match.roleKind} {match.roleName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

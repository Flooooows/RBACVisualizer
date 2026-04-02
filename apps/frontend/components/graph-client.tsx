'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type GraphPayload,
  type ImportListResponse,
  type SubjectListResponse,
} from '../lib/api';
import { AsyncState } from './async-state';
import { GraphPreview } from './graph-preview';

export function GraphClient(): JSX.Element {
  const queryParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectListResponse['items']>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
          }
          return;
        }

        const nextSubjects = await apiFetch<SubjectListResponse>(`/subjects?importId=${latest.id}`);

        if (active) {
          setImportId(latest.id);
          setSubjects(nextSubjects.items);
          const requestedSubjectId = queryParams.get('subjectId');
          setSubjectId(
            nextSubjects.items.some((subject) => subject.id === requestedSubjectId)
              ? requestedSubjectId
              : (nextSubjects.items[0]?.id ?? null),
          );
          setError(null);
        }
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error ? nextError.message : 'Failed to load graph context.',
          );
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
  }, [queryParams]);

  useEffect(() => {
    if (!importId || !subjectId) {
      setGraph(null);
      return;
    }

    let active = true;
    setLoading(true);

    void apiFetch<GraphPayload>(`/graph?importId=${importId}&subjectId=${subjectId}`)
      .then((nextGraph) => {
        if (active) {
          setGraph(nextGraph);
          setSelectedNodeId(nextGraph.graph.nodes[0]?.id ?? null);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load graph.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [importId, subjectId]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId) ?? null,
    [subjectId, subjects],
  );

  const selectedNode = useMemo(
    () =>
      graph?.graph.nodes.find((node) => node.id === selectedNodeId) ??
      graph?.graph.nodes[0] ??
      null,
    [graph, selectedNodeId],
  );

  const legendItems = [
    { label: 'Subject', color: 'bg-slate-900 border-slate-600' },
    { label: 'Binding', color: 'bg-slate-800 border-orange-500' },
    { label: 'Role / ClusterRole', color: 'bg-blue-700 border-blue-400' },
    { label: 'Permission summary', color: 'bg-slate-900 border-slate-500' },
  ];

  return (
    <div className="space-y-4">
      <div className="app-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300" htmlFor="subject-select">
            Subject focus
          </label>
          <select
            id="subject-select"
            value={subjectId ?? ''}
            onChange={(event) => setSubjectId(event.target.value || null)}
            className="app-select max-w-xs rounded-full"
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.kind} / {subject.namespace ? `${subject.namespace}/` : ''}
                {subject.name}
              </option>
            ))}
          </select>
        </div>
        {selectedSubject ? (
          <p className="text-sm text-slate-400">
            Inspecting {selectedSubject.kind} {selectedSubject.name}
          </p>
        ) : null}
      </div>

      {loading || error || !graph ? (
        <AsyncState
          loading={loading}
          error={error}
          empty={!loading && !error && !graph}
          emptyMessage="Import a snapshot with at least one subject to render the subject-focus graph."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_340px] 2xl:grid-cols-[minmax(0,1.85fr)_360px]">
          <div className="space-y-4">
            <GraphPreview
              nodes={graph.graph.nodes}
              edges={graph.graph.edges}
              onNodeSelect={(node) => setSelectedNodeId(node.id)}
            />

            <div className="app-panel flex flex-wrap items-center gap-2 p-4">
              <span className="text-[11px] uppercase tracking-[0.2em] text-brand-100">Legend</span>
              {legendItems.map((item) => (
                <span
                  key={item.label}
                  className={[
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs text-slate-100',
                    item.color,
                  ].join(' ')}
                >
                  {item.label}
                </span>
              ))}
              <span className="inline-flex items-center rounded-full border border-amber-500 bg-amber-950/30 px-3 py-1 text-xs text-amber-100">
                Cluster scope highlight
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="app-panel p-4">
              <h3 className="text-lg font-semibold text-white">Selected node</h3>
              {selectedNode ? (
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>
                    Label: <span className="text-white">{selectedNode.label}</span>
                  </p>
                  <p>
                    Type: <span className="text-white">{selectedNode.type}</span>
                  </p>
                  <p>
                    Kind: <span className="text-white">{selectedNode.kind}</span>
                  </p>
                  <p>
                    Scope: <span className="text-white">{selectedNode.scopeType}</span>
                  </p>
                  <p>
                    Namespace:{' '}
                    <span className="text-white">{selectedNode.namespace ?? 'cluster-scope'}</span>
                  </p>
                  {selectedNode.badges && selectedNode.badges.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-brand-100">
                        Badges
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNode.badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selectedNode.metadataRef ? (
                    <details className="app-panel-muted p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-200">
                        Metadata reference
                      </summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                        {JSON.stringify(selectedNode.metadataRef, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                  {selectedNode.type === 'permission_summary' ? (
                    <details className="app-panel-muted p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-200">
                        Permission summary payload
                      </summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                        {JSON.stringify(
                          {
                            apiGroups: selectedNode.apiGroups,
                            resources: selectedNode.resources,
                            verbs: selectedNode.verbs,
                            ruleCount: selectedNode.ruleCount,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Click a node in the graph to inspect its details.
                </p>
              )}
            </div>

            <div className="app-panel p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">
                Graph metadata
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>
                  View: <span className="text-white">{graph.view}</span>
                </p>
                <p>
                  Generated:{' '}
                  <span className="text-white">
                    {new Date(graph.meta.generatedAt).toLocaleString()}
                  </span>
                </p>
                <p>
                  Nodes: <span className="text-white">{graph.graph.nodes.length}</span>
                </p>
                <p>
                  Edges: <span className="text-white">{graph.graph.edges.length}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [fitViewSignal, setFitViewSignal] = useState(0);

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

  const selectedNodeConnections = useMemo(() => {
    if (!graph || !selectedNode) {
      return [];
    }

    const nodeById = new Map(graph.graph.nodes.map((node) => [node.id, node]));

    return graph.graph.edges
      .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
      .map((edge) => {
        const isOutgoing = edge.source === selectedNode.id;
        const relatedNode = nodeById.get(isOutgoing ? edge.target : edge.source);

        return {
          id: edge.id,
          direction: isOutgoing ? 'outgoing' : 'incoming',
          relatedLabel: relatedNode?.label ?? (isOutgoing ? edge.target : edge.source),
          relatedType: relatedNode?.type ?? 'unknown',
          scopeType: edge.scopeType ?? relatedNode?.scopeType ?? 'namespace',
          explain: edge.explain,
        };
      });
  }, [graph, selectedNode]);

  const scopeSummary = useMemo(() => {
    if (!graph) {
      return { namespaceNodes: 0, clusterNodes: 0 };
    }

    return graph.graph.nodes.reduce(
      (acc, node) => {
        if (node.scopeType === 'cluster') {
          acc.clusterNodes += 1;
        } else {
          acc.namespaceNodes += 1;
        }

        return acc;
      },
      { namespaceNodes: 0, clusterNodes: 0 },
    );
  }, [graph]);

  return (
    <div className="space-y-4">
      <div className="app-panel space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-3">
            <label className="text-sm text-slate-300" htmlFor="subject-select">
              Subject focus
            </label>
            <select
              id="subject-select"
              value={subjectId ?? ''}
              onChange={(event) => setSubjectId(event.target.value || null)}
              className="app-select max-w-md rounded-full"
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.kind} / {subject.namespace ? `${subject.namespace}/` : ''}
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="app-button-secondary"
            >
              Reset node focus
            </button>
            <button
              type="button"
              onClick={() => setFitViewSignal((value) => value + 1)}
              className="app-button-secondary"
            >
              Fit graph to view
            </button>
          </div>
        </div>
        {selectedSubject ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <p>
              Inspecting <span className="font-medium text-slate-100">{selectedSubject.kind}</span>{' '}
              <span className="font-medium text-white">{selectedSubject.name}</span>
            </p>
            <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
              {selectedSubject.namespace
                ? `namespace: ${selectedSubject.namespace}`
                : 'cluster identity'}
            </span>
            {graph ? (
              <>
                <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                  {graph.graph.nodes.length} nodes
                </span>
                <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                  {graph.graph.edges.length} edges
                </span>
              </>
            ) : null}
          </div>
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
              selectedNodeId={selectedNode?.id ?? null}
              fitViewSignal={fitViewSignal}
              onNodeSelect={(node) => setSelectedNodeId(node.id)}
            />

            <div className="app-panel space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-brand-100">
                  Legend
                </span>
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
              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Namespace scope
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {scopeSummary.namespaceNodes}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Cluster scope
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {scopeSummary.clusterNodes}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Selected links
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {selectedNodeConnections.length}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-100">
                  How to read this graph
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-300">
                  <li>Follow arrows from subject → binding → role to explain effective access.</li>
                  <li>Amber accents indicate cluster-wide scope.</li>
                  <li>Select a node to inspect metadata and connected permission paths.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="app-panel p-4">
              <h3 className="text-lg font-semibold text-white">Inspector</h3>
              {selectedNode ? (
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Selected node
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">{selectedNode.label}</p>
                    <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                      <p>
                        Type:{' '}
                        <span className="font-medium text-slate-100">{selectedNode.type}</span>
                      </p>
                      <p>
                        Kind:{' '}
                        <span className="font-medium text-slate-100">{selectedNode.kind}</span>
                      </p>
                      <p>
                        Scope:{' '}
                        <span className="font-medium text-slate-100">{selectedNode.scopeType}</span>
                      </p>
                      <p>
                        Namespace:{' '}
                        <span className="font-medium text-slate-100">
                          {selectedNode.namespace ?? 'cluster-scope'}
                        </span>
                      </p>
                    </div>
                  </div>
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
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-brand-100">
                      Connected paths
                    </p>
                    {selectedNodeConnections.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedNodeConnections.slice(0, 8).map((connection) => (
                          <li
                            key={connection.id}
                            className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2"
                          >
                            <p className="text-xs text-slate-200">
                              {connection.direction === 'outgoing'
                                ? '↗ Outgoing to'
                                : '↙ Incoming from'}{' '}
                              <span className="font-medium text-white">
                                {connection.relatedLabel}
                              </span>
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {connection.relatedType} • {connection.scopeType}
                              {connection.explain ? ` • ${connection.explain}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                        No direct edges connected to this node.
                      </p>
                    )}
                  </div>
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
                  Select a node in the graph to inspect metadata and permission path context.
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

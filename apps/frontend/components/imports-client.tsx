'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type ClusterStatusResponse,
  type ImportDetailResponse,
  type ImportListItem,
  type ImportListResponse,
} from '../lib/api';
import { AsyncState } from './async-state';
import { ProjectSelector } from './project-selector';
import { useProjectScope } from '../hooks/use-project-scope';

const sampleManifest = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: app
  namespace: demo
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pods-reader
  namespace: demo
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-read-pods
  namespace: demo
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pods-reader
subjects:
  - kind: ServiceAccount
    name: app
    namespace: demo
`;

const anomalyManifest = `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: empty-role
  namespace: demo
rules: []
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-admin
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cluster-admin-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: User
    name: admin
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: broken-ref
  namespace: demo
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: missing-role
subjects:
  - kind: User
    name: admin
`;

type CreateImportResponse = {
  importId: string;
  status: string;
  issues: Array<{ code: string; message: string; severity: string }>;
};

function statusTone(status: string): string {
  if (status.includes('FAILED')) {
    return 'bg-rose-950/30 text-rose-200 border-rose-800/40';
  }

  if (status.includes('WARNING')) {
    return 'bg-amber-950/30 text-amber-200 border-amber-800/40';
  }

  return 'bg-emerald-950/30 text-emerald-200 border-emerald-800/40';
}

function statusIcon(status: string): string {
  if (status.includes('FAILED')) {
    return '⚠';
  }

  if (status.includes('WARNING')) {
    return '◔';
  }

  return '✓';
}

function formatLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
}

export function ImportsClient(): JSX.Element {
  const projectScope = useProjectScope();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imports, setImports] = useState<ImportListItem[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ImportDetailResponse | null>(null);
  const [payload, setPayload] = useState(sampleManifest);
  const [sourceLabel, setSourceLabel] = useState('frontend-manual-import');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<CreateImportResponse | null>(null);
  const [clusterContextName, setClusterContextName] = useState('');
  const [clusterKubeconfigPath, setClusterKubeconfigPath] = useState('');
  const [clusterStatusLoading, setClusterStatusLoading] = useState(false);
  const [clusterStatus, setClusterStatus] = useState<ClusterStatusResponse | null>(null);
  const [clusterError, setClusterError] = useState<string | null>(null);

  const selectedImport = useMemo(
    () => imports.find((item) => item.id === selectedImportId) ?? imports[0] ?? null,
    [imports, selectedImportId],
  );

  const importStats = useMemo(
    () => ({
      total: imports.length,
      warnings: imports.filter((item) => item.status.includes('WARNING')).length,
      findings: imports.reduce((sum, item) => sum + item.findings, 0),
    }),
    [imports],
  );

  const loadImports = useCallback(
    async (preferredImportId?: string): Promise<void> => {
      setLoading(true);
      try {
        if (!projectScope.projectId) {
          setImports([]);
          setDetail(null);
          return;
        }
        const list = await apiFetch<ImportListResponse>(
          `/imports?projectId=${projectScope.projectId}`,
        );
        setImports(list.items);
        const nextImportId = preferredImportId ?? list.items[0]?.id ?? null;
        setSelectedImportId(nextImportId);

        if (nextImportId) {
          const nextDetail = await apiFetch<ImportDetailResponse>(
            `/imports/${nextImportId}?projectId=${projectScope.projectId}`,
          );
          setDetail(nextDetail);
        } else {
          setDetail(null);
        }
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load imports.');
      } finally {
        setLoading(false);
      }
    },
    [projectScope.projectId],
  );

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  useEffect(() => {
    if (!selectedImport || selectedImport.id === detail?.id) {
      return;
    }

    void apiFetch<ImportDetailResponse>(
      `/imports/${selectedImport.id}?projectId=${projectScope.projectId}`,
    )
      .then((nextDetail) => {
        setDetail(nextDetail);
        setError(null);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load import detail.');
      });
  }, [detail?.id, projectScope.projectId, selectedImport]);

  async function submitImport(): Promise<void> {
    try {
      setSubmitting(true);
      const created = await apiFetch<CreateImportResponse>('/imports', {
        method: 'POST',
        body: JSON.stringify({
          projectId: projectScope.projectId,
          sourceType: 'YAML',
          sourceLabel,
          raw: payload,
        }),
      });
      setLastSubmission(created);
      await loadImports(created.importId);
    } catch (nextError) {
      setLastSubmission(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to create import.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClusterImport(): Promise<void> {
    try {
      setSubmitting(true);
      const created = await apiFetch<CreateImportResponse>('/imports/cluster', {
        method: 'POST',
        body: JSON.stringify({
          projectId: projectScope.projectId,
          sourceLabel,
          kubeconfigPath: clusterKubeconfigPath || undefined,
          contextName: clusterContextName || undefined,
        }),
      });
      setLastSubmission(created);
      await loadImports(created.importId);
      setError(null);
      setClusterError(null);
    } catch (nextError) {
      setLastSubmission(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to import from cluster.');
    } finally {
      setSubmitting(false);
    }
  }

  async function checkClusterStatus(): Promise<void> {
    try {
      setClusterStatusLoading(true);
      const status = await apiFetch<ClusterStatusResponse>('/imports/cluster/status', {
        method: 'POST',
        body: JSON.stringify({
          projectId: projectScope.projectId,
          kubeconfigPath: clusterKubeconfigPath || undefined,
          contextName: clusterContextName || undefined,
        }),
      });

      setClusterStatus(status);
      setClusterError(null);
    } catch (nextError) {
      setClusterStatus(null);
      setClusterError(
        nextError instanceof Error ? nextError.message : 'Failed to inspect cluster status.',
      );
    } finally {
      setClusterStatusLoading(false);
    }
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      setPayload(text);
      setSourceLabel(file.name);
      setSelectedFileName(file.name);
      setError(null);
      setLastSubmission(null);
      setClusterError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to read selected file.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-6 lg:col-span-8">
        <ProjectSelector {...projectScope} onChange={projectScope.setProjectId} />
        <div className="app-panel-muted relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/10 to-transparent opacity-80" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#2d3449] text-4xl text-brand-100 ring-1 ring-white/10">
              ⤴
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-50">
              Upload Kubernetes RBAC manifests
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Drag in YAML or JSON RBAC snapshots, load one of the prepared samples, or paste raw
              manifests directly into the editor below.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPayload(sampleManifest);
                  setSourceLabel('frontend-clean-sample');
                  setSelectedFileName(null);
                }}
                className="app-button-secondary"
              >
                Load clean sample
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayload(anomalyManifest);
                  setSourceLabel('frontend-anomaly-sample');
                  setSelectedFileName(null);
                }}
                className="app-button-secondary border border-amber-700/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
              >
                Load anomaly sample
              </button>
              <label className="app-button-secondary cursor-pointer border border-emerald-700/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15">
                Load file
                <input
                  type="file"
                  accept=".yaml,.yml,.json,text/yaml,application/yaml,application/json"
                  className="hidden"
                  onChange={(event) => void onFileSelected(event)}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <span className="rounded-lg border border-white/10 bg-[#131b2e] px-4 py-2">YAML</span>
              <span className="rounded-lg border border-white/10 bg-[#131b2e] px-4 py-2">JSON</span>
              <span className="rounded-lg border border-white/10 bg-[#131b2e] px-4 py-2">
                RoleBindings
              </span>
              <span className="rounded-lg border border-white/10 bg-[#131b2e] px-4 py-2">
                ClusterRoles
              </span>
            </div>
          </div>
        </div>

        <div className="app-panel space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1.5fr]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
                Source label
              </label>
              <input
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                className="app-input"
              />
            </div>
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-300">
              {selectedFileName ? (
                <span>
                  Loaded file: <span className="text-white">{selectedFileName}</span>
                </span>
              ) : (
                <span>Tip: use a local YAML/JSON file or one of the prepared samples.</span>
              )}
            </div>
          </div>

          <textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            className="h-[360px] w-full rounded-xl bg-[#060e20] p-4 font-mono text-xs text-slate-100 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-brand-500/50"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              The payload is validated, normalized, and then projected into graph, anomalies,
              subject, and resource views.
            </p>
            <button
              type="button"
              onClick={() => void submitImport()}
              disabled={
                submitting || payload.trim().length === 0 || sourceLabel.trim().length === 0
              }
              className="app-button-primary"
            >
              {submitting ? 'Importing…' : 'Create import snapshot'}
            </button>
          </div>

          <AsyncState loading={false} error={error} />
          {lastSubmission ? (
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
              <p className="font-medium">Snapshot created: {lastSubmission.importId}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-300">
                {lastSubmission.status}
              </p>
              {lastSubmission.issues.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {lastSubmission.issues.map((issue, index) => (
                    <div key={`${issue.code}-${index}`} className="app-panel-muted p-3">
                      <p className="font-medium">{issue.code}</p>
                      <p className="mt-1 text-xs text-emerald-200">{issue.message}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="app-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <h3 className="text-lg font-bold text-slate-50">Recent activity</h3>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-100">
              Latest snapshots
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {imports.length === 0 ? (
              <div className="px-6 py-6 text-sm text-slate-400">
                No snapshot yet. Submit the sample YAML to create your first import.
              </div>
            ) : (
              imports.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedImportId(item.id)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-[#171f33]"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={[
                        'flex h-10 w-10 items-center justify-center rounded-lg border text-sm',
                        statusTone(item.status),
                      ].join(' ')}
                    >
                      {statusIcon(item.status)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-50">
                        {item.sourceLabel ?? item.id}
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.documents} documents • {item.findings} findings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={[
                        'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                        statusTone(item.status),
                      ].join(' ')}
                    >
                      {item.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 space-y-6 lg:col-span-4">
        <div className="app-panel p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">
            Direct cluster import
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            Read RBAC resources directly from the Kubernetes cluster available through your local
            kubeconfig.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
                Context name (optional)
              </label>
              <input
                value={clusterContextName}
                onChange={(event) => setClusterContextName(event.target.value)}
                placeholder="kind-rbac-visualizer"
                className="app-input"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-brand-100">
                Kubeconfig path (optional)
              </label>
              <input
                value={clusterKubeconfigPath}
                onChange={(event) => setClusterKubeconfigPath(event.target.value)}
                placeholder="~/.kube/config"
                className="app-input"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void checkClusterStatus()}
              disabled={clusterStatusLoading}
              className="app-button-secondary"
            >
              {clusterStatusLoading ? 'Checking cluster…' : 'Check cluster status'}
            </button>
            <button
              type="button"
              onClick={() => void submitClusterImport()}
              disabled={submitting || sourceLabel.trim().length === 0}
              className="app-button-secondary border border-emerald-700/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            >
              {submitting ? 'Importing cluster…' : 'Import current cluster'}
            </button>
            <p className="self-center text-xs text-slate-400">
              Reads `Namespaces`, `ServiceAccounts`, `Roles`, `ClusterRoles`, `RoleBindings`, and
              `ClusterRoleBindings`.
            </p>
          </div>
          {clusterError ? (
            <div className="mt-4 rounded-[24px] border border-rose-800/40 bg-rose-950/25 p-4 text-sm text-rose-100">
              <p className="font-medium">Cluster connection failed</p>
              <p className="mt-2 text-xs text-rose-200">{clusterError}</p>
            </div>
          ) : null}
          {clusterStatus ? (
            <div className="mt-4 rounded-[24px] border border-brand-800/40 bg-brand-500/10 p-4 text-sm text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">Cluster reachable</p>
                  <p className="mt-1 text-xs text-slate-300">Context {clusterStatus.contextName}</p>
                </div>
                <div className="rounded-full border border-emerald-700/40 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100">
                  Connected
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {clusterStatus.clusterServer ?? 'Cluster server unavailable'}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(clusterStatus.counts).map(([key, value]) => (
                  <div key={key} className="app-panel-muted p-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{key}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-50">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="app-panel p-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-brand-100">
            Ingestion meta
          </h3>
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-4xl font-extrabold tracking-tight text-slate-50">
                {importStats.total}
              </p>
              <p className="mt-2 text-xs text-slate-400">Snapshots currently available</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-lg font-bold text-slate-50">{importStats.findings}</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Findings recorded
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-300">{importStats.warnings}</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Warning snapshots
                </p>
              </div>
            </div>
            <div className="border-t border-white/5 pt-4 text-xs text-slate-400">
              Use cluster status before import to confirm connectivity and object volume.
            </div>
          </div>
        </div>

        {detail ? (
          <div className="app-panel p-6">
            <h3 className="text-lg font-bold text-slate-50">Snapshot detail</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <p>
                Source: <span className="text-white">{detail.sourceLabel ?? 'n/a'}</span>
              </p>
              <p>
                Status: <span className="text-white">{detail.status}</span>
              </p>
              <p>
                Documents: <span className="text-white">{detail.counts.rawManifests}</span>
              </p>
              <p>
                Subjects: <span className="text-white">{detail.counts.subjects}</span>
              </p>
              <p>
                Bindings:{' '}
                <span className="text-white">
                  {detail.counts.roleBindings + detail.counts.clusterRoleBindings}
                </span>
              </p>
            </div>
            {detail.warnings.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-800/40 bg-amber-950/25 p-4">
                <h4 className="text-sm font-semibold text-amber-200">Warnings</h4>
                <div className="mt-3 space-y-2 text-sm text-amber-100">
                  {detail.warnings.map((warning) => (
                    <div key={warning.id} className="app-panel-muted p-3">
                      <p className="font-medium">{warning.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-amber-300">
                        {warning.type} · {warning.severity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {detail.documents.map((document) => (
                <div key={document.id} className="app-panel-muted p-3">
                  <p className="font-medium text-white">
                    {document.kind} / {document.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {document.namespace ?? 'cluster-scope'} • {document.apiVersion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

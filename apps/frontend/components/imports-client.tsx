'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  apiFetch,
  type ClusterStatusResponse,
  type ImportDetailResponse,
  type ImportListItem,
  type ImportListResponse,
} from '../lib/api';
import { AsyncState } from './async-state';

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

export function ImportsClient(): JSX.Element {
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

  async function loadImports(preferredImportId?: string): Promise<void> {
    setLoading(true);
    try {
      const list = await apiFetch<ImportListResponse>('/imports');
      setImports(list.items);
      const nextImportId = preferredImportId ?? list.items[0]?.id ?? null;
      setSelectedImportId(nextImportId);

      if (nextImportId) {
        const nextDetail = await apiFetch<ImportDetailResponse>(`/imports/${nextImportId}`);
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
  }

  useEffect(() => {
    void loadImports();
  }, []);

  useEffect(() => {
    if (!selectedImport || selectedImport.id === detail?.id) {
      return;
    }

    void apiFetch<ImportDetailResponse>(`/imports/${selectedImport.id}`)
      .then((nextDetail) => {
        setDetail(nextDetail);
        setError(null);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load import detail.');
      });
  }, [detail?.id, selectedImport]);

  async function submitImport(): Promise<void> {
    try {
      setSubmitting(true);
      const created = await apiFetch<CreateImportResponse>('/imports', {
        method: 'POST',
        body: JSON.stringify({
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
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="app-panel space-y-5 p-5">
        <div>
          <p className="text-sm text-slate-300">
            Submit a YAML or JSON snapshot directly to the backend import pipeline.
          </p>
        </div>
        <div className="app-panel-muted p-5">
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
        <div className="flex flex-wrap gap-3">
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
          className="h-80 w-full rounded-[24px] bg-slate-950/80 p-4 font-mono text-xs text-slate-100 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-brand-500/60"
        />
        <button
          type="button"
          onClick={() => void submitImport()}
          disabled={submitting || payload.trim().length === 0 || sourceLabel.trim().length === 0}
          className="app-button-primary"
        >
          {submitting ? 'Importing…' : 'Create import snapshot'}
        </button>
        <AsyncState loading={false} error={error} />
        {lastSubmission ? (
          <div className="rounded-[24px] border border-emerald-800/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
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

      <div className="space-y-4">
        <div className="app-panel p-5">
          <h3 className="text-lg font-semibold text-white">Snapshots</h3>
          <div className="mt-4">
            <AsyncState
              loading={loading}
              error={null}
              empty={!loading && imports.length === 0}
              emptyMessage="No snapshot yet. Submit the sample YAML to create your first import."
            />
            <div className="space-y-3">
              {imports.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedImportId(item.id)}
                  className={[
                    'w-full rounded-[22px] p-4 text-left text-sm transition ring-1',
                    selectedImport?.id === item.id
                      ? 'bg-brand-500/10 text-white ring-brand-100/30'
                      : 'bg-slate-950/50 text-slate-300 ring-white/5 hover:bg-slate-900/60 hover:ring-white/10',
                  ].join(' ')}
                >
                  <p className="font-medium">{item.sourceLabel ?? item.id}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-brand-100">
                    {item.status}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Documents: {item.documents} • Findings: {item.findings}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {detail ? (
          <div className="app-panel p-5">
            <h3 className="text-lg font-semibold text-white">Snapshot detail</h3>
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
              <div className="mt-4 rounded-[24px] border border-amber-800/40 bg-amber-950/25 p-4">
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

export type ImportListItem = {
  id: string;
  projectId: string | null;
  status: string;
  sourceType: string;
  sourceLabel: string | null;
  importedAt: string;
  completedAt: string | null;
  documents: number;
  findings: number;
};

export type ImportListResponse = {
  items: ImportListItem[];
};

export type ImportDetailResponse = {
  id: string;
  projectId: string | null;
  status: string;
  sourceType: string;
  sourceLabel: string | null;
  importedAt: string;
  completedAt: string | null;
  documents: Array<{
    id: string;
    apiVersion: string;
    kind: string;
    namespace: string | null;
    name: string;
    documentOrder: number | null;
  }>;
  counts: {
    rawManifests: number;
    namespaces: number;
    subjects: number;
    roles: number;
    clusterRoles: number;
    roleBindings: number;
    clusterRoleBindings: number;
    findings: number;
  };
  warnings: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    details: unknown;
  }>;
};

export type DashboardResponse = {
  snapshotId: string;
  snapshotStatus: string;
  importedAt: string;
  completedAt: string | null;
  cards: Array<{ id: string; label: string; value: number }>;
};

export type ProjectsResponse = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    workspaceId: string;
    workspaceName: string;
    isArchived: boolean;
  }>;
};

export type SubjectListResponse = {
  items: Array<{
    id: string;
    kind: string;
    name: string;
    namespace: string | null;
  }>;
};

export type SubjectAccessResponse = {
  subject: {
    id: string;
    kind: string;
    name: string;
    namespace: string | null;
  };
  permissions: Array<{
    bindingId: string;
    bindingKind: 'RoleBinding' | 'ClusterRoleBinding';
    bindingName: string;
    bindingNamespace: string | null;
    roleId: string | null;
    roleKind: 'Role' | 'ClusterRole';
    roleName: string;
    roleNamespace: string | null;
    scopeType: 'namespace' | 'cluster';
    ruleIndex: number;
    verbs: string[];
    resources: string[];
    apiGroups: string[];
  }>;
};

export type ExplainAccessResponse = {
  subject: SubjectAccessResponse['subject'];
  allowed: boolean;
  matches: SubjectAccessResponse['permissions'];
};

export type ResourceAccessResponse = {
  items: Array<{
    subject: SubjectAccessResponse['subject'];
    matches: SubjectAccessResponse['permissions'];
  }>;
};

export type GraphPayload = {
  view: string;
  filters: Record<string, unknown>;
  graph: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      scopeType: string;
      namespace: string | null;
      kind: string;
      badges?: string[];
      metadataRef?: {
        kind: string;
        name: string;
        namespace: string | null;
      };
      subjectKind?: string;
      apiGroups?: string[];
      resources?: string[];
      verbs?: string[];
      ruleCount?: number;
    }>;
    edges: Array<{
      id: string;
      type: string;
      source: string;
      target: string;
      explain?: string;
      scopeType?: string;
      namespace?: string | null;
    }>;
  };
  meta: {
    rootNodeIds: string[];
    nodeCounts: Record<string, number>;
    truncated: boolean;
    warnings: string[];
    generatedAt: string;
  };
};

export type ClusterStatusResponse = {
  reachable: boolean;
  contextName: string;
  clusterServer: string | null;
  counts: {
    namespaces: number;
    serviceAccounts: number;
    roles: number;
    clusterRoles: number;
    roleBindings: number;
    clusterRoleBindings: number;
  };
};

export class ApiError extends Error {
  payload?: unknown;

  constructor(message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.payload = payload;
  }
}

export type AnomaliesResponse = {
  items: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    details: unknown;
    createdAt: string;
  }>;
};

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();

    if (body) {
      try {
        const payload = JSON.parse(body) as {
          message?: string;
          detail?: string;
          errors?: Array<{ field: string; messages: string[] }>;
        };
        const message =
          typeof payload.message === 'string'
            ? payload.message
            : `Request failed with status ${response.status}`;
        const detail = typeof payload.detail === 'string' ? ` — ${payload.detail}` : '';
        const fieldErrors = Array.isArray(payload.errors)
          ? ` — ${payload.errors.map((error) => `${error.field}: ${error.messages.join(', ')}`).join(' | ')}`
          : '';

        throw new ApiError(`${message}${detail}${fieldErrors}`, payload);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
      }
    }

    throw new ApiError(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

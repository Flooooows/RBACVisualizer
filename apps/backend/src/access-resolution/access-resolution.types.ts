import type { SubjectKind } from '@prisma/client';

export type ResolvedPermissionPath = {
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
  resourceNames: string[];
  nonResourceURLs: string[];
};

export type SubjectSummary = {
  id: string;
  kind: SubjectKind;
  name: string;
  namespace: string | null;
};

export type SubjectAccessResponse = {
  subject: SubjectSummary;
  permissions: ResolvedPermissionPath[];
};

export type ResourceAccessMatch = {
  subject: SubjectSummary;
  matches: ResolvedPermissionPath[];
};

export type PermissionSummaryNode = {
  id: string;
  label: string;
  type: 'permission_summary';
  kind: 'PermissionSummary';
  scopeType: 'derived';
  namespace: string | null;
  badges: string[];
  metadataRef: {
    kind: 'PermissionSummary';
    name: string;
    namespace: string | null;
  };
  apiGroups: string[];
  resources: string[];
  verbs: string[];
  ruleCount: number;
};

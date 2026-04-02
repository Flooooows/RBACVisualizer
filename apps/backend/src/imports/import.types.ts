import type {
  FindingSeverity,
  FindingType,
  ImportSourceType,
  RoleRefKind,
  SnapshotStatus,
  SubjectKind,
  SubjectOrigin,
} from '@prisma/client';

export type {
  FindingSeverity,
  FindingType,
  ImportSourceType,
  RoleRefKind,
  SnapshotStatus,
  SubjectKind,
  SubjectOrigin,
};

export const SUPPORTED_KINDS = [
  'Namespace',
  'ServiceAccount',
  'Role',
  'ClusterRole',
  'RoleBinding',
  'ClusterRoleBinding',
] as const;

export type SupportedKind = (typeof SUPPORTED_KINDS)[number];

export type ImportIssueSeverity = 'ERROR' | 'WARNING';

export type ImportIssueCode =
  | 'INVALID_BODY'
  | 'INVALID_YAML'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_KIND'
  | 'MISSING_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_SCOPE'
  | 'INVALID_SUBJECT'
  | 'DUPLICATE_OBJECT'
  | 'BROKEN_ROLE_REF';

export type ImportIssue = {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  message: string;
  manifestIndex?: number;
  kind?: string;
  name?: string;
  namespace?: string | null;
};

export type MetadataRef = {
  apiVersion: string;
  kind: string;
  name: string;
  namespace: string | null;
};

export type ParsedManifestDocument = {
  index: number;
  sourceType: ImportSourceType;
  manifest: Record<string, unknown>;
  metadataRef: MetadataRef;
};

export type ImportEnvelope = {
  sourceLabel?: string;
  sourceType?: ImportSourceType;
  raw?: string;
  manifests?: unknown;
};

export type ParsedImportRequest = {
  sourceType: ImportSourceType;
  sourceLabel: string | null;
  documents: ParsedManifestDocument[];
};

export type TempNamespace = {
  name: string;
  labels: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
};

export type TempSubject = {
  kind: SubjectKind;
  name: string;
  namespace: string | null;
  origin: SubjectOrigin;
};

export type TempRule = {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
  resourceNames: string[];
  nonResourceURLs: string[];
};

export type TempRole = {
  metadataRef: MetadataRef;
  name: string;
  namespace: string;
  labels: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
  rules: TempRule[];
};

export type TempClusterRole = {
  metadataRef: MetadataRef;
  name: string;
  labels: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
  aggregationRule: Record<string, unknown> | null;
  rules: TempRule[];
};

export type TempRoleBinding = {
  metadataRef: MetadataRef;
  name: string;
  namespace: string;
  labels: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
  roleRefKind: RoleRefKind;
  roleRefApiGroup: string;
  roleRefName: string;
  subjects: Array<{ key: string }>;
};

export type TempClusterRoleBinding = {
  metadataRef: MetadataRef;
  name: string;
  labels: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
  roleRefApiGroup: string;
  roleRefName: string;
  subjects: Array<{ key: string }>;
};

export type NormalizedImportPlan = {
  sourceType: ImportSourceType;
  sourceLabel: string | null;
  documents: ParsedManifestDocument[];
  issues: ImportIssue[];
  namespaces: TempNamespace[];
  subjects: TempSubject[];
  roles: TempRole[];
  clusterRoles: TempClusterRole[];
  roleBindings: TempRoleBinding[];
  clusterRoleBindings: TempClusterRoleBinding[];
};

export type PersistedImportSummary = {
  documentsReceived: number;
  documentsAccepted: number;
  normalizedCounts: {
    namespaces: number;
    subjects: number;
    roles: number;
    clusterRoles: number;
    roleBindings: number;
    clusterRoleBindings: number;
    findings: number;
  };
  errorsCount: number;
  warningsCount: number;
};

export type PersistedImportResult = {
  importId: string;
  status: SnapshotStatus;
  sourceType: ImportSourceType;
  sourceLabel: string | null;
  issues: ImportIssue[];
  summary: PersistedImportSummary;
  createdAt: string;
  finishedAt: string;
};

export type BrokenRoleRefFinding = {
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  details: Record<string, unknown>;
};

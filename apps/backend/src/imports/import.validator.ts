import {
  FindingSeverity,
  FindingType,
  RoleRefKind,
  SubjectKind,
  SubjectOrigin,
} from '@prisma/client';
import { ImportValidationException } from './import.errors';
import type {
  BrokenRoleRefFinding,
  ImportIssue,
  MetadataRef,
  NormalizedImportPlan,
  ParsedImportRequest,
  ParsedManifestDocument,
  SupportedKind,
  TempClusterRole,
  TempClusterRoleBinding,
  TempNamespace,
  TempRole,
  TempRoleBinding,
  TempRule,
  TempSubject,
} from './import.types';
import { SUPPORTED_KINDS } from './import.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureStringArray(
  value: unknown,
  field: string,
  document: ParsedManifestDocument,
): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ImportValidationException(`Invalid ${field} field.`, [
      issue('INVALID_FIELD_TYPE', `Field ${field} must be an array of strings.`, document),
    ]);
  }

  return value;
}

function issue(
  code: ImportIssue['code'],
  message: string,
  document: ParsedManifestDocument,
  severity: ImportIssue['severity'] = 'ERROR',
): ImportIssue {
  return {
    code,
    severity,
    message,
    manifestIndex: document.index,
    kind: document.metadataRef.kind,
    name: document.metadataRef.name,
    namespace: document.metadataRef.namespace,
  };
}

function metadataOf(document: ParsedManifestDocument): Record<string, unknown> {
  return isRecord(document.manifest.metadata) ? document.manifest.metadata : {};
}

function annotationsOf(document: ParsedManifestDocument): Record<string, unknown> | null {
  const metadata = metadataOf(document);
  return isRecord(metadata.annotations) ? metadata.annotations : null;
}

function labelsOf(document: ParsedManifestDocument): Record<string, unknown> | null {
  const metadata = metadataOf(document);
  return isRecord(metadata.labels) ? metadata.labels : null;
}

function ensureRequiredBaseFields(document: ParsedManifestDocument): void {
  if (!document.metadataRef.apiVersion) {
    throw new ImportValidationException('apiVersion is required.', [
      issue('MISSING_FIELD', 'apiVersion is required.', document),
    ]);
  }

  if (!document.metadataRef.kind) {
    throw new ImportValidationException('kind is required.', [
      issue('MISSING_FIELD', 'kind is required.', document),
    ]);
  }

  if (!document.metadataRef.name) {
    throw new ImportValidationException('metadata.name is required.', [
      issue('MISSING_FIELD', 'metadata.name is required.', document),
    ]);
  }

  if (!SUPPORTED_KINDS.includes(document.metadataRef.kind as SupportedKind)) {
    throw new ImportValidationException('Unsupported Kubernetes kind.', [
      issue(
        'UNSUPPORTED_KIND',
        `Kind ${document.metadataRef.kind} is not supported in the MVP import pipeline.`,
        document,
      ),
    ]);
  }
}

function namespaceKey(namespace: string): string {
  return namespace;
}

function subjectKey(subject: TempSubject): string {
  if (subject.kind === SubjectKind.SERVICE_ACCOUNT) {
    return `SERVICE_ACCOUNT:${subject.namespace}:${subject.name}`;
  }

  return `${subject.kind}:${subject.name}`;
}

function mergeOrigin(existing: SubjectOrigin, incoming: SubjectOrigin): SubjectOrigin {
  if (existing === incoming) {
    return existing;
  }

  return SubjectOrigin.BOTH;
}

function parseRules(document: ParsedManifestDocument): TempRule[] {
  const rules = document.manifest.rules;
  if (rules === undefined) {
    return [];
  }

  if (!Array.isArray(rules)) {
    throw new ImportValidationException('rules must be an array.', [
      issue('INVALID_FIELD_TYPE', 'rules must be an array.', document),
    ]);
  }

  return rules.map((rule, index) => {
    if (!isRecord(rule)) {
      throw new ImportValidationException('rule entries must be objects.', [
        issue('INVALID_FIELD_TYPE', `rules[${index}] must be an object.`, document),
      ]);
    }

    return {
      apiGroups: ensureStringArray(rule.apiGroups, 'rules.apiGroups', document),
      resources: ensureStringArray(rule.resources, 'rules.resources', document),
      verbs: ensureStringArray(rule.verbs, 'rules.verbs', document),
      resourceNames: ensureStringArray(rule.resourceNames, 'rules.resourceNames', document),
      nonResourceURLs: ensureStringArray(rule.nonResourceURLs, 'rules.nonResourceURLs', document),
    };
  });
}

function parseSubjects(document: ParsedManifestDocument, subjects: unknown): TempSubject[] {
  if (subjects === undefined) {
    return [];
  }

  if (!Array.isArray(subjects)) {
    throw new ImportValidationException('subjects must be an array.', [
      issue('INVALID_FIELD_TYPE', 'subjects must be an array.', document),
    ]);
  }

  return subjects.map((subject, index) => {
    if (!isRecord(subject)) {
      throw new ImportValidationException('subjects entries must be objects.', [
        issue('INVALID_FIELD_TYPE', `subjects[${index}] must be an object.`, document),
      ]);
    }

    const kind = subject.kind;
    const name = subject.name;
    const namespace = typeof subject.namespace === 'string' ? subject.namespace : null;

    if (kind !== 'User' && kind !== 'Group' && kind !== 'ServiceAccount') {
      throw new ImportValidationException('Invalid subject kind.', [
        issue(
          'INVALID_SUBJECT',
          `subjects[${index}].kind must be User, Group, or ServiceAccount.`,
          document,
        ),
      ]);
    }

    if (typeof name !== 'string' || !name) {
      throw new ImportValidationException('Invalid subject name.', [
        issue('INVALID_SUBJECT', `subjects[${index}].name is required.`, document),
      ]);
    }

    if (kind === 'ServiceAccount' && !namespace) {
      throw new ImportValidationException('ServiceAccount subjects require a namespace.', [
        issue(
          'INVALID_SUBJECT',
          `subjects[${index}].namespace is required for ServiceAccount subjects.`,
          document,
        ),
      ]);
    }

    return {
      kind:
        kind === 'User'
          ? SubjectKind.USER
          : kind === 'Group'
            ? SubjectKind.GROUP
            : SubjectKind.SERVICE_ACCOUNT,
      name,
      namespace: kind === 'ServiceAccount' ? namespace : null,
      origin: SubjectOrigin.BINDING,
    } satisfies TempSubject;
  });
}

function parseRoleRef(document: ParsedManifestDocument): {
  kind: RoleRefKind;
  name: string;
  apiGroup: string;
} {
  const roleRef = document.manifest.roleRef;
  if (!isRecord(roleRef)) {
    throw new ImportValidationException('roleRef is required for bindings.', [
      issue('MISSING_FIELD', 'roleRef is required for bindings.', document),
    ]);
  }

  if (typeof roleRef.name !== 'string' || !roleRef.name) {
    throw new ImportValidationException('roleRef.name is required.', [
      issue('MISSING_FIELD', 'roleRef.name is required.', document),
    ]);
  }

  if (typeof roleRef.kind !== 'string') {
    throw new ImportValidationException('roleRef.kind is required.', [
      issue('MISSING_FIELD', 'roleRef.kind is required.', document),
    ]);
  }

  if (document.metadataRef.kind === 'RoleBinding') {
    if (roleRef.kind !== 'Role' && roleRef.kind !== 'ClusterRole') {
      throw new ImportValidationException('RoleBinding roleRef.kind must be Role or ClusterRole.', [
        issue('INVALID_SCOPE', 'RoleBinding roleRef.kind must be Role or ClusterRole.', document),
      ]);
    }

    return {
      kind: roleRef.kind === 'Role' ? RoleRefKind.ROLE : RoleRefKind.CLUSTER_ROLE,
      name: roleRef.name,
      apiGroup:
        typeof roleRef.apiGroup === 'string' ? roleRef.apiGroup : 'rbac.authorization.k8s.io',
    };
  }

  if (roleRef.kind !== 'ClusterRole') {
    throw new ImportValidationException('ClusterRoleBinding roleRef.kind must be ClusterRole.', [
      issue('INVALID_SCOPE', 'ClusterRoleBinding roleRef.kind must be ClusterRole.', document),
    ]);
  }

  return {
    kind: RoleRefKind.CLUSTER_ROLE,
    name: roleRef.name,
    apiGroup: typeof roleRef.apiGroup === 'string' ? roleRef.apiGroup : 'rbac.authorization.k8s.io',
  };
}

function ensureNamespace(document: ParsedManifestDocument): string {
  if (!document.metadataRef.namespace) {
    throw new ImportValidationException('Namespace is required.', [
      issue(
        'INVALID_SCOPE',
        `${document.metadataRef.kind} must have metadata.namespace.`,
        document,
      ),
    ]);
  }

  return document.metadataRef.namespace;
}

function ensureClusterScoped(document: ParsedManifestDocument): void {
  if (document.metadataRef.namespace) {
    throw new ImportValidationException(
      'Cluster-scoped resources cannot declare metadata.namespace.',
      [
        issue(
          'INVALID_SCOPE',
          `${document.metadataRef.kind} must not have metadata.namespace.`,
          document,
        ),
      ],
    );
  }
}

export function buildNormalizedImportPlan(parsed: ParsedImportRequest): NormalizedImportPlan {
  const issues: ImportIssue[] = [];
  const namespaces = new Map<string, TempNamespace>();
  const subjects = new Map<string, TempSubject>();
  const roles = new Map<string, TempRole>();
  const clusterRoles = new Map<string, TempClusterRole>();
  const roleBindings = new Map<string, TempRoleBinding>();
  const clusterRoleBindings = new Map<string, TempClusterRoleBinding>();
  const identityKeys = new Set<string>();

  for (const document of parsed.documents) {
    ensureRequiredBaseFields(document);

    const duplicateKey = `${document.metadataRef.kind}:${document.metadataRef.namespace ?? ''}:${document.metadataRef.name}`;
    if (identityKeys.has(duplicateKey)) {
      throw new ImportValidationException('Duplicate Kubernetes object in snapshot.', [
        issue('DUPLICATE_OBJECT', `Duplicate object detected for ${duplicateKey}.`, document),
      ]);
    }

    identityKeys.add(duplicateKey);

    switch (document.metadataRef.kind) {
      case 'Namespace': {
        ensureClusterScoped(document);
        namespaces.set(namespaceKey(document.metadataRef.name), {
          name: document.metadataRef.name,
          labels: labelsOf(document),
          annotations: annotationsOf(document),
        });
        break;
      }

      case 'ServiceAccount': {
        const namespace = ensureNamespace(document);
        namespaces.set(namespaceKey(namespace), {
          name: namespace,
          labels: null,
          annotations: null,
        });

        const subject: TempSubject = {
          kind: SubjectKind.SERVICE_ACCOUNT,
          name: document.metadataRef.name,
          namespace,
          origin: SubjectOrigin.MANIFEST,
        };
        const key = subjectKey(subject);
        const existing = subjects.get(key);
        subjects.set(
          key,
          existing
            ? { ...existing, origin: mergeOrigin(existing.origin, subject.origin) }
            : subject,
        );
        break;
      }

      case 'Role': {
        const namespace = ensureNamespace(document);
        namespaces.set(namespaceKey(namespace), {
          name: namespace,
          labels: null,
          annotations: null,
        });
        roles.set(`${namespace}:${document.metadataRef.name}`, {
          metadataRef: document.metadataRef,
          name: document.metadataRef.name,
          namespace,
          labels: labelsOf(document),
          annotations: annotationsOf(document),
          rules: parseRules(document),
        });
        break;
      }

      case 'ClusterRole': {
        ensureClusterScoped(document);
        clusterRoles.set(document.metadataRef.name, {
          metadataRef: document.metadataRef,
          name: document.metadataRef.name,
          labels: labelsOf(document),
          annotations: annotationsOf(document),
          aggregationRule: isRecord(document.manifest.aggregationRule)
            ? document.manifest.aggregationRule
            : null,
          rules: parseRules(document),
        });
        break;
      }

      case 'RoleBinding': {
        const namespace = ensureNamespace(document);
        namespaces.set(namespaceKey(namespace), {
          name: namespace,
          labels: null,
          annotations: null,
        });
        const roleRef = parseRoleRef(document);
        const parsedSubjects = parseSubjects(document, document.manifest.subjects);
        parsedSubjects.forEach((subject) => {
          const key = subjectKey(subject);
          const existing = subjects.get(key);
          subjects.set(
            key,
            existing
              ? { ...existing, origin: mergeOrigin(existing.origin, subject.origin) }
              : subject,
          );
          if (subject.namespace) {
            namespaces.set(namespaceKey(subject.namespace), {
              name: subject.namespace,
              labels: null,
              annotations: null,
            });
          }
        });
        roleBindings.set(`${namespace}:${document.metadataRef.name}`, {
          metadataRef: document.metadataRef,
          name: document.metadataRef.name,
          namespace,
          labels: labelsOf(document),
          annotations: annotationsOf(document),
          roleRefKind: roleRef.kind,
          roleRefApiGroup: roleRef.apiGroup,
          roleRefName: roleRef.name,
          subjects: parsedSubjects.map((subject) => ({ key: subjectKey(subject) })),
        });
        break;
      }

      case 'ClusterRoleBinding': {
        ensureClusterScoped(document);
        const roleRef = parseRoleRef(document);
        const parsedSubjects = parseSubjects(document, document.manifest.subjects);
        parsedSubjects.forEach((subject) => {
          const key = subjectKey(subject);
          const existing = subjects.get(key);
          subjects.set(
            key,
            existing
              ? { ...existing, origin: mergeOrigin(existing.origin, subject.origin) }
              : subject,
          );
          if (subject.namespace) {
            namespaces.set(namespaceKey(subject.namespace), {
              name: subject.namespace,
              labels: null,
              annotations: null,
            });
          }
        });
        clusterRoleBindings.set(document.metadataRef.name, {
          metadataRef: document.metadataRef,
          name: document.metadataRef.name,
          labels: labelsOf(document),
          annotations: annotationsOf(document),
          roleRefApiGroup: roleRef.apiGroup,
          roleRefName: roleRef.name,
          subjects: parsedSubjects.map((subject) => ({ key: subjectKey(subject) })),
        });
        break;
      }

      default:
        break;
    }
  }

  return {
    sourceType: parsed.sourceType,
    sourceLabel: parsed.sourceLabel,
    documents: parsed.documents,
    issues,
    namespaces: Array.from(namespaces.values()),
    subjects: Array.from(subjects.values()),
    roles: Array.from(roles.values()),
    clusterRoles: Array.from(clusterRoles.values()),
    roleBindings: Array.from(roleBindings.values()),
    clusterRoleBindings: Array.from(clusterRoleBindings.values()),
  };
}

export function createBrokenRoleRefFinding(
  metadataRef: MetadataRef,
  roleRefKind: RoleRefKind,
  roleRefName: string,
): BrokenRoleRefFinding {
  return {
    type: FindingType.BROKEN_ROLE_REF,
    severity: FindingSeverity.HIGH,
    title: `Binding references missing ${roleRefKind === RoleRefKind.ROLE ? 'Role' : 'ClusterRole'} ${roleRefName}`,
    details: {
      binding: metadataRef,
      roleRefKind,
      roleRefName,
    },
  };
}

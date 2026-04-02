import { ImportValidationException } from './import.errors';
import { parseImportRequest } from './import.parser';
import { buildNormalizedImportPlan } from './import.validator';

describe('buildNormalizedImportPlan', () => {
  it('accepts a RoleBinding that references a ClusterRole', () => {
    const parsed = parseImportRequest([
      {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        metadata: { name: 'view' },
        rules: [],
      },
      {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: { name: 'view-pods', namespace: 'demo' },
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'view' },
        subjects: [{ kind: 'User', name: 'alice' }],
      },
    ]);

    const plan = buildNormalizedImportPlan(parsed);
    expect(plan.roleBindings).toHaveLength(1);
    expect(plan.roleBindings[0].roleRefKind).toBe('CLUSTER_ROLE');
  });

  it('rejects a ClusterRoleBinding that references a Role', () => {
    const parsed = parseImportRequest({
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: { name: 'invalid-binding' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'reader' },
      subjects: [{ kind: 'User', name: 'alice' }],
    });

    expect(() => buildNormalizedImportPlan(parsed)).toThrow(ImportValidationException);
  });

  it('rejects ServiceAccount subjects without namespace', () => {
    const parsed = parseImportRequest({
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { name: 'invalid-binding', namespace: 'demo' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'reader' },
      subjects: [{ kind: 'ServiceAccount', name: 'default' }],
    });

    expect(() => buildNormalizedImportPlan(parsed)).toThrow(ImportValidationException);
  });
});

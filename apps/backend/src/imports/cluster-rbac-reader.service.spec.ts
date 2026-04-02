import { toClusterImportManifest } from './cluster-rbac-reader.service';

describe('toClusterImportManifest', () => {
  it('adds apiVersion and kind to cluster objects that omit them', () => {
    const manifest = toClusterImportManifest(
      {
        metadata: {
          name: 'default',
        },
      },
      'v1',
      'Namespace',
    );

    expect(manifest).toMatchObject({
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'default',
      },
    });
  });

  it('overrides inconsistent apiVersion and kind with canonical import values', () => {
    const manifest = toClusterImportManifest(
      {
        apiVersion: 'wrong/v1',
        kind: 'SomethingElse',
        metadata: {
          name: 'view',
        },
      },
      'rbac.authorization.k8s.io/v1',
      'ClusterRole',
    );

    expect(manifest.apiVersion).toBe('rbac.authorization.k8s.io/v1');
    expect(manifest.kind).toBe('ClusterRole');
  });

  it('normalizes empty rules and subjects to arrays for cluster imports', () => {
    const roleManifest = toClusterImportManifest(
      {
        metadata: { name: 'empty-role', namespace: 'demo' },
        rules: {},
      },
      'rbac.authorization.k8s.io/v1',
      'Role',
    );

    const roleBindingManifest = toClusterImportManifest(
      {
        metadata: { name: 'binding', namespace: 'demo' },
        subjects: null,
      },
      'rbac.authorization.k8s.io/v1',
      'RoleBinding',
    );

    expect(roleManifest.rules).toEqual([]);
    expect(roleBindingManifest.subjects).toEqual([]);
  });
});

import { SnapshotStatus, SubjectKind, SubjectOrigin } from '@prisma/client';
import { ImportsService } from './imports.service';

function createImportsServiceMock() {
  const tx = {
    importSnapshot: {
      update: jest.fn(),
    },
    rawManifest: {
      createMany: jest.fn(),
    },
    namespace: {
      createMany: jest.fn(),
    },
    subject: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    role: {
      create: jest.fn(),
    },
    clusterRole: {
      create: jest.fn(),
    },
    roleBinding: {
      create: jest.fn(),
    },
    roleBindingSubject: {
      create: jest.fn(),
    },
    clusterRoleBinding: {
      create: jest.fn(),
    },
    clusterRoleBindingSubject: {
      create: jest.fn(),
    },
    analysisFinding: {
      create: jest.fn(),
      count: jest.fn(),
    },
    importRun: {
      update: jest.fn(),
    },
  };

  const prisma = {
    account: {
      upsert: jest.fn(),
    },
    workspace: {
      upsert: jest.fn(),
    },
    workspaceMembership: {
      upsert: jest.fn(),
    },
    project: {
      upsert: jest.fn(),
    },
    importRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
    importSnapshot: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  const clusterRbacReaderService = {
    readRbacResources: jest.fn(),
  };

  return {
    service: new ImportsService(prisma as never, clusterRbacReaderService as never),
    clusterRbacReaderService,
    prisma,
    tx,
  };
}

describe('ImportsService', () => {
  it('creates a snapshot with warning when roleRef is unresolved', async () => {
    const { service, prisma, tx } = createImportsServiceMock();

    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importRun.create.mockResolvedValue({ id: 'import-run-1' });

    prisma.importSnapshot.create.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-default',
      importedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    prisma.importSnapshot.update.mockResolvedValue(undefined);
    prisma.importRun.update.mockResolvedValue(undefined);

    tx.importSnapshot.update.mockResolvedValue(undefined);
    tx.rawManifest.createMany.mockResolvedValue(undefined);
    tx.namespace.createMany.mockResolvedValue(undefined);
    tx.subject.createMany.mockResolvedValue(undefined);
    tx.subject.findMany.mockResolvedValue([
      {
        id: 'subject-1',
        kind: SubjectKind.USER,
        name: 'alice',
        namespace: null,
        origin: SubjectOrigin.BINDING,
      },
    ]);
    tx.roleBinding.create.mockResolvedValue({ id: 'rb-1' });
    tx.roleBindingSubject.create.mockResolvedValue(undefined);
    tx.analysisFinding.create.mockResolvedValue(undefined);
    tx.analysisFinding.count.mockResolvedValue(1);
    tx.importRun.update.mockResolvedValue(undefined);

    const result = await service.createImport({
      body: {
        manifests: [
          {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'RoleBinding',
            metadata: { name: 'read-pods', namespace: 'demo' },
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind: 'Role',
              name: 'missing-role',
            },
            subjects: [{ kind: 'User', name: 'alice' }],
          },
        ],
      },
    });

    expect(result.importId).toBe('snapshot-1');
    expect(result.projectId).toBe('project-default');
    expect(result.importRunId).toBe('import-run-1');
    expect(result.status).toBe(SnapshotStatus.COMPLETED_WITH_WARNINGS);
    expect(result.summary.warningsCount).toBe(1);
    expect(tx.roleBinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isRoleRefResolved: false,
          roleRefName: 'missing-role',
        }),
      }),
    );
    expect(tx.analysisFinding.create).toHaveBeenCalledTimes(1);
  });

  it('creates anomaly findings for wildcard, empty, unused, and cluster-admin patterns', async () => {
    const { service, prisma, tx } = createImportsServiceMock();

    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importRun.create.mockResolvedValue({ id: 'import-run-2' });

    prisma.importSnapshot.create.mockResolvedValue({
      id: 'snapshot-2',
      projectId: 'project-default',
      importedAt: new Date('2026-04-01T00:10:00.000Z'),
    });
    prisma.importSnapshot.update.mockResolvedValue(undefined);
    prisma.importRun.update.mockResolvedValue(undefined);
    tx.importSnapshot.update.mockResolvedValue(undefined);
    tx.rawManifest.createMany.mockResolvedValue(undefined);
    tx.namespace.createMany.mockResolvedValue(undefined);
    tx.subject.createMany.mockResolvedValue(undefined);
    tx.subject.findMany.mockResolvedValue([
      {
        id: 'subject-2',
        kind: SubjectKind.USER,
        name: 'admin',
        namespace: null,
        origin: SubjectOrigin.BINDING,
      },
    ]);
    tx.role.create.mockResolvedValueOnce({ id: 'role-empty' });
    tx.clusterRole.create.mockResolvedValueOnce({ id: 'cluster-role-admin' });
    tx.roleBinding.create.mockResolvedValue({ id: 'rb-admin' });
    tx.roleBindingSubject.create.mockResolvedValue(undefined);
    tx.clusterRoleBinding.create.mockResolvedValue({ id: 'crb-admin' });
    tx.clusterRoleBindingSubject.create.mockResolvedValue(undefined);
    tx.analysisFinding.create.mockResolvedValue(undefined);
    tx.analysisFinding.count.mockResolvedValue(5);
    tx.importRun.update.mockResolvedValue(undefined);

    const result = await service.createImport({
      body: {
        manifests: [
          {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'Role',
            metadata: { name: 'empty-role', namespace: 'demo' },
            rules: [],
          },
          {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'ClusterRole',
            metadata: { name: 'cluster-admin' },
            rules: [
              {
                apiGroups: ['*'],
                resources: ['*'],
                verbs: ['*'],
              },
            ],
          },
          {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'ClusterRoleBinding',
            metadata: { name: 'cluster-admin-binding' },
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind: 'ClusterRole',
              name: 'cluster-admin',
            },
            subjects: [{ kind: 'User', name: 'admin' }],
          },
        ],
      },
    });

    expect(result.status).toBe(SnapshotStatus.COMPLETED);
    expect(result.projectId).toBe('project-default');
    expect(tx.analysisFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'EMPTY_ROLE',
        }),
      }),
    );
    expect(tx.analysisFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'WILDCARD_PERMISSION',
        }),
      }),
    );
    expect(tx.analysisFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CLUSTER_ADMIN_USAGE',
        }),
      }),
    );
    expect(tx.analysisFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'UNUSED_ROLE',
        }),
      }),
    );
  });

  it('creates sensitive resource and excessive privilege findings', async () => {
    const { service, prisma, tx } = createImportsServiceMock();

    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importRun.create.mockResolvedValue({ id: 'import-run-3' });

    prisma.importSnapshot.create.mockResolvedValue({
      id: 'snapshot-3',
      projectId: 'project-default',
      importedAt: new Date('2026-04-01T00:20:00.000Z'),
    });
    prisma.importSnapshot.update.mockResolvedValue(undefined);
    prisma.importRun.update.mockResolvedValue(undefined);
    tx.importSnapshot.update.mockResolvedValue(undefined);
    tx.rawManifest.createMany.mockResolvedValue(undefined);
    tx.namespace.createMany.mockResolvedValue(undefined);
    tx.subject.createMany.mockResolvedValue(undefined);
    tx.subject.findMany.mockResolvedValue([]);
    tx.clusterRole.create.mockResolvedValueOnce({ id: 'cluster-role-sensitive' });
    tx.analysisFinding.create.mockResolvedValue(undefined);
    tx.analysisFinding.count.mockResolvedValue(3);
    tx.importRun.update.mockResolvedValue(undefined);

    const result = await service.createImport({
      body: {
        manifests: [
          {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'ClusterRole',
            metadata: { name: 'rbac-manager' },
            rules: [
              {
                apiGroups: ['rbac.authorization.k8s.io'],
                resources: [
                  'roles',
                  'rolebindings',
                  'clusterroles',
                  'clusterrolebindings',
                  'secrets',
                ],
                verbs: ['create', 'update', 'patch', 'delete'],
              },
              {
                apiGroups: [''],
                resources: ['pods', 'configmaps', 'services', 'deployments'],
                verbs: ['get', 'list', 'watch', 'create', 'update'],
              },
            ],
          },
        ],
      },
    });

    expect(result.status).toBe(SnapshotStatus.COMPLETED);
    expect(result.projectId).toBe('project-default');
    expect(tx.analysisFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SENSITIVE_RESOURCE_FULL_ACCESS',
        }),
      }),
    );
    expect(tx.analysisFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'EXCESSIVE_PRIVILEGE',
        }),
      }),
    );
  });

  it('creates a cluster import from cluster reader results', async () => {
    const { service, clusterRbacReaderService, prisma, tx } = createImportsServiceMock();

    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importRun.create.mockResolvedValue({ id: 'import-run-cluster-1' });

    prisma.importSnapshot.create.mockResolvedValue({
      id: 'snapshot-cluster-1',
      projectId: 'project-default',
      importedAt: new Date('2026-04-01T00:30:00.000Z'),
    });
    prisma.importSnapshot.update.mockResolvedValue(undefined);
    prisma.importRun.update.mockResolvedValue(undefined);
    tx.importSnapshot.update.mockResolvedValue(undefined);
    tx.rawManifest.createMany.mockResolvedValue(undefined);
    tx.namespace.createMany.mockResolvedValue(undefined);
    tx.subject.createMany.mockResolvedValue(undefined);
    tx.subject.findMany.mockResolvedValue([]);
    tx.clusterRole.create.mockResolvedValueOnce({ id: 'cluster-role-view' });
    tx.analysisFinding.create.mockResolvedValue(undefined);
    tx.analysisFinding.count.mockResolvedValue(1);
    tx.importRun.update.mockResolvedValue(undefined);

    clusterRbacReaderService.readRbacResources.mockResolvedValue({
      contextName: 'kind-rbac-visualizer',
      manifests: [
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRole',
          metadata: { name: 'view' },
          rules: [],
        },
      ],
    });

    const result = await service.createClusterImport({
      contextName: 'kind-rbac-visualizer',
      kubeconfigPath: '/tmp/test-kubeconfig',
    });

    expect(clusterRbacReaderService.readRbacResources).toHaveBeenCalledWith({
      contextName: 'kind-rbac-visualizer',
      kubeconfigPath: '/tmp/test-kubeconfig',
    });
    expect(result.importId).toBe('snapshot-cluster-1');
    expect(result.projectId).toBe('project-default');
    expect(result.importRunId).toBe('import-run-cluster-1');
    expect(result.sourceLabel).toBe('cluster:kind-rbac-visualizer');
  });
});

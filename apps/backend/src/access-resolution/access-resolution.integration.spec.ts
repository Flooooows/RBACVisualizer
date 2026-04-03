import { SubjectKind } from '@prisma/client';
import { AccessResolutionService } from './access-resolution.service';

function buildServiceMock(): {
  service: AccessResolutionService;
  prisma: {
    account: {
      upsert: jest.Mock;
    };
    workspace: {
      upsert: jest.Mock;
    };
    workspaceMembership: {
      upsert: jest.Mock;
    };
    project: {
      upsert: jest.Mock;
    };
    subject: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    importSnapshot: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    analysisFinding: {
      findMany: jest.Mock;
    };
  };
} {
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
    subject: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    importSnapshot: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    analysisFinding: {
      findMany: jest.fn(),
    },
  };

  return {
    service: new AccessResolutionService(prisma as never),
    prisma,
  };
}

function createSubjectFixture() {
  return {
    id: 'subject-1',
    kind: SubjectKind.SERVICE_ACCOUNT,
    name: 'app',
    namespace: 'demo',
    roleBindingSubjects: [
      {
        roleBinding: {
          id: 'rb-1',
          name: 'read-pods',
          namespace: 'demo',
          roleRefRole: {
            id: 'role-1',
            name: 'pods-reader',
            namespace: 'demo',
            rules: [
              {
                ruleOrder: 0,
                verbs: ['get', 'list'],
                resources: ['pods'],
                apiGroups: [''],
                resourceNames: [],
                nonResourceURLs: [],
              },
            ],
          },
          roleRefClusterRole: null,
        },
      },
    ],
    clusterRoleBindingSubjects: [],
  };
}

describe('AccessResolutionService integration', () => {
  it('returns resolved subject access paths', async () => {
    const { service, prisma } = buildServiceMock();
    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importSnapshot.findFirst.mockResolvedValue({ id: 'snapshot-1' });
    prisma.subject.findFirst.mockResolvedValue(createSubjectFixture());

    const result = await service.getSubjectAccess({
      importId: 'snapshot-1',
      subjectId: 'subject-1',
    });

    expect(result.subject.name).toBe('app');
    expect(result.permissions).toHaveLength(1);
    expect(result.permissions[0]).toMatchObject({
      bindingKind: 'RoleBinding',
      roleKind: 'Role',
      resources: ['pods'],
      verbs: ['get', 'list'],
    });
  });

  it('builds a subject-focus graph payload from resolved access', async () => {
    const { service, prisma } = buildServiceMock();
    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importSnapshot.findFirst.mockResolvedValue({ id: 'snapshot-1' });
    prisma.subject.findFirst.mockResolvedValue(createSubjectFixture());

    const result = (await service.getSubjectFocusGraph({
      importId: 'snapshot-1',
      subjectId: 'subject-1',
    })) as {
      graph: { nodes: Array<{ type: string }>; edges: Array<{ type: string }> };
      meta: { rootNodeIds: string[] };
    };

    expect(result.meta.rootNodeIds).toEqual(['subject:sa:demo:app']);
    expect(result.graph.nodes.some((node) => node.type === 'subject')).toBe(true);
    expect(result.graph.nodes.some((node) => node.type === 'binding')).toBe(true);
    expect(result.graph.nodes.some((node) => node.type === 'role')).toBe(true);
    expect(result.graph.edges.some((edge) => edge.type === 'role_permission')).toBe(true);
  });

  it('returns subjects that can access a resource', async () => {
    const { service, prisma } = buildServiceMock();
    prisma.account.upsert.mockResolvedValue({ id: 'account-default' });
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-default' });
    prisma.workspaceMembership.upsert.mockResolvedValue({ id: 'membership-default' });
    prisma.project.upsert.mockResolvedValue({ id: 'project-default' });
    prisma.importSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.importSnapshot.findFirst.mockResolvedValue({ id: 'snapshot-1' });
    prisma.subject.findMany.mockResolvedValue([createSubjectFixture()]);

    const result = await service.getResourceAccess({
      importId: 'snapshot-1',
      resource: 'pods',
      verb: 'get',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].subject.name).toBe('app');
  });
});

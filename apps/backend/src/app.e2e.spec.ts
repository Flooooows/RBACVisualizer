import { text } from 'express';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';
import { ImportsService } from './imports/imports.service';
import { AccessResolutionService } from './access-resolution/access-resolution.service';
import { PrismaService } from './persistence/prisma.service';
import { validationExceptionFactory } from './common/validation.exception-factory';

describe('AppModule HTTP', () => {
  let app: INestApplication;

  const importsService = {
    createImport: jest.fn(),
    createClusterImport: jest.fn(),
    getClusterStatus: jest.fn(),
    listImports: jest.fn(),
    getImportById: jest.fn(),
  };

  const accessResolutionService = {
    listSubjects: jest.fn(),
    getSubjectAccess: jest.fn(),
    explainSubjectAccess: jest.fn(),
    getResourceAccess: jest.fn(),
    getSubjectFocusGraph: jest.fn(),
    getDashboard: jest.fn(),
    listAnomalies: jest.fn(),
  };

  const prismaService = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ImportsService)
      .useValue(importsService)
      .overrideProvider(AccessResolutionService)
      .useValue(accessResolutionService)
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    app.use(
      text({
        type: ['text/plain', 'text/yaml', 'text/x-yaml', 'application/yaml', 'application/x-yaml'],
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'rbac-visualizer-backend',
    });
  });

  it('creates an import snapshot over HTTP', async () => {
    importsService.createImport.mockResolvedValue({
      importId: 'snapshot-1',
      status: 'COMPLETED_WITH_WARNINGS',
      issues: [{ code: 'BROKEN_ROLE_REF', severity: 'WARNING' }],
      summary: {
        documentsReceived: 1,
        documentsAccepted: 1,
        normalizedCounts: {
          namespaces: 1,
          subjects: 1,
          roles: 0,
          clusterRoles: 1,
          roleBindings: 1,
          clusterRoleBindings: 0,
          findings: 1,
        },
        errorsCount: 0,
        warningsCount: 1,
      },
      createdAt: '2026-04-01T00:00:00.000Z',
      finishedAt: '2026-04-01T00:00:00.100Z',
    });

    const payload = {
      sourceType: 'YAML',
      sourceLabel: 'http-test',
      raw: 'apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: app\n  namespace: demo\n',
    };

    const response = await request(app.getHttpServer())
      .post('/api/imports')
      .send(payload)
      .expect(201);

    expect(importsService.createImport).toHaveBeenCalledWith({
      body: payload,
      contentType: expect.stringContaining('application/json'),
    });
    expect(response.body.importId).toBe('snapshot-1');
  });

  it('creates a cluster import over HTTP', async () => {
    importsService.createClusterImport.mockResolvedValue({
      importId: 'snapshot-cluster-1',
      status: 'COMPLETED',
      issues: [],
      summary: {
        documentsReceived: 6,
        documentsAccepted: 6,
        normalizedCounts: {
          namespaces: 1,
          subjects: 1,
          roles: 1,
          clusterRoles: 1,
          roleBindings: 1,
          clusterRoleBindings: 1,
          findings: 0,
        },
        errorsCount: 0,
        warningsCount: 0,
      },
      createdAt: '2026-04-01T00:00:00.000Z',
      finishedAt: '2026-04-01T00:00:00.100Z',
    });

    const payload = {
      kubeconfigPath: '/tmp/test-kubeconfig',
      contextName: 'kind-rbac-visualizer',
      sourceLabel: 'cluster-test',
    };

    const response = await request(app.getHttpServer())
      .post('/api/imports/cluster')
      .send(payload)
      .expect(201);

    expect(importsService.createClusterImport).toHaveBeenCalledWith(payload);
    expect(response.body.importId).toBe('snapshot-cluster-1');
  });

  it('returns cluster connection status over HTTP', async () => {
    importsService.getClusterStatus.mockResolvedValue({
      reachable: true,
      contextName: 'kind-rbac-visualizer',
      clusterServer: 'https://127.0.0.1:6443',
      counts: {
        namespaces: 4,
        serviceAccounts: 12,
        roles: 3,
        clusterRoles: 48,
        roleBindings: 2,
        clusterRoleBindings: 6,
      },
    });

    const payload = {
      kubeconfigPath: '/tmp/test-kubeconfig',
      contextName: 'kind-rbac-visualizer',
    };

    const response = await request(app.getHttpServer())
      .post('/api/imports/cluster/status')
      .send(payload)
      .expect(201);

    expect(importsService.getClusterStatus).toHaveBeenCalledWith(payload);
    expect(response.body.reachable).toBe(true);
    expect(response.body.contextName).toBe('kind-rbac-visualizer');
  });

  it('lists imports and returns import detail', async () => {
    importsService.listImports.mockResolvedValue({
      items: [{ id: 'snapshot-1', status: 'COMPLETED', documents: 4, findings: 5 }],
    });
    importsService.getImportById.mockResolvedValue({
      id: 'snapshot-1',
      status: 'COMPLETED',
      documents: [],
      counts: {
        rawManifests: 4,
        namespaces: 1,
        subjects: 1,
        roles: 1,
        clusterRoles: 1,
        roleBindings: 1,
        clusterRoleBindings: 1,
        findings: 5,
      },
      warnings: [],
    });

    const listResponse = await request(app.getHttpServer()).get('/api/imports').expect(200);
    const detailResponse = await request(app.getHttpServer())
      .get('/api/imports/snapshot-1')
      .expect(200);

    expect(listResponse.body.items).toHaveLength(1);
    expect(detailResponse.body.id).toBe('snapshot-1');
  });

  it('serves dashboard and anomaly endpoints', async () => {
    accessResolutionService.getDashboard.mockResolvedValue({
      snapshotId: 'snapshot-1',
      snapshotStatus: 'COMPLETED_WITH_WARNINGS',
      cards: [{ id: 'findings', label: 'Findings', value: 5 }],
    });
    accessResolutionService.listAnomalies.mockResolvedValue({
      items: [
        {
          id: 'finding-1',
          type: 'CLUSTER_ADMIN_USAGE',
          severity: 'CRITICAL',
          title: 'ClusterRoleBinding cluster-admin-binding references cluster-admin',
        },
      ],
    });

    const dashboardResponse = await request(app.getHttpServer())
      .get('/api/dashboard?importId=snapshot-1')
      .expect(200);
    const anomaliesResponse = await request(app.getHttpServer())
      .get('/api/anomalies?importId=snapshot-1')
      .expect(200);

    expect(accessResolutionService.getDashboard).toHaveBeenCalledWith('snapshot-1');
    expect(dashboardResponse.body.snapshotId).toBe('snapshot-1');
    expect(anomaliesResponse.body.items[0].type).toBe('CLUSTER_ADMIN_USAGE');
  });

  it('serves subject listing, subject access, and explain endpoints', async () => {
    accessResolutionService.listSubjects.mockResolvedValue({
      items: [{ id: 'subject-1', kind: 'USER', name: 'admin', namespace: null }],
    });
    accessResolutionService.getSubjectAccess.mockResolvedValue({
      subject: { id: 'subject-1', kind: 'USER', name: 'admin', namespace: null },
      permissions: [
        {
          bindingId: 'binding-1',
          bindingKind: 'ClusterRoleBinding',
          bindingName: 'cluster-admin-binding',
          bindingNamespace: null,
          roleId: 'role-1',
          roleKind: 'ClusterRole',
          roleName: 'cluster-admin',
          roleNamespace: null,
          scopeType: 'cluster',
          ruleIndex: 0,
          verbs: ['*'],
          resources: ['*'],
          apiGroups: ['*'],
          resourceNames: [],
          nonResourceURLs: [],
        },
      ],
    });
    accessResolutionService.explainSubjectAccess.mockResolvedValue({
      subject: { id: 'subject-1', kind: 'USER', name: 'admin', namespace: null },
      allowed: true,
      matches: [{ bindingId: 'binding-1' }],
    });

    const subjectsResponse = await request(app.getHttpServer())
      .get('/api/subjects?importId=snapshot-1')
      .expect(200);
    const accessResponse = await request(app.getHttpServer())
      .get('/api/subjects/subject-1/access?importId=snapshot-1')
      .expect(200);
    const explainResponse = await request(app.getHttpServer())
      .get('/api/subjects/subject-1/explain?importId=snapshot-1&resource=pods&verb=get')
      .expect(200);

    expect(subjectsResponse.body.items[0].name).toBe('admin');
    expect(accessResponse.body.permissions).toHaveLength(1);
    expect(explainResponse.body.allowed).toBe(true);
  });

  it('serves resource access and graph subject-focus endpoints', async () => {
    accessResolutionService.getResourceAccess.mockResolvedValue({
      items: [
        {
          subject: { id: 'subject-1', kind: 'USER', name: 'admin', namespace: null },
          matches: [{ bindingId: 'binding-1', roleName: 'cluster-admin' }],
        },
      ],
    });
    accessResolutionService.getSubjectFocusGraph.mockResolvedValue({
      view: 'subject-focus',
      graph: {
        nodes: [{ id: 'subject:user:admin', type: 'subject' }],
        edges: [{ id: 'edge-1', type: 'subject_binding' }],
      },
      meta: { rootNodeIds: ['subject:user:admin'] },
    });

    const resourceResponse = await request(app.getHttpServer())
      .get('/api/resources/access?importId=snapshot-1&resource=pods&verb=get')
      .expect(200);
    const graphResponse = await request(app.getHttpServer())
      .get('/api/graph?importId=snapshot-1&subjectId=subject-1')
      .expect(200);

    expect(resourceResponse.body.items[0].subject.name).toBe('admin');
    expect(graphResponse.body.view).toBe('subject-focus');
    expect(graphResponse.body.meta.rootNodeIds).toEqual(['subject:user:admin']);
  });

  it('returns structured validation errors for missing required query params', async () => {
    const response = await request(app.getHttpServer()).get('/api/anomalies').expect(400);

    expect(response.body.message).toBe('Validation failed');
    expect(response.body.statusCode).toBe(400);
    expect(response.body.path).toBe('/api/anomalies');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'importId',
        }),
      ]),
    );
  });
});

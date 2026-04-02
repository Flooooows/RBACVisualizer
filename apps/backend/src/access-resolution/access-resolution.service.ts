import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubjectKind } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type {
  PermissionSummaryNode,
  ResolvedPermissionPath,
  ResourceAccessMatch,
  SubjectAccessResponse,
  SubjectSummary,
} from './access-resolution.types';

const subjectInclude = {
  roleBindingSubjects: {
    include: {
      roleBinding: {
        include: {
          roleRefRole: { include: { rules: true } },
          roleRefClusterRole: { include: { rules: true } },
        },
      },
    },
  },
  clusterRoleBindingSubjects: {
    include: {
      clusterRoleBinding: {
        include: {
          roleRefClusterRole: { include: { rules: true } },
        },
      },
    },
  },
} satisfies Prisma.SubjectInclude;

type SubjectWithBindings = Prisma.SubjectGetPayload<{ include: typeof subjectInclude }>;

function requireImportId(importId?: string): string {
  if (!importId) {
    throw new BadRequestException('Query parameter importId is required.');
  }

  return importId;
}

function summarizeSubject(subject: SubjectWithBindings): SubjectSummary {
  return {
    id: subject.id,
    kind: subject.kind,
    name: subject.name,
    namespace: subject.namespace,
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function includesValue(values: string[], expected: string): boolean {
  return values.includes('*') || values.includes(expected);
}

function matchesResource(path: ResolvedPermissionPath, resource: string): boolean {
  return path.resources.length === 0 || includesValue(path.resources, resource);
}

function matchesVerb(path: ResolvedPermissionPath, verb: string): boolean {
  return path.verbs.length === 0 || includesValue(path.verbs, verb);
}

function matchesNamespace(path: ResolvedPermissionPath, namespace?: string): boolean {
  if (!namespace) {
    return true;
  }

  if (path.scopeType === 'cluster') {
    return true;
  }

  return path.bindingNamespace === namespace;
}

function permissionSummaryLabel(path: ResolvedPermissionPath): string {
  const apiGroupLabel = path.apiGroups.length > 0 ? path.apiGroups.join(',') : 'core';
  const resourceLabel = path.resources.length > 0 ? path.resources.join(',') : 'non-resource';
  const verbsLabel = path.verbs.length > 0 ? path.verbs.join(',') : '*';
  return `${apiGroupLabel}/${resourceLabel}: ${verbsLabel}`;
}

@Injectable()
export class AccessResolutionService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listSubjects(params: {
    importId?: string;
    type?: SubjectKind;
    search?: string;
    namespace?: string;
  }): Promise<{ items: SubjectSummary[] }> {
    const importId = requireImportId(params.importId);
    const subjects = await this.prisma.subject.findMany({
      where: {
        snapshotId: importId,
        kind: params.type,
        namespace: params.namespace,
        name: params.search ? { contains: params.search, mode: 'insensitive' } : undefined,
      },
      orderBy: [{ kind: 'asc' }, { namespace: 'asc' }, { name: 'asc' }],
    });

    return {
      items: subjects.map((subject) => ({
        id: subject.id,
        kind: subject.kind,
        name: subject.name,
        namespace: subject.namespace,
      })),
    };
  }

  async getSubjectAccess(params: {
    importId?: string;
    subjectId: string;
    namespace?: string;
  }): Promise<SubjectAccessResponse> {
    const importId = requireImportId(params.importId);
    const subject = await this.prisma.subject.findFirst({
      where: { id: params.subjectId, snapshotId: importId },
      include: subjectInclude,
    });

    if (!subject) {
      throw new NotFoundException(
        `Subject ${params.subjectId} was not found in snapshot ${importId}.`,
      );
    }

    const permissions = this.resolveSubjectPermissionPaths(subject).filter((path) =>
      matchesNamespace(path, params.namespace),
    );

    return {
      subject: summarizeSubject(subject),
      permissions,
    };
  }

  async explainSubjectAccess(params: {
    importId?: string;
    subjectId: string;
    resource: string;
    verb: string;
    namespace?: string;
  }): Promise<{
    subject: SubjectSummary;
    allowed: boolean;
    matches: ResolvedPermissionPath[];
  }> {
    const access = await this.getSubjectAccess({
      importId: params.importId,
      subjectId: params.subjectId,
      namespace: params.namespace,
    });

    const matches = access.permissions.filter(
      (path) =>
        matchesResource(path, params.resource) &&
        matchesVerb(path, params.verb) &&
        matchesNamespace(path, params.namespace),
    );

    return {
      subject: access.subject,
      allowed: matches.length > 0,
      matches,
    };
  }

  async getResourceAccess(params: {
    importId?: string;
    resource: string;
    verb: string;
    namespace?: string;
  }): Promise<{ items: ResourceAccessMatch[] }> {
    const importId = requireImportId(params.importId);
    const subjects = await this.prisma.subject.findMany({
      where: { snapshotId: importId },
      include: subjectInclude,
      orderBy: [{ kind: 'asc' }, { namespace: 'asc' }, { name: 'asc' }],
    });

    const items = subjects
      .map((subject) => {
        const matches = this.resolveSubjectPermissionPaths(subject).filter(
          (path) =>
            matchesNamespace(path, params.namespace) &&
            matchesResource(path, params.resource) &&
            matchesVerb(path, params.verb),
        );

        if (matches.length === 0) {
          return null;
        }

        return {
          subject: summarizeSubject(subject),
          matches,
        } satisfies ResourceAccessMatch;
      })
      .filter((item): item is ResourceAccessMatch => item !== null);

    return { items };
  }

  async getSubjectFocusGraph(params: {
    importId?: string;
    subjectId: string;
    namespace?: string;
    includePermissions?: boolean;
  }): Promise<unknown> {
    if (!params.subjectId) {
      throw new BadRequestException('Query parameter subjectId is required.');
    }

    const access = await this.getSubjectAccess({
      importId: params.importId,
      subjectId: params.subjectId,
      namespace: params.namespace,
    });

    const nodes = new Map<string, Record<string, unknown>>();
    const edges = new Map<string, Record<string, unknown>>();
    const subject = access.subject;
    const subjectNodeId = this.buildSubjectNodeId(subject);

    nodes.set(subjectNodeId, {
      id: subjectNodeId,
      type: 'subject',
      label: subject.name,
      scopeType: subject.kind === SubjectKind.SERVICE_ACCOUNT ? 'namespace' : 'cluster',
      namespace: subject.namespace,
      kind: 'Subject',
      subjectKind: subject.kind,
      metadataRef: {
        kind: subject.kind,
        name: subject.name,
        namespace: subject.namespace,
      },
      badges: subject.namespace ? [subject.namespace] : [],
    });

    const permissionNodes =
      params.includePermissions === false
        ? []
        : this.buildPermissionSummaryNodes(access.permissions);

    for (const path of access.permissions) {
      const bindingNodeId = this.buildBindingNodeId(path);
      const roleNodeId = this.buildRoleNodeId(path);

      if (!nodes.has(bindingNodeId)) {
        nodes.set(bindingNodeId, {
          id: bindingNodeId,
          type: 'binding',
          label: path.bindingName,
          scopeType: path.scopeType,
          namespace: path.bindingNamespace,
          kind: path.bindingKind,
          metadataRef: {
            kind: path.bindingKind,
            name: path.bindingName,
            namespace: path.bindingNamespace,
          },
          badges: path.bindingNamespace ? [path.bindingNamespace] : ['cluster'],
        });
      }

      if (!nodes.has(roleNodeId)) {
        nodes.set(roleNodeId, {
          id: roleNodeId,
          type: 'role',
          label: path.roleName,
          scopeType: path.roleKind === 'Role' ? 'namespace' : 'cluster',
          namespace: path.roleNamespace,
          kind: path.roleKind,
          metadataRef: {
            kind: path.roleKind,
            name: path.roleName,
            namespace: path.roleNamespace,
          },
          badges: path.roleNamespace ? [path.roleNamespace] : ['cluster'],
        });
      }

      const subjectBindingEdgeId = `edge:${subjectNodeId}->${bindingNodeId}`;
      edges.set(subjectBindingEdgeId, {
        id: subjectBindingEdgeId,
        type: 'subject_binding',
        source: subjectNodeId,
        target: bindingNodeId,
        scopeType: path.scopeType,
        namespace: path.bindingNamespace,
        explain: 'Subject is listed in binding subjects[].',
      });

      const bindingRoleEdgeId = `edge:${bindingNodeId}->${roleNodeId}`;
      edges.set(bindingRoleEdgeId, {
        id: bindingRoleEdgeId,
        type: 'binding_role',
        source: bindingNodeId,
        target: roleNodeId,
        scopeType: path.scopeType,
        namespace: path.bindingNamespace,
        explain: 'Binding roleRef.',
      });
    }

    if (params.includePermissions !== false) {
      for (const permissionNode of permissionNodes) {
        nodes.set(permissionNode.id, permissionNode);
        const roleNodeId = permissionNode.id.split(':perm:')[0];
        const edgeId = `edge:${roleNodeId}->${permissionNode.id}`;
        edges.set(edgeId, {
          id: edgeId,
          type: 'role_permission',
          source: roleNodeId,
          target: permissionNode.id,
          scopeType: 'derived',
          namespace: permissionNode.namespace,
          explain: 'Role rules summarized for display.',
        });
      }
    }

    return {
      view: 'subject-focus',
      filters: {
        importId: params.importId,
        subjectId: params.subjectId,
        namespace: params.namespace ?? null,
        includePermissions: params.includePermissions !== false,
      },
      graph: {
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values()),
      },
      meta: {
        rootNodeIds: [subjectNodeId],
        nodeCounts: {
          subject: 1,
          binding: Array.from(nodes.values()).filter((node) => node.type === 'binding').length,
          role: Array.from(nodes.values()).filter((node) => node.type === 'role').length,
          permission_summary: Array.from(nodes.values()).filter(
            (node) => node.type === 'permission_summary',
          ).length,
        },
        truncated: false,
        warnings: [],
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async getDashboard(importId?: string): Promise<unknown> {
    const resolvedImportId = requireImportId(importId);
    const snapshot = await this.prisma.importSnapshot.findUnique({
      where: { id: resolvedImportId },
      include: {
        _count: {
          select: {
            rawManifests: true,
            subjects: true,
            roles: true,
            clusterRoles: true,
            roleBindings: true,
            clusterRoleBindings: true,
            findings: true,
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`Import snapshot ${resolvedImportId} was not found.`);
    }

    return {
      snapshotId: snapshot.id,
      snapshotStatus: snapshot.status,
      importedAt: snapshot.importedAt.toISOString(),
      completedAt: snapshot.completedAt?.toISOString() ?? null,
      cards: [
        { id: 'documents', label: 'Documents', value: snapshot._count.rawManifests },
        { id: 'subjects', label: 'Subjects', value: snapshot._count.subjects },
        {
          id: 'bindings',
          label: 'Bindings',
          value: snapshot._count.roleBindings + snapshot._count.clusterRoleBindings,
        },
        {
          id: 'roles',
          label: 'Roles',
          value: snapshot._count.roles + snapshot._count.clusterRoles,
        },
        { id: 'findings', label: 'Findings', value: snapshot._count.findings },
      ],
    };
  }

  async listAnomalies(importId?: string): Promise<unknown> {
    const resolvedImportId = requireImportId(importId);
    const findings = await this.prisma.analysisFinding.findMany({
      where: { snapshotId: resolvedImportId },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        details: true,
        createdAt: true,
      },
    });

    return {
      items: findings.map((finding) => ({
        ...finding,
        createdAt: finding.createdAt.toISOString(),
      })),
    };
  }

  private resolveSubjectPermissionPaths(subject: SubjectWithBindings): ResolvedPermissionPath[] {
    const fromRoleBindings: ResolvedPermissionPath[] = subject.roleBindingSubjects.flatMap(
      ({ roleBinding }) => {
        const role = roleBinding.roleRefRole;
        const clusterRole = roleBinding.roleRefClusterRole;
        const resolvedRole = role ?? clusterRole;

        if (!resolvedRole) {
          return [];
        }

        const roleKind = role ? ('Role' as const) : ('ClusterRole' as const);
        const roleNamespace = role ? role.namespace : null;
        const rules = role ? role.rules : (clusterRole?.rules ?? []);

        return rules.map(
          (rule): ResolvedPermissionPath => ({
            bindingId: roleBinding.id,
            bindingKind: 'RoleBinding',
            bindingName: roleBinding.name,
            bindingNamespace: roleBinding.namespace,
            roleId: resolvedRole.id,
            roleKind,
            roleName: resolvedRole.name,
            roleNamespace,
            scopeType: 'namespace',
            ruleIndex: rule.ruleOrder,
            verbs: uniqueSorted(rule.verbs),
            resources: uniqueSorted(rule.resources),
            apiGroups: uniqueSorted(rule.apiGroups),
            resourceNames: uniqueSorted(rule.resourceNames),
            nonResourceURLs: uniqueSorted(rule.nonResourceURLs),
          }),
        );
      },
    );

    const fromClusterRoleBindings: ResolvedPermissionPath[] =
      subject.clusterRoleBindingSubjects.flatMap(({ clusterRoleBinding }) => {
        const clusterRole = clusterRoleBinding.roleRefClusterRole;
        if (!clusterRole) {
          return [];
        }

        return clusterRole.rules.map(
          (rule): ResolvedPermissionPath => ({
            bindingId: clusterRoleBinding.id,
            bindingKind: 'ClusterRoleBinding',
            bindingName: clusterRoleBinding.name,
            bindingNamespace: null,
            roleId: clusterRole.id,
            roleKind: 'ClusterRole',
            roleName: clusterRole.name,
            roleNamespace: null,
            scopeType: 'cluster',
            ruleIndex: rule.ruleOrder,
            verbs: uniqueSorted(rule.verbs),
            resources: uniqueSorted(rule.resources),
            apiGroups: uniqueSorted(rule.apiGroups),
            resourceNames: uniqueSorted(rule.resourceNames),
            nonResourceURLs: uniqueSorted(rule.nonResourceURLs),
          }),
        );
      });

    return [...fromRoleBindings, ...fromClusterRoleBindings];
  }

  private buildSubjectNodeId(subject: SubjectSummary): string {
    if (subject.kind === SubjectKind.USER) {
      return `subject:user:${subject.name}`;
    }

    if (subject.kind === SubjectKind.GROUP) {
      return `subject:group:${subject.name}`;
    }

    return `subject:sa:${subject.namespace}:${subject.name}`;
  }

  private buildBindingNodeId(path: ResolvedPermissionPath): string {
    return path.bindingKind === 'RoleBinding'
      ? `binding:rb:${path.bindingNamespace}:${path.bindingName}`
      : `binding:crb:${path.bindingName}`;
  }

  private buildRoleNodeId(path: ResolvedPermissionPath): string {
    return path.roleKind === 'Role'
      ? `role:r:${path.roleNamespace}:${path.roleName}`
      : `role:cr:${path.roleName}`;
  }

  private buildPermissionSummaryNodes(paths: ResolvedPermissionPath[]): PermissionSummaryNode[] {
    const grouped = new Map<string, PermissionSummaryNode>();

    for (const path of paths) {
      const roleNodeId = this.buildRoleNodeId(path);
      const summaryKey = [
        roleNodeId,
        path.apiGroups.join(','),
        path.resources.join(','),
        path.verbs.join(','),
      ].join('|');
      const existing = grouped.get(summaryKey);

      if (existing) {
        existing.ruleCount += 1;
        existing.badges = uniqueSorted([
          ...existing.badges,
          ...(path.resources.includes('*') || path.verbs.includes('*') ? ['wildcard'] : []),
        ]);
        continue;
      }

      grouped.set(summaryKey, {
        id: `${roleNodeId}:perm:${grouped.size + 1}`,
        label: permissionSummaryLabel(path),
        type: 'permission_summary',
        kind: 'PermissionSummary',
        scopeType: 'derived',
        namespace: path.bindingNamespace,
        badges: path.resources.includes('*') || path.verbs.includes('*') ? ['wildcard'] : [],
        metadataRef: {
          kind: 'PermissionSummary',
          name: permissionSummaryLabel(path),
          namespace: path.bindingNamespace,
        },
        apiGroups: path.apiGroups,
        resources: path.resources,
        verbs: path.verbs,
        ruleCount: 1,
      });
    }

    return Array.from(grouped.values());
  }
}

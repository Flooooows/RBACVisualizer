import { Injectable, NotFoundException } from '@nestjs/common';
import { FindingSeverity, FindingType, Prisma, RoleRefKind, SnapshotStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ImportValidationException } from './import.errors';
import { parseImportRequest } from './import.parser';
import { buildNormalizedImportPlan, createBrokenRoleRefFinding } from './import.validator';
import { PrismaService } from '../persistence/prisma.service';
import { ClusterRbacReaderService } from './cluster-rbac-reader.service';
import { ClusterStatusDto } from './dto/cluster-status.dto';
import { CreateClusterImportDto } from './dto/create-cluster-import.dto';
import type {
  ImportIssue,
  PersistedImportResult,
  PersistedImportSummary,
  TempSubject,
} from './import.types';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function subjectKey(subject: TempSubject): string {
  if (subject.kind === 'SERVICE_ACCOUNT') {
    return `SERVICE_ACCOUNT:${subject.namespace}:${subject.name}`;
  }

  return `${subject.kind}:${subject.name}`;
}

function hasWildcard(rule: {
  verbs: string[];
  resources: string[];
  apiGroups: string[];
  resourceNames: string[];
  nonResourceURLs: string[];
}): boolean {
  return [
    rule.verbs,
    rule.resources,
    rule.apiGroups,
    rule.resourceNames,
    rule.nonResourceURLs,
  ].some((values) => values.includes('*'));
}

function buildFinding(
  type: FindingType,
  severity: FindingSeverity,
  title: string,
  details: Record<string, unknown>,
): {
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  details: Prisma.InputJsonValue;
} {
  return {
    type,
    severity,
    title,
    details: toJsonValue(details),
  };
}

const SENSITIVE_RESOURCES = new Set([
  'secrets',
  'roles',
  'clusterroles',
  'rolebindings',
  'clusterrolebindings',
]);

const PRIVILEGE_ESCALATION_VERBS = new Set([
  '*',
  'create',
  'update',
  'patch',
  'delete',
  'bind',
  'escalate',
]);

function intersects(values: string[], candidates: Set<string>): boolean {
  return values.some((value) => candidates.has(value));
}

function hasSensitiveResourceFullAccess(rule: { verbs: string[]; resources: string[] }): boolean {
  return (
    intersects(rule.resources, SENSITIVE_RESOURCES) &&
    intersects(rule.verbs, PRIVILEGE_ESCALATION_VERBS)
  );
}

function privilegeScore(
  rules: Array<{ verbs: string[]; resources: string[]; apiGroups: string[] }>,
): number {
  return rules.reduce((score, rule) => {
    const verbsCount = Math.max(1, rule.verbs.length);
    const resourcesCount = Math.max(1, rule.resources.length);
    const apiGroupsCount = Math.max(1, rule.apiGroups.length);
    const wildcardWeight = hasWildcard({ ...rule, resourceNames: [], nonResourceURLs: [] })
      ? 10
      : 0;
    return score + verbsCount * resourcesCount * apiGroupsCount + wildcardWeight;
  }, 0);
}

@Injectable()
export class ImportsService {
  private readonly prisma: PrismaService;
  private readonly clusterRbacReaderService: ClusterRbacReaderService;

  constructor(prisma: PrismaService, clusterRbacReaderService: ClusterRbacReaderService) {
    this.prisma = prisma;
    this.clusterRbacReaderService = clusterRbacReaderService;
  }

  async createClusterImport(input: CreateClusterImportDto): Promise<PersistedImportResult> {
    const clusterReadResult = await this.clusterRbacReaderService.readRbacResources(input);

    return this.createImport({
      body: {
        sourceType: 'JSON',
        sourceLabel: input.sourceLabel ?? `cluster:${clusterReadResult.contextName}`,
        manifests: clusterReadResult.manifests,
      },
      contentType: 'application/json',
    });
  }

  async getClusterStatus(input: ClusterStatusDto): Promise<unknown> {
    return this.clusterRbacReaderService.getConnectionStatus(input);
  }

  async createImport(input: {
    body: unknown;
    contentType?: string;
  }): Promise<PersistedImportResult> {
    const parsed = parseImportRequest(input.body, input.contentType);
    const snapshot = await this.prisma.importSnapshot.create({
      data: {
        sourceType: parsed.sourceType,
        sourceLabel: parsed.sourceLabel,
        status: SnapshotStatus.RECEIVED,
        checksum: createHash('sha256')
          .update(JSON.stringify(parsed.documents.map((document) => document.manifest)))
          .digest('hex'),
      },
    });

    try {
      await this.prisma.importSnapshot.update({
        where: { id: snapshot.id },
        data: { status: SnapshotStatus.VALIDATING },
      });

      const plan = buildNormalizedImportPlan(parsed);

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.importSnapshot.update({
          where: { id: snapshot.id },
          data: { status: SnapshotStatus.NORMALIZING },
        });

        await tx.rawManifest.createMany({
          data: plan.documents.map((document) => ({
            snapshotId: snapshot.id,
            apiVersion: document.metadataRef.apiVersion,
            kind: document.metadataRef.kind,
            namespace: document.metadataRef.namespace,
            name: document.metadataRef.name,
            documentOrder: document.index,
            manifest: toJsonValue(document.manifest),
            labels: toJsonValue(
              (document.manifest.metadata as Record<string, unknown> | undefined)?.labels ?? null,
            ),
            annotations: toJsonValue(
              (document.manifest.metadata as Record<string, unknown> | undefined)?.annotations ??
                null,
            ),
          })),
        });

        await tx.namespace.createMany({
          data: plan.namespaces.map((namespace) => ({
            snapshotId: snapshot.id,
            name: namespace.name,
            labels: toJsonValue(namespace.labels),
            annotations: toJsonValue(namespace.annotations),
          })),
          skipDuplicates: true,
        });

        await tx.subject.createMany({
          data: plan.subjects.map((subject) => ({
            snapshotId: snapshot.id,
            kind: subject.kind,
            name: subject.name,
            namespace: subject.namespace,
            origin: subject.origin,
          })),
          skipDuplicates: true,
        });

        const roleIdByKey = new Map<string, string>();
        const referencedRoleIds = new Set<string>();
        const referencedClusterRoleIds = new Set<string>();
        for (const role of plan.roles) {
          const createdRole = await tx.role.create({
            data: {
              snapshotId: snapshot.id,
              namespace: role.namespace,
              name: role.name,
              labels: toJsonValue(role.labels),
              annotations: toJsonValue(role.annotations),
              rules: {
                create: role.rules.map((rule, index) => ({
                  ruleOrder: index,
                  apiGroups: rule.apiGroups,
                  resources: rule.resources,
                  verbs: rule.verbs,
                  resourceNames: rule.resourceNames,
                  nonResourceURLs: rule.nonResourceURLs,
                })),
              },
            },
          });
          roleIdByKey.set(`${role.namespace}:${role.name}`, createdRole.id);

          if (role.rules.length === 0) {
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                roleId: createdRole.id,
                ...buildFinding(
                  FindingType.EMPTY_ROLE,
                  FindingSeverity.MEDIUM,
                  `Role ${role.namespace}/${role.name} has no rules`,
                  {
                    role: role.metadataRef,
                  },
                ),
              },
            });
          }

          const rolePrivilegeScore = privilegeScore(role.rules);
          if (rolePrivilegeScore >= 20) {
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                roleId: createdRole.id,
                ...buildFinding(
                  FindingType.EXCESSIVE_PRIVILEGE,
                  FindingSeverity.HIGH,
                  `Role ${role.namespace}/${role.name} has a high privilege score`,
                  {
                    role: role.metadataRef,
                    privilegeScore: rolePrivilegeScore,
                  },
                ),
              },
            });
          }

          for (const rule of role.rules) {
            if (hasSensitiveResourceFullAccess(rule)) {
              await tx.analysisFinding.create({
                data: {
                  snapshotId: snapshot.id,
                  roleId: createdRole.id,
                  ...buildFinding(
                    FindingType.SENSITIVE_RESOURCE_FULL_ACCESS,
                    FindingSeverity.HIGH,
                    `Role ${role.namespace}/${role.name} can modify sensitive RBAC resources`,
                    {
                      role: role.metadataRef,
                      rule,
                    },
                  ),
                },
              });
            }

            if (!hasWildcard(rule)) {
              continue;
            }

            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                roleId: createdRole.id,
                ...buildFinding(
                  FindingType.WILDCARD_PERMISSION,
                  FindingSeverity.HIGH,
                  `Role ${role.namespace}/${role.name} contains wildcard permissions`,
                  {
                    role: role.metadataRef,
                    rule,
                  },
                ),
              },
            });
          }
        }

        const clusterRoleIdByKey = new Map<string, string>();
        for (const clusterRole of plan.clusterRoles) {
          const createdClusterRole = await tx.clusterRole.create({
            data: {
              snapshotId: snapshot.id,
              name: clusterRole.name,
              labels: toJsonValue(clusterRole.labels),
              annotations: toJsonValue(clusterRole.annotations),
              aggregationRule: toJsonValue(clusterRole.aggregationRule),
              rules: {
                create: clusterRole.rules.map((rule, index) => ({
                  ruleOrder: index,
                  apiGroups: rule.apiGroups,
                  resources: rule.resources,
                  verbs: rule.verbs,
                  resourceNames: rule.resourceNames,
                  nonResourceURLs: rule.nonResourceURLs,
                })),
              },
            },
          });
          clusterRoleIdByKey.set(clusterRole.name, createdClusterRole.id);

          if (clusterRole.rules.length === 0) {
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                clusterRoleId: createdClusterRole.id,
                ...buildFinding(
                  FindingType.EMPTY_ROLE,
                  FindingSeverity.MEDIUM,
                  `ClusterRole ${clusterRole.name} has no rules`,
                  {
                    clusterRole: clusterRole.metadataRef,
                  },
                ),
              },
            });
          }

          const clusterRolePrivilegeScore = privilegeScore(clusterRole.rules);
          if (clusterRolePrivilegeScore >= 20) {
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                clusterRoleId: createdClusterRole.id,
                ...buildFinding(
                  FindingType.EXCESSIVE_PRIVILEGE,
                  FindingSeverity.HIGH,
                  `ClusterRole ${clusterRole.name} has a high privilege score`,
                  {
                    clusterRole: clusterRole.metadataRef,
                    privilegeScore: clusterRolePrivilegeScore,
                  },
                ),
              },
            });
          }

          for (const rule of clusterRole.rules) {
            if (hasSensitiveResourceFullAccess(rule)) {
              await tx.analysisFinding.create({
                data: {
                  snapshotId: snapshot.id,
                  clusterRoleId: createdClusterRole.id,
                  ...buildFinding(
                    FindingType.SENSITIVE_RESOURCE_FULL_ACCESS,
                    FindingSeverity.HIGH,
                    `ClusterRole ${clusterRole.name} can modify sensitive RBAC resources`,
                    {
                      clusterRole: clusterRole.metadataRef,
                      rule,
                    },
                  ),
                },
              });
            }

            if (!hasWildcard(rule)) {
              continue;
            }

            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                clusterRoleId: createdClusterRole.id,
                ...buildFinding(
                  FindingType.WILDCARD_PERMISSION,
                  FindingSeverity.HIGH,
                  `ClusterRole ${clusterRole.name} contains wildcard permissions`,
                  {
                    clusterRole: clusterRole.metadataRef,
                    rule,
                  },
                ),
              },
            });
          }
        }

        const subjects = await tx.subject.findMany({ where: { snapshotId: snapshot.id } });
        const subjectIdByKey = new Map<string, string>(
          subjects.map((subject) => [subjectKey(subject as TempSubject), subject.id]),
        );

        const roleBindingIdByKey = new Map<string, string>();
        const roleBindingWarnings: ImportIssue[] = [];

        for (const binding of plan.roleBindings) {
          const resolvedRoleId =
            binding.roleRefKind === RoleRefKind.ROLE
              ? (roleIdByKey.get(`${binding.namespace}:${binding.roleRefName}`) ?? null)
              : null;
          const resolvedClusterRoleId =
            binding.roleRefKind === RoleRefKind.CLUSTER_ROLE
              ? (clusterRoleIdByKey.get(binding.roleRefName) ?? null)
              : null;
          const isResolved = Boolean(resolvedRoleId || resolvedClusterRoleId);

          if (resolvedRoleId) {
            referencedRoleIds.add(resolvedRoleId);
          }

          if (resolvedClusterRoleId) {
            referencedClusterRoleIds.add(resolvedClusterRoleId);
          }

          const createdBinding = await tx.roleBinding.create({
            data: {
              snapshotId: snapshot.id,
              namespace: binding.namespace,
              name: binding.name,
              labels: toJsonValue(binding.labels),
              annotations: toJsonValue(binding.annotations),
              roleRefKind: binding.roleRefKind,
              roleRefApiGroup: binding.roleRefApiGroup,
              roleRefName: binding.roleRefName,
              roleRefRoleId: resolvedRoleId,
              roleRefClusterRoleId: resolvedClusterRoleId,
              isRoleRefResolved: isResolved,
            },
          });
          roleBindingIdByKey.set(`${binding.namespace}:${binding.name}`, createdBinding.id);

          for (const subjectRef of binding.subjects) {
            const subjectId = subjectIdByKey.get(subjectRef.key);
            if (subjectId) {
              await tx.roleBindingSubject.create({
                data: {
                  roleBindingId: createdBinding.id,
                  subjectId,
                },
              });
            }
          }

          const bindingSubjectIds = binding.subjects
            .map((subjectRef) => subjectIdByKey.get(subjectRef.key))
            .filter((subjectId): subjectId is string => Boolean(subjectId));

          if (!isResolved) {
            roleBindingWarnings.push({
              code: 'BROKEN_ROLE_REF',
              severity: 'WARNING',
              message: `RoleBinding ${binding.name} references missing ${binding.roleRefKind === RoleRefKind.ROLE ? 'Role' : 'ClusterRole'} ${binding.roleRefName}.`,
              kind: binding.metadataRef.kind,
              name: binding.name,
              namespace: binding.namespace,
            });
            const finding = createBrokenRoleRefFinding(
              binding.metadataRef,
              binding.roleRefKind,
              binding.roleRefName,
            );
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                type: finding.type,
                severity: finding.severity,
                title: finding.title,
                details: toJsonValue({
                  ...finding.details,
                  subjectIds: bindingSubjectIds,
                }),
                roleBindingId: createdBinding.id,
              },
            });
          }

          if (
            binding.roleRefKind === RoleRefKind.CLUSTER_ROLE &&
            binding.roleRefName === 'cluster-admin'
          ) {
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                roleBindingId: createdBinding.id,
                clusterRoleId: resolvedClusterRoleId,
                ...buildFinding(
                  FindingType.CLUSTER_ADMIN_USAGE,
                  FindingSeverity.CRITICAL,
                  `RoleBinding ${binding.namespace}/${binding.name} references cluster-admin`,
                  {
                    binding: binding.metadataRef,
                    roleRefName: binding.roleRefName,
                    subjectIds: bindingSubjectIds,
                  },
                ),
              },
            });
          }
        }

        const clusterRoleBindingWarnings: ImportIssue[] = [];
        for (const binding of plan.clusterRoleBindings) {
          const resolvedClusterRoleId = clusterRoleIdByKey.get(binding.roleRefName) ?? null;

          if (resolvedClusterRoleId) {
            referencedClusterRoleIds.add(resolvedClusterRoleId);
          }

          const createdBinding = await tx.clusterRoleBinding.create({
            data: {
              snapshotId: snapshot.id,
              name: binding.name,
              labels: toJsonValue(binding.labels),
              annotations: toJsonValue(binding.annotations),
              roleRefApiGroup: binding.roleRefApiGroup,
              roleRefName: binding.roleRefName,
              roleRefClusterRoleId: resolvedClusterRoleId,
              isRoleRefResolved: Boolean(resolvedClusterRoleId),
            },
          });

          for (const subjectRef of binding.subjects) {
            const subjectId = subjectIdByKey.get(subjectRef.key);
            if (subjectId) {
              await tx.clusterRoleBindingSubject.create({
                data: {
                  clusterRoleBindingId: createdBinding.id,
                  subjectId,
                },
              });
            }
          }

          const bindingSubjectIds = binding.subjects
            .map((subjectRef) => subjectIdByKey.get(subjectRef.key))
            .filter((subjectId): subjectId is string => Boolean(subjectId));

          if (!resolvedClusterRoleId) {
            clusterRoleBindingWarnings.push({
              code: 'BROKEN_ROLE_REF',
              severity: 'WARNING',
              message: `ClusterRoleBinding ${binding.name} references missing ClusterRole ${binding.roleRefName}.`,
              kind: binding.metadataRef.kind,
              name: binding.name,
              namespace: null,
            });
            const finding = createBrokenRoleRefFinding(
              binding.metadataRef,
              RoleRefKind.CLUSTER_ROLE,
              binding.roleRefName,
            );
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                type: finding.type,
                severity: finding.severity,
                title: finding.title,
                details: toJsonValue({
                  ...finding.details,
                  subjectIds: bindingSubjectIds,
                }),
                clusterRoleBindingId: createdBinding.id,
              },
            });
          }

          if (binding.roleRefName === 'cluster-admin') {
            await tx.analysisFinding.create({
              data: {
                snapshotId: snapshot.id,
                clusterRoleBindingId: createdBinding.id,
                clusterRoleId: resolvedClusterRoleId,
                ...buildFinding(
                  FindingType.CLUSTER_ADMIN_USAGE,
                  FindingSeverity.CRITICAL,
                  `ClusterRoleBinding ${binding.name} references cluster-admin`,
                  {
                    binding: binding.metadataRef,
                    roleRefName: binding.roleRefName,
                    subjectIds: bindingSubjectIds,
                  },
                ),
              },
            });
          }
        }

        for (const role of plan.roles) {
          const roleId = roleIdByKey.get(`${role.namespace}:${role.name}`);
          if (!roleId || referencedRoleIds.has(roleId)) {
            continue;
          }

          await tx.analysisFinding.create({
            data: {
              snapshotId: snapshot.id,
              roleId,
              ...buildFinding(
                FindingType.UNUSED_ROLE,
                FindingSeverity.MEDIUM,
                `Role ${role.namespace}/${role.name} is not referenced by any binding`,
                {
                  role: role.metadataRef,
                },
              ),
            },
          });
        }

        for (const clusterRole of plan.clusterRoles) {
          const clusterRoleId = clusterRoleIdByKey.get(clusterRole.name);
          if (!clusterRoleId || referencedClusterRoleIds.has(clusterRoleId)) {
            continue;
          }

          await tx.analysisFinding.create({
            data: {
              snapshotId: snapshot.id,
              clusterRoleId,
              ...buildFinding(
                FindingType.UNUSED_ROLE,
                FindingSeverity.MEDIUM,
                `ClusterRole ${clusterRole.name} is not referenced by any binding`,
                {
                  clusterRole: clusterRole.metadataRef,
                },
              ),
            },
          });
        }

        const warnings = [...plan.issues, ...roleBindingWarnings, ...clusterRoleBindingWarnings];
        const findingsCount = await tx.analysisFinding.count({
          where: { snapshotId: snapshot.id },
        });
        const status =
          warnings.length > 0 ? SnapshotStatus.COMPLETED_WITH_WARNINGS : SnapshotStatus.COMPLETED;
        const completedAt = new Date();

        await tx.importSnapshot.update({
          where: { id: snapshot.id },
          data: {
            status,
            completedAt,
          },
        });

        return {
          warnings,
          status,
          completedAt,
          summary: {
            documentsReceived: plan.documents.length,
            documentsAccepted: plan.documents.length,
            normalizedCounts: {
              namespaces: plan.namespaces.length,
              subjects: plan.subjects.length,
              roles: plan.roles.length,
              clusterRoles: plan.clusterRoles.length,
              roleBindings: plan.roleBindings.length,
              clusterRoleBindings: plan.clusterRoleBindings.length,
              findings: findingsCount,
            },
            errorsCount: 0,
            warningsCount: warnings.length,
          } satisfies PersistedImportSummary,
        };
      });

      return {
        importId: snapshot.id,
        status: result.status,
        sourceType: parsed.sourceType,
        sourceLabel: parsed.sourceLabel,
        issues: result.warnings,
        summary: result.summary,
        createdAt: snapshot.importedAt.toISOString(),
        finishedAt: result.completedAt.toISOString(),
      };
    } catch (error) {
      await this.prisma.importSnapshot.update({
        where: { id: snapshot.id },
        data: {
          status: SnapshotStatus.FAILED,
          completedAt: new Date(),
        },
      });

      if (error instanceof ImportValidationException) {
        throw error;
      }

      throw error;
    }
  }

  async listImports(): Promise<unknown> {
    const snapshots = await this.prisma.importSnapshot.findMany({
      orderBy: { importedAt: 'desc' },
      include: {
        _count: {
          select: {
            rawManifests: true,
            findings: true,
          },
        },
      },
    });

    return {
      items: snapshots.map((snapshot) => ({
        id: snapshot.id,
        status: snapshot.status,
        sourceType: snapshot.sourceType,
        sourceLabel: snapshot.sourceLabel,
        importedAt: snapshot.importedAt.toISOString(),
        completedAt: snapshot.completedAt?.toISOString() ?? null,
        documents: snapshot._count.rawManifests,
        findings: snapshot._count.findings,
      })),
    };
  }

  async getImportById(id: string): Promise<unknown> {
    const snapshot = await this.prisma.importSnapshot.findUnique({
      where: { id },
      include: {
        rawManifests: {
          orderBy: { documentOrder: 'asc' },
          select: {
            id: true,
            apiVersion: true,
            kind: true,
            namespace: true,
            name: true,
            documentOrder: true,
          },
        },
        findings: {
          where: { type: FindingType.BROKEN_ROLE_REF },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            severity: true,
            title: true,
            details: true,
          },
        },
        _count: {
          select: {
            rawManifests: true,
            namespaces: true,
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
      throw new NotFoundException(`Import snapshot ${id} was not found.`);
    }

    return {
      id: snapshot.id,
      status: snapshot.status,
      sourceType: snapshot.sourceType,
      sourceLabel: snapshot.sourceLabel,
      importedAt: snapshot.importedAt.toISOString(),
      completedAt: snapshot.completedAt?.toISOString() ?? null,
      documents: snapshot.rawManifests,
      counts: snapshot._count,
      warnings: snapshot.findings,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { ClusterConnectionStatus, ClusterProvider } from '@prisma/client';
import { CreateClusterImportDto } from '../imports/dto/create-cluster-import.dto';
import { ensureDefaultProjectScope } from '../imports/import.scope';
import { ImportsService } from '../imports/imports.service';
import { PrismaService } from '../persistence/prisma.service';
import { ClusterRbacReaderService } from '../imports/cluster-rbac-reader.service';
import { CreateClusterConnectionDto } from './dto/create-cluster-connection.dto';

@Injectable()
export class ClusterConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importsService: ImportsService,
    private readonly clusterRbacReaderService: ClusterRbacReaderService,
  ) {}

  async list(projectId?: string): Promise<{
    items: Array<{
      id: string;
      name: string;
      provider: ClusterProvider;
      apiServerHost: string | null;
      kubeconfigPath: string | null;
      contextName: string | null;
      status: ClusterConnectionStatus;
      lastValidatedAt: string | null;
      projectId: string;
    }>;
  }> {
    const scopedProjectId = await ensureDefaultProjectScope(this.prisma, projectId);
    const connections = await this.prisma.clusterConnection.findMany({
      where: { projectId: scopedProjectId },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return {
      items: connections.map((connection) => ({
        id: connection.id,
        name: connection.name,
        provider: connection.provider,
        apiServerHost: connection.apiServerHost,
        kubeconfigPath: connection.kubeconfigPath,
        contextName: connection.contextName,
        status: connection.status,
        lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
        projectId: connection.projectId,
      })),
    };
  }

  async create(input: CreateClusterConnectionDto): Promise<unknown> {
    const scopedProjectId = await ensureDefaultProjectScope(this.prisma, input.projectId);
    const connection = await this.prisma.clusterConnection.create({
      data: {
        projectId: scopedProjectId,
        name: input.name,
        provider: input.provider ?? ClusterProvider.KUBERNETES,
        kubeconfigPath: input.kubeconfigPath,
        contextName: input.contextName,
      },
    });

    return {
      id: connection.id,
      name: connection.name,
      provider: connection.provider,
      apiServerHost: connection.apiServerHost,
      kubeconfigPath: connection.kubeconfigPath,
      contextName: connection.contextName,
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
      projectId: connection.projectId,
    };
  }

  async check(connectionId: string, projectId?: string): Promise<unknown> {
    const connection = await this.getScopedConnection(connectionId, projectId);
    const status = await this.clusterRbacReaderService.getConnectionStatus({
      kubeconfigPath: connection.kubeconfigPath ?? undefined,
      contextName: connection.contextName ?? undefined,
    });

    await this.prisma.clusterConnection.update({
      where: { id: connection.id },
      data: {
        status: ClusterConnectionStatus.ACTIVE,
        apiServerHost: status.clusterServer,
        lastValidatedAt: new Date(),
      },
    });

    return {
      connectionId: connection.id,
      ...status,
    };
  }

  async import(
    connectionId: string,
    input: { projectId?: string; sourceLabel?: string },
  ): Promise<unknown> {
    const connection = await this.getScopedConnection(connectionId, input.projectId);

    return this.importsService.createClusterImport({
      projectId: connection.projectId,
      sourceLabel: input.sourceLabel ?? connection.name,
      kubeconfigPath: connection.kubeconfigPath ?? undefined,
      contextName: connection.contextName ?? undefined,
    } satisfies CreateClusterImportDto);
  }

  private async getScopedConnection(connectionId: string, projectId?: string) {
    const scopedProjectId = await ensureDefaultProjectScope(this.prisma, projectId);
    const connection = await this.prisma.clusterConnection.findFirst({
      where: {
        id: connectionId,
        projectId: scopedProjectId,
      },
    });

    if (!connection) {
      throw new NotFoundException(
        `Cluster connection ${connectionId} was not found in project scope ${scopedProjectId}.`,
      );
    }

    return connection;
  }
}

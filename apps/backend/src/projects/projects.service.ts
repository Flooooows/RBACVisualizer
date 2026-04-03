import { Injectable } from '@nestjs/common';
import { ensureDefaultProjectScope } from '../imports/import.scope';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjects(): Promise<{
    items: Array<{
      id: string;
      name: string;
      slug: string;
      workspaceId: string;
      workspaceName: string;
      isArchived: boolean;
    }>;
  }> {
    await ensureDefaultProjectScope(this.prisma);

    const projects = await this.prisma.project.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ isArchived: 'asc' }, { updatedAt: 'desc' }],
    });

    return {
      items: projects.map((project) => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        workspaceId: project.workspace.id,
        workspaceName: project.workspace.name,
        isArchived: project.isArchived,
      })),
    };
  }
}

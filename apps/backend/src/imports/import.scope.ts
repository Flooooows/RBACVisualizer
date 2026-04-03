import { PrismaClient } from '@prisma/client';

export const DEFAULT_ACCOUNT_EMAIL = 'default@rbac-visualizer.local';
export const DEFAULT_WORKSPACE_SLUG = 'default-workspace';
export const DEFAULT_PROJECT_SLUG = 'default-project';

type PrismaLike = Pick<
  PrismaClient,
  'account' | 'workspace' | 'workspaceMembership' | 'project' | 'importSnapshot'
>;

export async function ensureDefaultProjectScope(
  prisma: PrismaLike,
  requestedProjectId?: string | null,
): Promise<string> {
  if (requestedProjectId) {
    return requestedProjectId;
  }

  const account = await prisma.account.upsert({
    where: { email: DEFAULT_ACCOUNT_EMAIL },
    update: {},
    create: {
      email: DEFAULT_ACCOUNT_EMAIL,
      displayName: 'Default Workspace Owner',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    update: {},
    create: {
      slug: DEFAULT_WORKSPACE_SLUG,
      name: 'Default Workspace',
      ownerAccountId: account.id,
    },
  });

  await prisma.workspaceMembership.upsert({
    where: {
      workspaceId_accountId: {
        workspaceId: workspace.id,
        accountId: account.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      accountId: account.id,
      role: 'OWNER',
    },
  });

  const project = await prisma.project.upsert({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug: DEFAULT_PROJECT_SLUG,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      slug: DEFAULT_PROJECT_SLUG,
      name: 'Default Project',
      description:
        'Default project used until explicit SaaS workspace/project selection is enabled.',
    },
  });

  await prisma.importSnapshot.updateMany({
    where: { projectId: null },
    data: { projectId: project.id },
  });

  return project.id;
}

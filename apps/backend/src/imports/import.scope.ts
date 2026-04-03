import { PrismaClient } from '@prisma/client';

export const LEGACY_ACCOUNT_EMAIL = 'legacy@rbac-visualizer.local';
export const LEGACY_WORKSPACE_SLUG = 'legacy-workspace';
export const LEGACY_PROJECT_SLUG = 'legacy-project';

type PrismaLike = Pick<
  PrismaClient,
  'account' | 'workspace' | 'workspaceMembership' | 'project' | 'importSnapshot'
>;

export async function ensureProjectScope(
  prisma: PrismaLike,
  requestedProjectId?: string | null,
): Promise<string> {
  if (requestedProjectId) {
    return requestedProjectId;
  }

  const account = await prisma.account.upsert({
    where: { email: LEGACY_ACCOUNT_EMAIL },
    update: {},
    create: {
      email: LEGACY_ACCOUNT_EMAIL,
      displayName: 'Legacy Workspace Owner',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: LEGACY_WORKSPACE_SLUG },
    update: {},
    create: {
      slug: LEGACY_WORKSPACE_SLUG,
      name: 'Legacy Workspace',
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
        slug: LEGACY_PROJECT_SLUG,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      slug: LEGACY_PROJECT_SLUG,
      name: 'Legacy Project',
      description:
        'Default project used to scope snapshots created before full SaaS tenancy is enabled.',
    },
  });

  await prisma.importSnapshot.updateMany({
    where: { projectId: null },
    data: { projectId: project.id },
  });

  return project.id;
}

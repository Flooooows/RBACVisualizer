import { BadRequestException, Injectable } from '@nestjs/common';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { ClusterStatusDto } from './dto/cluster-status.dto';
import { CreateClusterImportDto } from './dto/create-cluster-import.dto';

type ClusterImportReadResult = {
  contextName: string;
  manifests: Record<string, unknown>[];
};

type ClusterConnectionStatus = {
  reachable: boolean;
  contextName: string;
  clusterServer: string | null;
  counts: {
    namespaces: number;
    serviceAccounts: number;
    roles: number;
    clusterRoles: number;
    roleBindings: number;
    clusterRoleBindings: number;
  };
};

type KubernetesObjectLike = {
  apiVersion?: string;
  kind?: string;
  metadata?: unknown;
  rules?: unknown;
  subjects?: unknown;
} & object;

function expandUserHome(filePath: string): string {
  return filePath.startsWith('~/') ? resolve(homedir(), filePath.slice(2)) : resolve(filePath);
}

export function toClusterImportManifest(
  item: KubernetesObjectLike,
  apiVersion: string,
  kind: string,
): Record<string, unknown> {
  const manifest = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;

  if ((kind === 'Role' || kind === 'ClusterRole') && !Array.isArray(manifest.rules)) {
    manifest.rules = [];
  }

  if (
    (kind === 'RoleBinding' || kind === 'ClusterRoleBinding') &&
    !Array.isArray(manifest.subjects)
  ) {
    manifest.subjects = [];
  }

  return {
    ...manifest,
    apiVersion,
    kind,
  };
}

@Injectable()
export class ClusterRbacReaderService {
  async getConnectionStatus(input: ClusterStatusDto): Promise<ClusterConnectionStatus> {
    const { coreApi, kubeConfig, rbacApi } = await this.createClients(input);

    try {
      const [namespaces, serviceAccounts, roles, clusterRoles, roleBindings, clusterRoleBindings] =
        await Promise.all([
          coreApi.listNamespace(),
          coreApi.listServiceAccountForAllNamespaces(),
          rbacApi.listRoleForAllNamespaces(),
          rbacApi.listClusterRole(),
          rbacApi.listRoleBindingForAllNamespaces(),
          rbacApi.listClusterRoleBinding(),
        ]);

      return {
        reachable: true,
        contextName: kubeConfig.getCurrentContext() || 'default-context',
        clusterServer: kubeConfig.getCurrentCluster()?.server ?? null,
        counts: {
          namespaces: namespaces.items?.length ?? 0,
          serviceAccounts: serviceAccounts.items?.length ?? 0,
          roles: roles.items?.length ?? 0,
          clusterRoles: clusterRoles.items?.length ?? 0,
          roleBindings: roleBindings.items?.length ?? 0,
          clusterRoleBindings: clusterRoleBindings.items?.length ?? 0,
        },
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Unable to reach the Kubernetes cluster with the provided kubeconfig/context.',
        detail: error instanceof Error ? error.message : 'Unknown Kubernetes API error.',
      });
    }
  }

  async readRbacResources(input: CreateClusterImportDto): Promise<ClusterImportReadResult> {
    const { coreApi, kubeConfig, rbacApi } = await this.createClients(input);

    try {
      const [namespaces, serviceAccounts, roles, clusterRoles, roleBindings, clusterRoleBindings] =
        await Promise.all([
          coreApi.listNamespace(),
          coreApi.listServiceAccountForAllNamespaces(),
          rbacApi.listRoleForAllNamespaces(),
          rbacApi.listClusterRole(),
          rbacApi.listRoleBindingForAllNamespaces(),
          rbacApi.listClusterRoleBinding(),
        ]);

      return {
        contextName: kubeConfig.getCurrentContext() || 'default-context',
        manifests: [
          ...(namespaces.items ?? []).map((item) =>
            toClusterImportManifest(item, 'v1', 'Namespace'),
          ),
          ...(serviceAccounts.items ?? []).map((item) =>
            toClusterImportManifest(item, 'v1', 'ServiceAccount'),
          ),
          ...(roles.items ?? []).map((item) =>
            toClusterImportManifest(item, 'rbac.authorization.k8s.io/v1', 'Role'),
          ),
          ...(clusterRoles.items ?? []).map((item) =>
            toClusterImportManifest(item, 'rbac.authorization.k8s.io/v1', 'ClusterRole'),
          ),
          ...(roleBindings.items ?? []).map((item) =>
            toClusterImportManifest(item, 'rbac.authorization.k8s.io/v1', 'RoleBinding'),
          ),
          ...(clusterRoleBindings.items ?? []).map((item) =>
            toClusterImportManifest(item, 'rbac.authorization.k8s.io/v1', 'ClusterRoleBinding'),
          ),
        ],
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Unable to read RBAC resources from the Kubernetes cluster.',
        detail: error instanceof Error ? error.message : 'Unknown Kubernetes API error.',
      });
    }
  }

  private async createClients(input: { kubeconfigPath?: string; contextName?: string }) {
    const { CoreV1Api, KubeConfig, RbacAuthorizationV1Api } =
      await import('@kubernetes/client-node');
    const kubeConfig = new KubeConfig();

    try {
      if (input.kubeconfigPath) {
        kubeConfig.loadFromFile(expandUserHome(input.kubeconfigPath));
      } else {
        kubeConfig.loadFromDefault();
      }
    } catch (error) {
      throw new BadRequestException({
        message: 'Unable to load kubeconfig for cluster import.',
        detail: error instanceof Error ? error.message : 'Unknown kubeconfig error.',
      });
    }

    if (input.contextName) {
      kubeConfig.setCurrentContext(input.contextName);
    }

    return {
      kubeConfig,
      coreApi: kubeConfig.makeApiClient(CoreV1Api),
      rbacApi: kubeConfig.makeApiClient(RbacAuthorizationV1Api),
    };
  }
}

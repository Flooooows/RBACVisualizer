#!/usr/bin/env sh
set -eu

CLUSTER_NAME="rbac-visualizer"
export KIND_EXPERIMENTAL_PROVIDER="podman"

if ! command -v kind >/dev/null 2>&1; then
  printf '%s\n' "kind is not installed. Install kind first: https://kind.sigs.k8s.io/" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  printf '%s\n' "kubectl is not installed. Install kubectl first." >&2
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  printf '%s\n' "podman is not installed. Install podman first." >&2
  exit 1
fi

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  printf '%s\n' "kind cluster '${CLUSTER_NAME}' already exists."
else
  kind create cluster --name "${CLUSTER_NAME}"
fi

kubectl config use-context "kind-${CLUSTER_NAME}"
printf '%s\n' "Using context kind-${CLUSTER_NAME}"

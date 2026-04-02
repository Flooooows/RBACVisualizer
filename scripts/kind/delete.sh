#!/usr/bin/env sh
set -eu

CLUSTER_NAME="rbac-visualizer"
export KIND_EXPERIMENTAL_PROVIDER="podman"

if ! command -v kind >/dev/null 2>&1; then
  printf '%s\n' "kind is not installed." >&2
  exit 1
fi

kind delete cluster --name "${CLUSTER_NAME}" || true

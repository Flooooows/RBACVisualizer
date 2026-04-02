#!/usr/bin/env sh
set -eu

if ! command -v kubectl >/dev/null 2>&1; then
  printf '%s\n' "kubectl is not installed." >&2
  exit 1
fi

kubectl config use-context kind-rbac-visualizer

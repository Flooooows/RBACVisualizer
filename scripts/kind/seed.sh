#!/usr/bin/env sh
set -eu

if ! command -v kubectl >/dev/null 2>&1; then
  printf '%s\n' "kubectl is not installed." >&2
  exit 1
fi

kubectl apply -f scripts/kind/seed-rbac.yaml
printf '%s\n' "Applied scripts/kind/seed-rbac.yaml"

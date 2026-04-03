# RBAC Visualizer

Kubernetes-first RBAC Visualizer scaffold for the MVP defined in `AGENTS.md`.

## Current MVP status

- npm workspaces monorepo
- NestJS backend with import, anomalies, access resolution, graph, and dashboard endpoints
- Next.js frontend connected to the backend for imports, anomalies, graph, subjects, and resources
- Tailwind styling and React Flow subject-focus graph rendering
- PostgreSQL wiring via Prisma schema and validated local DB sync
- Minimal `docker-compose.yml` for local development
- Basic backend hardening with security headers and configurable import body limit
- Minimal GitHub Actions CI for build / lint / test

## Documentation

- Usage guide: `docs/USAGE.md`
- Local staging runbook: `docs/STAGING_LOCAL.md`

## Tested user flow

This repository has already been validated with the following MVP flow:

- create a PostgreSQL database locally
- push the Prisma schema
- start backend and frontend
- import a YAML RBAC snapshot
- import RBAC directly from a Kubernetes cluster through kubeconfig
- inspect findings on `/anomalies`
- inspect subject-focus graph on `/graph`
- inspect subject and resource access on `/subjects` and `/resources`

## Local development

1. Install dependencies from the repository root:

   npm install

2. Ensure your `.env` exists.

   You said you already created `.env` with the same values as `.env.example`, so you can keep it as-is.

3. Start PostgreSQL with Podman:

   npm run start:db

4. Verify PostgreSQL is reachable:

   pg_isready -h localhost -p 5432

5. Apply the Prisma schema:

   npm run db:push

   For an actual migration workflow instead of a schema push, use:

   npm run db:migrate:dev

6. Start both apps in development mode:

   npm run dev

7. Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/api/health`

8. Optional: stop the database when you are done:

   podman stop rbac-visualizer-postgres

## Stop the application

If you started the app in the current terminal with `npm run dev`, you can usually stop it with:

```bash
Ctrl+C
```

If the frontend or backend is still running in the background, you can stop them with:

```bash
npm run stop
```

To stop and relaunch the application in one command:

```bash
npm run restart
```

To verify that the app is no longer running:

```bash
ss -ltnp | grep ":3000\|:4000"
```

If nothing is returned, both app servers are stopped.

To stop PostgreSQL too:

```bash
npm run stop:db
```

To start PostgreSQL again later:

```bash
npm run start:db
```

### Optional backend env tuning

- `CORS_ORIGIN` controls the allowed frontend origin
- `IMPORT_BODY_LIMIT` controls the maximum raw YAML/JSON payload accepted by the import endpoint

## Prisma / database workflow

This project now supports both a quick local schema sync flow and a more production-like Prisma migration flow.

### Quick local flow

Use this when you just want to get the app running locally fast:

```bash
npm run start:db
npm run db:push
npm run dev
```

### Migration-driven flow

Use this when you want a cleaner pre-production workflow:

```bash
npm run start:db
npm run db:migrate:dev
npm run dev
```

If you already initialized your local database previously with `npm run db:push`, Prisma may consider that schema as unmanaged for migrations. In that case, reset the local database once and continue with migrations:

```bash
npm run db:reset
npm run db:migrate:deploy
```

This is intended for local/pre-production environments only.

Useful database commands:

```bash
npm run db:generate
npm run db:status
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:reset
```

Suggested local staging-like workflow:

```bash
npm run start:db
npm run db:migrate:deploy
npm run build
npm run lint
npm run test
npm run start
```

If you are just testing iteratively during development, `npm run db:push` remains acceptable.

### Current SaaS bootstrap behavior

The phase 1 SaaS data model is now present in the database:

- `Account`
- `Workspace`
- `WorkspaceMembership`
- `Project`
- `ClusterConnection`
- `ImportRun`

For now, if you create imports without an explicit SaaS project context, the backend automatically creates and reuses a **default workspace/project scope** so the current local flows keep working while explicit SaaS tenancy is being introduced.

## Quick manual test

1. Open `http://localhost:3000/imports`
2. Click `Load anomaly sample`
3. Click `Create import snapshot`
4. Verify these pages:

- `http://localhost:3000/anomalies`
- `http://localhost:3000/graph`
- `http://localhost:3000/subjects`
- `http://localhost:3000/resources`

Expected findings in the anomaly sample include:

- `CLUSTER_ADMIN_USAGE`
- `WILDCARD_PERMISSION`
- `BROKEN_ROLE_REF`
- `EMPTY_ROLE`
- `UNUSED_ROLE`

The anomaly cards can also link back into subject access and graph views when the finding includes a subject context.

## Direct cluster import

The application can now read RBAC resources directly from a Kubernetes cluster in read-only mode.

Current cluster import scope:

- `Namespace`
- `ServiceAccount`
- `Role`
- `ClusterRole`
- `RoleBinding`
- `ClusterRoleBinding`

How to use it:

1. Ensure your local kubeconfig points to the cluster you want to inspect.
2. Open `http://localhost:3000/imports`.
3. Use the **Direct cluster import** block.
4. Optionally provide:
   - a kubeconfig path (for example `~/.kube/config`)
   - a context name
5. Click **Import current cluster**.

The backend will fetch RBAC objects from the cluster and push them through the same normalization and anomaly pipeline as YAML imports.

## Local cluster testing with kind + Podman

If you want a disposable local Kubernetes cluster for RBAC tests without Docker, use `kind` with `Podman`.

### Prerequisites

You need these tools available locally:

- `kind`
- `kubectl`
- `podman`

Check them with:

```bash
kind version
kubectl version --client
podman version
```

The provided scripts export `KIND_EXPERIMENTAL_PROVIDER=podman` automatically.

Example flow:

```bash
npm run cluster:kind:create
npm run cluster:kind:use
```

Then apply a small RBAC sample:

```bash
npm run cluster:kind:seed
```

This seed creates a richer RBAC dataset with:

- namespace-scoped roles and rolebindings
- a broken role reference
- an empty role
- a `cluster-admin` binding
- a wildcard cluster role
- an RBAC-management cluster role that should trigger sensitive access findings

You can inspect what was seeded with:

```bash
kubectl get serviceaccounts -A
kubectl get roles -A
kubectl get rolebindings -A
kubectl get clusterroles | grep -E "cluster-admin|wildcard-reader|rbac-manager"
kubectl get clusterrolebindings | grep -E "demo-admin|qa-rbac-manager"
```

Recommended full test sequence:

```bash
npm run cluster:kind:create
npm run cluster:kind:use
npm run cluster:kind:seed
npm run start:db
npm run db:push
npm run dev
```

After that, go to `/imports` and run **Import current cluster**.

You should then be able to inspect:

- findings on `/anomalies`
- the subject graph on `/graph`
- subject access on `/subjects`
- resource access on `/resources`

Expected useful findings from the seeded cluster include at least some of the following:

- `CLUSTER_ADMIN_USAGE`
- `BROKEN_ROLE_REF`
- `EMPTY_ROLE`
- `WILDCARD_PERMISSION`
- `SENSITIVE_RESOURCE_FULL_ACCESS`
- `EXCESSIVE_PRIVILEGE`

When you are done with the local cluster:

```bash
npm run stop
npm run stop:db
npm run cluster:kind:delete
```

## Validation commands

Run from the repository root:

npm run build
npm run lint
npm run test
npm run test:backend
npm run db:status

## Docker Compose

Start Postgres, backend, and frontend:

docker compose up --build

The compose file is intentionally minimal for MVP scaffolding and runs workspace dev commands inside Node containers.

## Podman example for PostgreSQL

If Docker is unavailable, this project also works with Podman. Example:

podman run -d --name rbac-visualizer-postgres \
 -e POSTGRES_DB=rbac_visualizer \
 -e POSTGRES_USER=postgres \
 -e POSTGRES_PASSWORD=postgres \
 -p 5432:5432 \
 docker.io/library/postgres:16-alpine

Then set:

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rbac_visualizer?schema=public

and run:

npm run db:push

## Documentation

- Usage guide: `docs/USAGE.md`

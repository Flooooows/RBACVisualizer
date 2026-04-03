# Local staging runbook

This document describes a more production-like local verification flow for RBAC Visualizer.

## Purpose

Use this runbook when you want to verify the application in a clean local environment with:

- PostgreSQL running locally via Podman
- Prisma migrations applied through the migration system
- backend and frontend built successfully
- automated checks passing before manual review

## 1. Start the database

```bash
npm run start:db
```

## 2. Check migration state

```bash
npm run db:status
```

If this is a fresh local environment, apply migrations:

```bash
npm run db:migrate:deploy
```

If your local database was previously created with `db:push` and Prisma migration state is inconsistent, reset it once:

```bash
npm run db:reset
npm run db:migrate:deploy
```

## 3. Validate the codebase

```bash
npm run build
npm run lint
npm run test
```

## 4. Start the application in a staging-like way

Use built assets instead of the dev watcher:

```bash
npm run start
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/api/health`

## 5. Suggested manual checks

### Manifest import flow

1. Go to `/imports`
2. Confirm the project selector is set to the expected project
3. Load the anomaly sample
4. Create an import snapshot
5. Verify:
   - `/anomalies`
   - `/graph`
   - `/subjects`
   - `/resources`

### Cluster import flow

If you use a local kind cluster:

```bash
npm run cluster:kind:create
npm run cluster:kind:use
npm run cluster:kind:seed
```

Then in `/imports`:

1. Confirm the project selector is set to the expected project
2. Optionally set context `kind-rbac-visualizer`
3. Optionally save the cluster connection in that project
4. Click `Check cluster status`
5. Click `Import current cluster`

Verify that findings, graph, subject access, and resource access views all populate correctly.

You can also verify that the saved cluster connection appears again when you reload the Imports page for the same project.

## 6. Shutdown

```bash
npm run stop
npm run stop:db
```

If you created a local kind cluster just for testing:

```bash
npm run cluster:kind:delete
```

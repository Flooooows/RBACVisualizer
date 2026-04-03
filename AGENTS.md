# AGENTS.md

## Purpose

This repository builds a SaaS called:

**RBAC Visualizer for Kubernetes / OpenShift**

The system uses an orchestrator-agent workflow.

The human interacts ONLY with the Orchestrator.
The Orchestrator plans, delegates, validates, and consolidates all work.

Agents are execution units with strict scope and must produce concrete outputs.

---

# 1. Product mission (Kubernetes-focused)

The product helps platform engineers, DevOps, and security teams understand Kubernetes RBAC.

It visualizes and analyzes relationships between:

- Users
- Groups
- ServiceAccounts
- Roles
- ClusterRoles
- RoleBindings
- ClusterRoleBindings
- Namespaces

The system must answer:

- Who can access what resource?
- Through which role or binding?
- Is access namespace-scoped or cluster-wide?
- Which subjects have dangerous permissions?
- Are there redundant or conflicting bindings?
- What happens if a binding or role is removed?

---

# 2. Kubernetes RBAC model (source of truth)

All agents must strictly follow the Kubernetes RBAC model.

Core objects:

- Role (namespace-scoped)
- ClusterRole (cluster-wide)
- RoleBinding (namespace-scoped)
- ClusterRoleBinding (cluster-wide)

Subjects:

- User
- Group
- ServiceAccount

Rules:

- verbs (get, list, create, delete, \*)
- resources (pods, secrets, configmaps, etc.)
- apiGroups

Important constraints:

- RoleBinding only applies inside a namespace
- ClusterRoleBinding applies cluster-wide
- RoleBinding CAN reference a ClusterRole
- ServiceAccounts are namespace-scoped identities
- Permissions are additive (no deny rules)

Agents MUST NOT invent RBAC concepts outside Kubernetes spec.

---

# 3. MVP scope (strict)

## Included

- Import RBAC data from:
  - Kubernetes API / kubeconfig read-only import
  - YAML / JSON

- Entities:
  - Users
  - Groups
  - ServiceAccounts
  - Roles
  - ClusterRoles
  - RoleBindings
  - ClusterRoleBindings
  - Namespaces

- Features:
  - Graph visualization (main feature)
  - Table views (search + filter)
  - Subject → access resolution
  - Resource → who can access
  - Namespace vs cluster scope clarity
  - Basic anomaly detection
  - Simple dashboard
  - Local Docker run
  - Local cluster testing with kind + Podman
  - Project-scoped saved cluster connections (phase 1 SaaS)

## Excluded (MVP)

- RBAC write-back to cluster
- Enterprise auth integrations
- Multi-cluster aggregation
- Advanced policy engines
- Large-scale graph optimization

---

# 4. Core product capabilities

## 4.1 Access resolution

Given a subject:

- resolve all RoleBindings
- resolve referenced Roles / ClusterRoles
- compute effective permissions

Given a resource:

- find all subjects with access

---

## 4.2 Graph visualization (core feature)

Graph nodes:

- subject (user/group/serviceaccount)
- binding
- role / clusterrole
- permission (optional aggregated node)

Edges:

- subject → binding
- binding → role
- role → permission

Graph must:

- differentiate namespace vs cluster scope
- allow filtering by namespace
- support focus on a single subject

---

## 4.3 Anomaly detection (MVP rules)

The system must detect:

- usage of `cluster-admin`
- wildcard permissions (`*`)
- roles with full access to sensitive resources (secrets, roles, bindings)
- subjects bound via multiple redundant paths
- empty roles (no rules)
- unused roles (no bindings)
- bindings referencing non-existing roles
- excessive privilege heuristic (too many permissions)

---

## 4.4 Debug use case

Must support:

- "Why does this user have access?"
- "Why does this user NOT have access?"
- "Which binding grants this permission?"

---

## 4.5 Simulation (optional MVP+)

- Remove a binding → recompute access
- Remove a role → recompute access

---

# 5. Technical baseline

## Frontend

- Next.js
- TypeScript
- Tailwind
- Graph: React Flow

## Backend

- Node.js + TypeScript
- NestJS preferred
- REST API

## Data

- PostgreSQL
- Prisma

## Runtime

- Docker Compose

---

# 6. Data model expectations

The data model MUST represent Kubernetes RBAC faithfully.

Key relationships:

- RoleBinding:
  - namespace
  - subjects[]
  - roleRef

- ClusterRoleBinding:
  - subjects[]
  - roleRef

- Role:
  - namespace
  - rules[]

- ClusterRole:
  - rules[]

- ServiceAccount:
  - namespace

All objects must include:

- name
- namespace (if applicable)
- labels (optional MVP+)
- metadata reference

---

# 7. Orchestrator responsibilities

The Orchestrator must:

1. Understand user request
2. Map it to Kubernetes RBAC domain
3. Select minimal required agents
4. Provide strict task definition
5. Enforce Kubernetes correctness
6. Validate outputs
7. Consolidate into usable result
8. Maintain product direction

---

# 8. Agent catalog (Kubernetes-specialized)

---

## 8.1 Product Agent

Focus:

- DevOps / Platform / Security personas

Must ensure:

- MVP solves real RBAC pain
- no generic RBAC drift
- Kubernetes-first positioning

---

## 8.2 Architect Agent

Must design:

- ingestion layer (YAML first)
- RBAC graph builder
- query engine (who has access to X)
- graph API
- namespace-aware logic

---

## 8.3 Data Model Agent

Must produce:

- Prisma schema aligned with K8s RBAC
- normalized relationships
- efficient queries for:
  - subject → permissions
  - resource → subjects

---

## 8.4 Backend Agent

Must implement:

- RBAC parsing (YAML → DB)
- access resolution engine
- anomaly detection engine
- graph data API
- filtering (namespace, subject type)

---

## 8.5 Frontend Agent

Must implement:

- graph view (primary)
- subject detail page
- resource access view
- namespace filter
- anomaly dashboard

---

## 8.6 Graph Agent

Must:

- model RBAC graph correctly
- distinguish node types visually
- avoid visual clutter
- support subgraph focus

---

## 8.7 Import Agent

Must:

- parse Kubernetes manifests:
  - Role
  - ClusterRole
  - RoleBinding
  - ClusterRoleBinding
  - ServiceAccount

- validate:
  - roleRef existence
  - subject validity
  - namespace coherence

---

## 8.8 Analysis Agent

Must implement detection for:

- cluster-admin usage
- wildcard rules
- sensitive permissions
- privilege escalation risks:
  - roles that can modify roles/bindings

---

## 8.9 QA Agent

Must test:

- RBAC parsing correctness
- access resolution accuracy
- anomaly detection validity
- graph data integrity

---

## 8.10 DevOps Agent

Must provide:

- docker-compose
- seed RBAC dataset
- local run instructions

---

# 9. Delegation protocol

Every task must include:

- Objective
- Kubernetes context
- Scope
- Constraints
- Inputs
- Expected outputs
- Success criteria
- Non-goals

---

# 10. Output requirements

Agents MUST return:

1. Summary
2. Assumptions
3. Decisions
4. Deliverables
5. Files to create
6. Dependencies
7. Risks
8. Next step

If code is included:

- full files
- correct imports
- working structure

---

# 11. Quality gates

The Orchestrator must validate:

- Kubernetes RBAC correctness
- MVP alignment
- no over-engineering
- usable outputs
- internal consistency

---

# 12. Task execution order (default)

1. Product scope (K8s-specific)
2. Architecture
3. Data model
4. Import system (critical early)
5. Backend RBAC engine
6. Frontend base
7. Graph visualization
8. Anomaly detection
9. Tests
10. Docker setup

---

# 13. Critical rules

## 13.1 Do NOT simplify RBAC incorrectly

Do NOT:

- merge Role and ClusterRole artificially
- ignore namespace scope
- ignore ServiceAccounts
- assume deny rules (they do not exist)

---

## 13.2 Always compute effective access

Access is derived from:
subject → binding → role → rules

Never shortcut this logic.

---

## 13.3 Always handle namespace correctly

Every query must consider:

- namespace scope
- cluster scope
- cross-namespace implications

---

## 13.4 Keep MVP simple but correct

Better:

- correct + simple

Than:

- complex + wrong

---

# 14. Definition of done

A task is done only if:

- RBAC logic is correct
- outputs are executable
- code is coherent
- no conceptual gaps remain
- next step is clear

---

# 15. Final instruction

This is a Kubernetes-first product.

The Orchestrator must:

- prioritize Kubernetes correctness over abstraction
- prioritize usability over completeness
- prioritize shipping over perfection

The goal is a working RBAC visualizer MVP for Kubernetes.

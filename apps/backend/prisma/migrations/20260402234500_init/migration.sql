-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('YAML', 'JSON');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('RECEIVED', 'PARSING', 'VALIDATING', 'NORMALIZING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');

-- CreateEnum
CREATE TYPE "SubjectKind" AS ENUM ('USER', 'GROUP', 'SERVICE_ACCOUNT');

-- CreateEnum
CREATE TYPE "SubjectOrigin" AS ENUM ('BINDING', 'MANIFEST', 'BOTH');

-- CreateEnum
CREATE TYPE "RoleRefKind" AS ENUM ('ROLE', 'CLUSTER_ROLE');

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('CLUSTER_ADMIN_USAGE', 'WILDCARD_PERMISSION', 'SENSITIVE_RESOURCE_FULL_ACCESS', 'REDUNDANT_BINDING_PATH', 'EMPTY_ROLE', 'UNUSED_ROLE', 'BROKEN_ROLE_REF', 'EXCESSIVE_PRIVILEGE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ImportSnapshot" (
    "id" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "sourceLabel" TEXT,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'RECEIVED',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "checksum" TEXT,

    CONSTRAINT "ImportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawManifest" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "namespace" TEXT,
    "name" TEXT NOT NULL,
    "uid" TEXT,
    "labels" JSONB,
    "annotations" JSONB,
    "documentOrder" INTEGER,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Namespace" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "annotations" JSONB,

    CONSTRAINT "Namespace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "kind" "SubjectKind" NOT NULL,
    "name" TEXT NOT NULL,
    "namespace" TEXT,
    "origin" "SubjectOrigin" NOT NULL DEFAULT 'BINDING',

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "annotations" JSONB,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleRule" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "ruleOrder" INTEGER NOT NULL,
    "apiGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verbs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourceNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nonResourceURLs" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "RoleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterRole" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "annotations" JSONB,
    "aggregationRule" JSONB,

    CONSTRAINT "ClusterRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterRoleRule" (
    "id" TEXT NOT NULL,
    "clusterRoleId" TEXT NOT NULL,
    "ruleOrder" INTEGER NOT NULL,
    "apiGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verbs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourceNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nonResourceURLs" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ClusterRoleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBinding" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "annotations" JSONB,
    "roleRefKind" "RoleRefKind" NOT NULL,
    "roleRefApiGroup" TEXT NOT NULL DEFAULT 'rbac.authorization.k8s.io',
    "roleRefName" TEXT NOT NULL,
    "roleRefRoleId" TEXT,
    "roleRefClusterRoleId" TEXT,
    "isRoleRefResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoleBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBindingSubject" (
    "id" TEXT NOT NULL,
    "roleBindingId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "RoleBindingSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterRoleBinding" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "annotations" JSONB,
    "roleRefApiGroup" TEXT NOT NULL DEFAULT 'rbac.authorization.k8s.io',
    "roleRefName" TEXT NOT NULL,
    "roleRefClusterRoleId" TEXT,
    "isRoleRefResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClusterRoleBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterRoleBindingSubject" (
    "id" TEXT NOT NULL,
    "clusterRoleBindingId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "ClusterRoleBindingSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisFinding" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "type" "FindingType" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjectId" TEXT,
    "roleId" TEXT,
    "clusterRoleId" TEXT,
    "roleBindingId" TEXT,
    "clusterRoleBindingId" TEXT,

    CONSTRAINT "AnalysisFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportSnapshot_importedAt_idx" ON "ImportSnapshot"("importedAt");

-- CreateIndex
CREATE INDEX "RawManifest_snapshotId_kind_idx" ON "RawManifest"("snapshotId", "kind");

-- CreateIndex
CREATE INDEX "RawManifest_snapshotId_namespace_idx" ON "RawManifest"("snapshotId", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "RawManifest_snapshotId_kind_namespace_name_key" ON "RawManifest"("snapshotId", "kind", "namespace", "name");

-- CreateIndex
CREATE INDEX "Namespace_snapshotId_idx" ON "Namespace"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "Namespace_snapshotId_name_key" ON "Namespace"("snapshotId", "name");

-- CreateIndex
CREATE INDEX "Subject_snapshotId_kind_name_idx" ON "Subject"("snapshotId", "kind", "name");

-- CreateIndex
CREATE INDEX "Subject_snapshotId_namespace_idx" ON "Subject"("snapshotId", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_snapshotId_kind_name_namespace_key" ON "Subject"("snapshotId", "kind", "name", "namespace");

-- CreateIndex
CREATE INDEX "Role_snapshotId_namespace_idx" ON "Role"("snapshotId", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "Role_snapshotId_namespace_name_key" ON "Role"("snapshotId", "namespace", "name");

-- CreateIndex
CREATE INDEX "RoleRule_roleId_idx" ON "RoleRule"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleRule_roleId_ruleOrder_key" ON "RoleRule"("roleId", "ruleOrder");

-- CreateIndex
CREATE INDEX "ClusterRole_snapshotId_idx" ON "ClusterRole"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "ClusterRole_snapshotId_name_key" ON "ClusterRole"("snapshotId", "name");

-- CreateIndex
CREATE INDEX "ClusterRoleRule_clusterRoleId_idx" ON "ClusterRoleRule"("clusterRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "ClusterRoleRule_clusterRoleId_ruleOrder_key" ON "ClusterRoleRule"("clusterRoleId", "ruleOrder");

-- CreateIndex
CREATE INDEX "RoleBinding_snapshotId_namespace_idx" ON "RoleBinding"("snapshotId", "namespace");

-- CreateIndex
CREATE INDEX "RoleBinding_snapshotId_roleRefKind_roleRefName_idx" ON "RoleBinding"("snapshotId", "roleRefKind", "roleRefName");

-- CreateIndex
CREATE INDEX "RoleBinding_roleRefRoleId_idx" ON "RoleBinding"("roleRefRoleId");

-- CreateIndex
CREATE INDEX "RoleBinding_roleRefClusterRoleId_idx" ON "RoleBinding"("roleRefClusterRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBinding_snapshotId_namespace_name_key" ON "RoleBinding"("snapshotId", "namespace", "name");

-- CreateIndex
CREATE INDEX "RoleBindingSubject_subjectId_idx" ON "RoleBindingSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBindingSubject_roleBindingId_subjectId_key" ON "RoleBindingSubject"("roleBindingId", "subjectId");

-- CreateIndex
CREATE INDEX "ClusterRoleBinding_snapshotId_roleRefName_idx" ON "ClusterRoleBinding"("snapshotId", "roleRefName");

-- CreateIndex
CREATE INDEX "ClusterRoleBinding_roleRefClusterRoleId_idx" ON "ClusterRoleBinding"("roleRefClusterRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "ClusterRoleBinding_snapshotId_name_key" ON "ClusterRoleBinding"("snapshotId", "name");

-- CreateIndex
CREATE INDEX "ClusterRoleBindingSubject_subjectId_idx" ON "ClusterRoleBindingSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClusterRoleBindingSubject_clusterRoleBindingId_subjectId_key" ON "ClusterRoleBindingSubject"("clusterRoleBindingId", "subjectId");

-- CreateIndex
CREATE INDEX "AnalysisFinding_snapshotId_type_severity_idx" ON "AnalysisFinding"("snapshotId", "type", "severity");

-- CreateIndex
CREATE INDEX "AnalysisFinding_subjectId_idx" ON "AnalysisFinding"("subjectId");

-- AddForeignKey
ALTER TABLE "RawManifest" ADD CONSTRAINT "RawManifest_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Namespace" ADD CONSTRAINT "Namespace_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_snapshotId_namespace_fkey" FOREIGN KEY ("snapshotId", "namespace") REFERENCES "Namespace"("snapshotId", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRule" ADD CONSTRAINT "RoleRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRole" ADD CONSTRAINT "ClusterRole_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRoleRule" ADD CONSTRAINT "ClusterRoleRule_clusterRoleId_fkey" FOREIGN KEY ("clusterRoleId") REFERENCES "ClusterRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBinding" ADD CONSTRAINT "RoleBinding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBinding" ADD CONSTRAINT "RoleBinding_snapshotId_namespace_fkey" FOREIGN KEY ("snapshotId", "namespace") REFERENCES "Namespace"("snapshotId", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBinding" ADD CONSTRAINT "RoleBinding_roleRefRoleId_fkey" FOREIGN KEY ("roleRefRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBinding" ADD CONSTRAINT "RoleBinding_roleRefClusterRoleId_fkey" FOREIGN KEY ("roleRefClusterRoleId") REFERENCES "ClusterRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBindingSubject" ADD CONSTRAINT "RoleBindingSubject_roleBindingId_fkey" FOREIGN KEY ("roleBindingId") REFERENCES "RoleBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBindingSubject" ADD CONSTRAINT "RoleBindingSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRoleBinding" ADD CONSTRAINT "ClusterRoleBinding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRoleBinding" ADD CONSTRAINT "ClusterRoleBinding_roleRefClusterRoleId_fkey" FOREIGN KEY ("roleRefClusterRoleId") REFERENCES "ClusterRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRoleBindingSubject" ADD CONSTRAINT "ClusterRoleBindingSubject_clusterRoleBindingId_fkey" FOREIGN KEY ("clusterRoleBindingId") REFERENCES "ClusterRoleBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRoleBindingSubject" ADD CONSTRAINT "ClusterRoleBindingSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ImportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_clusterRoleId_fkey" FOREIGN KEY ("clusterRoleId") REFERENCES "ClusterRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_roleBindingId_fkey" FOREIGN KEY ("roleBindingId") REFERENCES "RoleBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_clusterRoleBindingId_fkey" FOREIGN KEY ("clusterRoleBindingId") REFERENCES "ClusterRoleBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;


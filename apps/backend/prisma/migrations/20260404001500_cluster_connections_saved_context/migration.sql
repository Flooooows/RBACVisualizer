-- AlterTable
ALTER TABLE "ClusterConnection"
ADD COLUMN     "contextName" TEXT,
ADD COLUMN     "kubeconfigPath" TEXT;

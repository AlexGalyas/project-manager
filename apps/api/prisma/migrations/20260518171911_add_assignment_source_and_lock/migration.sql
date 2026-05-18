-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'OPTIMIZER');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "lockedByManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Assignment_lockedByManager_idx" ON "Assignment"("lockedByManager");

-- CreateIndex
CREATE INDEX "Assignment_source_idx" ON "Assignment"("source");

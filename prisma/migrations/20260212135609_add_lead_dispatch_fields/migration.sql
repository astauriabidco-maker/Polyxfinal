-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "LeadStatus" ADD VALUE 'ATTEMPTED';
ALTER TYPE "LeadStatus" ADD VALUE 'RDV_SCHEDULED';
ALTER TYPE "LeadStatus" ADD VALUE 'NOT_ELIGIBLE';
ALTER TYPE "LeadStatus" ADD VALUE 'NURTURING';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "dateRdv" TIMESTAMP(3),
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_siteId_idx" ON "Lead"("siteId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

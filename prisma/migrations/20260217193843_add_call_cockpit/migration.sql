/*
  Warnings:

  - The values [CONTACTED,QUALIFIED,NEGOTIATION,CONVERTED,LOST,ARCHIVED,ATTEMPTED,RDV_SCHEDULED,NOT_ELIGIBLE,NURTURING] on the enum `LeadStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('INTERESSE', 'A_RAPPELER', 'NRP', 'PAS_INTERESSE');

-- AlterEnum
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('NEW', 'DISPATCHED', 'A_RAPPELER', 'NE_REPONDS_PAS', 'PAS_INTERESSE', 'RDV_PLANIFIE', 'RDV_NON_HONORE', 'COURRIERS_ENVOYES', 'COURRIERS_RECUS', 'NEGOCIATION', 'CONVERTI', 'PROBLEMES_SAV', 'PERDU');
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "LeadStatus_old";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "nextCallDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NetworkSettings" ADD COLUMN     "doubinDelayDays" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ZoneMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoneMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrequalScript" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrequalScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "duration" INTEGER,
    "notes" TEXT,
    "questionsAsked" JSONB,
    "nextCallDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZoneMapping_organizationId_isActive_idx" ON "ZoneMapping"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneMapping_organizationId_prefix_key" ON "ZoneMapping"("organizationId", "prefix");

-- CreateIndex
CREATE INDEX "PrequalScript_organizationId_idx" ON "PrequalScript"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PrequalScript_organizationId_ordre_key" ON "PrequalScript"("organizationId", "ordre");

-- CreateIndex
CREATE INDEX "CallLog_leadId_idx" ON "CallLog"("leadId");

-- CreateIndex
CREATE INDEX "CallLog_callerId_idx" ON "CallLog"("callerId");

-- CreateIndex
CREATE INDEX "CallLog_outcome_idx" ON "CallLog"("outcome");

-- CreateIndex
CREATE INDEX "CallLog_createdAt_idx" ON "CallLog"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneMapping" ADD CONSTRAINT "ZoneMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneMapping" ADD CONSTRAINT "ZoneMapping_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrequalScript" ADD CONSTRAINT "PrequalScript_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

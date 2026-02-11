/*
  Warnings:

  - You are about to drop the column `signatureInfo` on the `Preuve` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[apiKeyHash]` on the table `Partner` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `CandidateActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LeadConsent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Preuve` table without a default value. This is not possible if the table is not empty.
  - Made the column `genereParId` on table `Preuve` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('CONTRACT', 'DPA', 'CGV');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NiveauAction" ADD VALUE 'CREATION';
ALTER TYPE "NiveauAction" ADD VALUE 'SUPPRESSION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PhaseStatus" ADD VALUE 'ADMIS';
ALTER TYPE "PhaseStatus" ADD VALUE 'CONTRACTUALISE';
ALTER TYPE "PhaseStatus" ADD VALUE 'EN_COURS';
ALTER TYPE "PhaseStatus" ADD VALUE 'TERMINE';
ALTER TYPE "PhaseStatus" ADD VALUE 'FACTURE';

-- AlterTable
ALTER TABLE "CandidateActivity" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FranchiseCandidate" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "dateReponse" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LeadConsent" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "bic" TEXT,
ADD COLUMN     "capitalSocial" DECIMAL(12,2),
ADD COLUMN     "codeNAF" TEXT,
ADD COLUMN     "codePostal" TEXT,
ADD COLUMN     "commissionRate" DECIMAL(5,2),
ADD COLUMN     "complementAdresse" TEXT,
ADD COLUMN     "costPerLead" DECIMAL(8,2),
ADD COLUMN     "formeJuridique" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "ipWhitelist" TEXT[],
ADD COLUMN     "ndaSignedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pays" TEXT NOT NULL DEFAULT 'France',
ADD COLUMN     "rcs" TEXT,
ADD COLUMN     "representantFonction" TEXT,
ADD COLUMN     "representantNom" TEXT,
ADD COLUMN     "siren" TEXT,
ADD COLUMN     "tvaIntracom" TEXT,
ADD COLUMN     "ville" TEXT,
ADD COLUMN     "webhookUrl" TEXT,
ALTER COLUMN "apiKeyHash" DROP NOT NULL,
ALTER COLUMN "apiKeyPrefix" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Preuve" DROP COLUMN "signatureInfo",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "signatureId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "genereParId" SET NOT NULL;

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sections" JSONB NOT NULL,
    "variables" JSONB,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAuditLog" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "performedByName" TEXT,
    "details" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerQualification" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conventionSignedAt" TIMESTAMP(3),
    "conventionUrl" TEXT,
    "conventionExpiresAt" TIMESTAMP(3),
    "conventionType" TEXT NOT NULL DEFAULT 'PROSPECTION',
    "hasKbis" BOOLEAN NOT NULL DEFAULT false,
    "hasRcPro" BOOLEAN NOT NULL DEFAULT false,
    "hasUrssaf" BOOLEAN NOT NULL DEFAULT false,
    "hasReferences" BOOLEAN NOT NULL DEFAULT false,
    "hasCertifications" BOOLEAN NOT NULL DEFAULT false,
    "hasQualityCharter" BOOLEAN NOT NULL DEFAULT false,
    "certificationDetails" TEXT,
    "referencesDetails" TEXT,
    "rcProPolicyNumber" TEXT,
    "rcProExpiresAt" TIMESTAMP(3),
    "urssafDate" TIMESTAMP(3),
    "kbisDate" TIMESTAMP(3),
    "qualificationScore" INTEGER NOT NULL DEFAULT 0,
    "qualificationGrade" TEXT NOT NULL DEFAULT 'D',
    "isQualified" BOOLEAN NOT NULL DEFAULT false,
    "lastEvaluationAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "evaluatedBy" TEXT,
    "evaluationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerQualification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplate_organizationId_type_isActive_idx" ON "DocumentTemplate"("organizationId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_organizationId_type_version_key" ON "DocumentTemplate"("organizationId", "type", "version");

-- CreateIndex
CREATE INDEX "PartnerAuditLog_partnerId_idx" ON "PartnerAuditLog"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerAuditLog_organizationId_idx" ON "PartnerAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "PartnerAuditLog_action_idx" ON "PartnerAuditLog"("action");

-- CreateIndex
CREATE INDEX "PartnerAuditLog_createdAt_idx" ON "PartnerAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerQualification_partnerId_key" ON "PartnerQualification"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerQualification_organizationId_idx" ON "PartnerQualification"("organizationId");

-- CreateIndex
CREATE INDEX "PartnerQualification_isQualified_idx" ON "PartnerQualification"("isQualified");

-- CreateIndex
CREATE INDEX "PartnerQualification_qualificationGrade_idx" ON "PartnerQualification"("qualificationGrade");

-- CreateIndex
CREATE INDEX "PartnerQualification_nextReviewAt_idx" ON "PartnerQualification"("nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_apiKeyHash_key" ON "Partner"("apiKeyHash");

-- CreateIndex
CREATE INDEX "Partner_siret_idx" ON "Partner"("siret");

-- AddForeignKey
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_genereParId_fkey" FOREIGN KEY ("genereParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseCandidate" ADD CONSTRAINT "FranchiseCandidate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAuditLog" ADD CONSTRAINT "PartnerAuditLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerQualification" ADD CONSTRAINT "PartnerQualification_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `name` on the `FranchiseCandidate` table. All the data in the column will be lost.
  - Added the required column `companyName` to the `FranchiseCandidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `franchiseType` to the `FranchiseCandidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `representantNom` to the `FranchiseCandidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `representantPrenom` to the `FranchiseCandidate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK_ADS', 'TIKTOK_ADS', 'GOOGLE_ADS', 'LINKEDIN_ADS', 'WEBSITE_FORM', 'PARTNER_API', 'MANUAL', 'CAMPAIGN', 'REFERRAL', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CONVERTED', 'LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "FranchiseType" AS ENUM ('OF', 'CFA');

-- CreateEnum
CREATE TYPE "CandidateActivityType" AS ENUM ('STATUS_CHANGE', 'QUALIFICATION_SCORE', 'EMAIL_SENT', 'NOTE_ADDED', 'DOCUMENT_UPLOADED', 'SYSTEM_ALERT', 'DOSSIER_UPDATE', 'OTHER');

-- AlterTable
ALTER TABLE "FranchiseCandidate" DROP COLUMN "name",
ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "companyName" TEXT NOT NULL,
ADD COLUMN     "experienceScore" INTEGER,
ADD COLUMN     "financialScore" INTEGER,
ADD COLUMN     "franchiseType" "FranchiseType" NOT NULL,
ADD COLUMN     "geoScore" INTEGER,
ADD COLUMN     "leadSource" "LeadSource" NOT NULL DEFAULT 'WEBSITE_FORM',
ADD COLUMN     "motivationIndex" INTEGER,
ADD COLUMN     "qualificationAnswers" JSONB,
ADD COLUMN     "qualificationScore" INTEGER,
ADD COLUMN     "qualifiedAt" TIMESTAMP(3),
ADD COLUMN     "representantFonction" TEXT,
ADD COLUMN     "representantNom" TEXT NOT NULL,
ADD COLUMN     "representantPrenom" TEXT NOT NULL,
ADD COLUMN     "siret" TEXT,
ADD COLUMN     "structureScore" INTEGER,
ADD COLUMN     "timingScore" INTEGER,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT;

-- CreateTable
CREATE TABLE "NetworkSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "onboardingEmailSubject" TEXT NOT NULL DEFAULT 'Signature de vos contrats de partenariat - Polyx ERP',
    "onboardingEmailBody" TEXT NOT NULL,
    "activationEmailSubject" TEXT NOT NULL DEFAULT 'Activation de votre accès API - Polyx ERP',
    "activationEmailBody" TEXT NOT NULL,
    "apiDocumentationMarkdown" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateActivity" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "CandidateActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "sourceRef" TEXT,
    "campaignId" TEXT,
    "partnerId" TEXT,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "formationSouhaitee" TEXT,
    "message" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "metadata" JSONB,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "score" INTEGER,
    "notes" TEXT,
    "assignedToId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedDossierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "externalId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "budget" DECIMAL(10,2),
    "spent" DECIMAL(10,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "siret" TEXT,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "contractUrl" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "contractExpiresAt" TIMESTAMP(3),
    "dpaSignedAt" TIMESTAMP(3),
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "totalLeadsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "totalLeadsConverted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadConsent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentText" TEXT NOT NULL,
    "consentMethod" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkSettings_organizationId_key" ON "NetworkSettings"("organizationId");

-- CreateIndex
CREATE INDEX "CandidateActivity_candidateId_idx" ON "CandidateActivity"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateActivity_type_idx" ON "CandidateActivity"("type");

-- CreateIndex
CREATE INDEX "CandidateActivity_createdAt_idx" ON "CandidateActivity"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Lead_partnerId_idx" ON "Lead"("partnerId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_organizationId_idx" ON "Campaign"("organizationId");

-- CreateIndex
CREATE INDEX "Campaign_source_idx" ON "Campaign"("source");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "Campaign"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_organizationId_externalId_key" ON "Campaign"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "Partner_organizationId_idx" ON "Partner"("organizationId");

-- CreateIndex
CREATE INDEX "Partner_apiKeyHash_idx" ON "Partner"("apiKeyHash");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadConsent_leadId_key" ON "LeadConsent"("leadId");

-- CreateIndex
CREATE INDEX "LeadConsent_leadId_idx" ON "LeadConsent"("leadId");

-- CreateIndex
CREATE INDEX "LeadConsent_consentGiven_idx" ON "LeadConsent"("consentGiven");

-- CreateIndex
CREATE INDEX "FranchiseCandidate_franchiseType_idx" ON "FranchiseCandidate"("franchiseType");

-- CreateIndex
CREATE INDEX "FranchiseCandidate_leadSource_idx" ON "FranchiseCandidate"("leadSource");

-- CreateIndex
CREATE INDEX "FranchiseCandidate_qualificationScore_idx" ON "FranchiseCandidate"("qualificationScore");

-- AddForeignKey
ALTER TABLE "NetworkSettings" ADD CONSTRAINT "NetworkSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateActivity" ADD CONSTRAINT "CandidateActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FranchiseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadConsent" ADD CONSTRAINT "LeadConsent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `organizationId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `siteId` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MembershipScope" AS ENUM ('GLOBAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "NetworkType" AS ENUM ('HEAD_OFFICE', 'FRANCHISE', 'SUCCURSALE');

-- CreateEnum
CREATE TYPE "DossierSource" AS ENUM ('ORGANIC', 'NETWORK_DISPATCH');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'CONTACTED', 'DIP_SENT', 'DIP_SIGNED', 'CONTRACT_SENT', 'SIGNED', 'REJECTED', 'WITHDRAWN');

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_siteId_fkey";

-- DropIndex
DROP INDEX "User_organizationId_idx";

-- DropIndex
DROP INDEX "User_role_idx";

-- DropIndex
DROP INDEX "User_siteId_idx";

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "dispatchedFromId" TEXT,
ADD COLUMN     "originalLeadDate" TIMESTAMP(3),
ADD COLUMN     "source" "DossierSource" NOT NULL DEFAULT 'ORGANIC',
ADD COLUMN     "stagiaireCp" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "cachetUrl" TEXT,
ADD COLUMN     "cgvUrl" TEXT,
ADD COLUMN     "leadFeeRate" DOUBLE PRECISION,
ADD COLUMN     "livretAccueilUrl" TEXT,
ADD COLUMN     "networkType" "NetworkType",
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "reglementInterieurUrl" TEXT,
ADD COLUMN     "responsableName" TEXT,
ADD COLUMN     "royaltyRate" DOUBLE PRECISION,
ADD COLUMN     "signatureUrl" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "organizationId",
DROP COLUMN "role",
DROP COLUMN "siteId";

-- CreateTable
CREATE TABLE "Membership" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FORMAT',
    "scope" "MembershipScope" NOT NULL DEFAULT 'GLOBAL',
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "MembershipSiteAccess" (
    "membershipUserId" TEXT NOT NULL,
    "membershipOrgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "MembershipSiteAccess_pkey" PRIMARY KEY ("membershipUserId","membershipOrgId","siteId")
);

-- CreateTable
CREATE TABLE "FranchiseCandidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NEW',
    "targetZone" TEXT,
    "targetZipCodes" TEXT[],
    "investmentBudget" DECIMAL(12,2),
    "dipSentAt" TIMESTAMP(3),
    "dipSignedAt" TIMESTAMP(3),
    "contractSignedAt" TIMESTAMP(3),
    "createdOrgId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zipCodes" TEXT[],
    "isExclusive" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "MembershipSiteAccess_siteId_idx" ON "MembershipSiteAccess"("siteId");

-- CreateIndex
CREATE INDEX "FranchiseCandidate_organizationId_idx" ON "FranchiseCandidate"("organizationId");

-- CreateIndex
CREATE INDEX "FranchiseCandidate_status_idx" ON "FranchiseCandidate"("status");

-- CreateIndex
CREATE INDEX "FranchiseCandidate_email_idx" ON "FranchiseCandidate"("email");

-- CreateIndex
CREATE INDEX "Territory_organizationId_idx" ON "Territory"("organizationId");

-- CreateIndex
CREATE INDEX "Territory_isActive_idx" ON "Territory"("isActive");

-- CreateIndex
CREATE INDEX "Dossier_source_idx" ON "Dossier"("source");

-- CreateIndex
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");

-- CreateIndex
CREATE INDEX "Organization_networkType_idx" ON "Organization"("networkType");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipSiteAccess" ADD CONSTRAINT "MembershipSiteAccess_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipSiteAccess" ADD CONSTRAINT "MembershipSiteAccess_membershipUserId_membershipOrgId_fkey" FOREIGN KEY ("membershipUserId", "membershipOrgId") REFERENCES "Membership"("userId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseCandidate" ADD CONSTRAINT "FranchiseCandidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,code]` on the table `Certification` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,reference]` on the table `Programme` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,reference]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Certification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Dossier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Financeur` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Preuve` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Programme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Reclamation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('OF_STANDARD', 'CFA', 'BILAN', 'VAE');

-- DropIndex
DROP INDEX "Certification_code_idx";

-- DropIndex
DROP INDEX "Certification_code_key";

-- DropIndex
DROP INDEX "Programme_reference_idx";

-- DropIndex
DROP INDEX "Programme_reference_key";

-- DropIndex
DROP INDEX "Session_reference_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "tutorName" TEXT;

-- AlterTable
ALTER TABLE "Financeur" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Preuve" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Reclamation" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'OF_STANDARD',
    "ndaNumber" TEXT,
    "qualiopiCertified" BOOLEAN NOT NULL DEFAULT false,
    "qualiopiExpiry" TIMESTAMP(3),
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "contactNom" TEXT,
    "contactEmail" TEXT,
    "contactTelephone" TEXT,
    "adresse" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_siret_key" ON "Organization"("siret");

-- CreateIndex
CREATE INDEX "Organization_siret_idx" ON "Organization"("siret");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE INDEX "Organization_isActive_idx" ON "Organization"("isActive");

-- CreateIndex
CREATE INDEX "Company_organizationId_idx" ON "Company"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_siret_key" ON "Company"("organizationId", "siret");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "Certification_organizationId_idx" ON "Certification"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_organizationId_code_key" ON "Certification"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Dossier_organizationId_idx" ON "Dossier"("organizationId");

-- CreateIndex
CREATE INDEX "Dossier_companyId_idx" ON "Dossier"("companyId");

-- CreateIndex
CREATE INDEX "Financeur_organizationId_idx" ON "Financeur"("organizationId");

-- CreateIndex
CREATE INDEX "Preuve_organizationId_idx" ON "Preuve"("organizationId");

-- CreateIndex
CREATE INDEX "Programme_organizationId_idx" ON "Programme"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_organizationId_reference_key" ON "Programme"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "Reclamation_organizationId_idx" ON "Reclamation"("organizationId");

-- CreateIndex
CREATE INDEX "Session_organizationId_idx" ON "Session"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_organizationId_reference_key" ON "Session"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financeur" ADD CONSTRAINT "Financeur_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

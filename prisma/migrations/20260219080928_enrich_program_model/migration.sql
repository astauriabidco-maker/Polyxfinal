/*
  Warnings:

  - The values [FOAD,MIXTE] on the enum `Modalite` will be removed. If these variants are still used in the database, this will fail.
  - The `objectifs` column on the `Programme` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `contenu` column on the `Programme` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Modalite_new" AS ENUM ('PRESENTIEL', 'DISTANCIEL', 'BLENDED', 'AFEST');
ALTER TABLE "Programme" ALTER COLUMN "modalite" DROP DEFAULT;
ALTER TABLE "Programme" ALTER COLUMN "modalite" TYPE "Modalite_new" USING ("modalite"::text::"Modalite_new");
ALTER TYPE "Modalite" RENAME TO "Modalite_old";
ALTER TYPE "Modalite_new" RENAME TO "Modalite";
DROP TYPE "Modalite_old";
ALTER TABLE "Programme" ALTER COLUMN "modalite" SET DEFAULT 'PRESENTIEL';
COMMIT;

-- AlterTable
ALTER TABLE "MessagingConfig" ADD COLUMN     "enabledHooks" JSONB;

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "dureeJours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalTemplateId" TEXT,
ADD COLUMN     "publicCible" TEXT,
ADD COLUMN     "tarifInter" DOUBLE PRECISION,
ADD COLUMN     "tarifIntra" DOUBLE PRECISION,
DROP COLUMN "objectifs",
ADD COLUMN     "objectifs" TEXT[],
DROP COLUMN "contenu",
ADD COLUMN     "contenu" JSONB,
ALTER COLUMN "modalitesEval" DROP NOT NULL,
ALTER COLUMN "moyensPedago" DROP NOT NULL,
ALTER COLUMN "tarifHT" DROP NOT NULL,
ALTER COLUMN "tarifTTC" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InteractiveAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dossierId" TEXT,
    "actionType" TEXT NOT NULL,
    "actionData" JSONB,
    "replyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteractiveAction_organizationId_idx" ON "InteractiveAction"("organizationId");

-- CreateIndex
CREATE INDEX "InteractiveAction_dossierId_idx" ON "InteractiveAction"("dossierId");

-- CreateIndex
CREATE INDEX "InteractiveAction_phone_idx" ON "InteractiveAction"("phone");

-- CreateIndex
CREATE INDEX "InteractiveAction_actionType_idx" ON "InteractiveAction"("actionType");

-- CreateIndex
CREATE INDEX "Programme_isTemplate_idx" ON "Programme"("isTemplate");

-- CreateIndex
CREATE INDEX "Programme_originalTemplateId_idx" ON "Programme"("originalTemplateId");

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_originalTemplateId_fkey" FOREIGN KEY ("originalTemplateId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractiveAction" ADD CONSTRAINT "InteractiveAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractiveAction" ADD CONSTRAINT "InteractiveAction_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('CALL_OUTBOUND', 'CALL_INBOUND', 'CALL_NO_ANSWER', 'EMAIL_SENT', 'SMS_SENT', 'WHATSAPP_SENT', 'RDV_BOOKED', 'RDV_COMPLETED', 'RDV_CANCELLED', 'RDV_NO_SHOW', 'STATUS_CHANGE', 'RELANCE', 'NOTE_ADDED', 'DOCUMENT_SENT', 'DOCUMENT_RECEIVED', 'ASSIGNMENT_CHANGE', 'SCORE_UPDATE', 'SYSTEM_EVENT');

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'RDV_ANNULE';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "relanceCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");

-- CreateIndex
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "LeadActivity_type_idx" ON "LeadActivity"("type");

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AutomationEvent" AS ENUM ('INSCRIPTION_CONFIRMED', 'SESSION_J7', 'SESSION_J1', 'ABSENCE_DETECTED', 'MODULE_COMPLETED', 'SIGNATURE_MISSING', 'SESSION_J1_POST', 'DOSSIER_STATUS_CHANGE', 'LEAD_CREATED', 'LEAD_QUALIFIED');

-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED_BY_REPLY');

-- CreateTable
CREATE TABLE "MessageAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event" "AutomationEvent" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateKey" TEXT,
    "content" TEXT,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationId" TEXT,
    "sequenceEnrollmentId" TEXT,
    "phone" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateKey" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "leadId" TEXT,
    "dossierId" TEXT,
    "sentById" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" "AutomationEvent" NOT NULL,
    "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateKey" TEXT,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "leadId" TEXT,
    "dossierId" TEXT,
    "status" "SequenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextStepAt" TIMESTAMP(3),
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "stoppedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageAutomation_organizationId_idx" ON "MessageAutomation"("organizationId");

-- CreateIndex
CREATE INDEX "MessageAutomation_event_idx" ON "MessageAutomation"("event");

-- CreateIndex
CREATE INDEX "MessageAutomation_isActive_idx" ON "MessageAutomation"("isActive");

-- CreateIndex
CREATE INDEX "ScheduledMessage_organizationId_idx" ON "ScheduledMessage"("organizationId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_status_scheduledAt_idx" ON "ScheduledMessage"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledMessage_automationId_idx" ON "ScheduledMessage"("automationId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_sequenceEnrollmentId_idx" ON "ScheduledMessage"("sequenceEnrollmentId");

-- CreateIndex
CREATE INDEX "MessageSequence_organizationId_idx" ON "MessageSequence"("organizationId");

-- CreateIndex
CREATE INDEX "MessageSequence_triggerEvent_idx" ON "MessageSequence"("triggerEvent");

-- CreateIndex
CREATE INDEX "MessageSequence_isActive_idx" ON "MessageSequence"("isActive");

-- CreateIndex
CREATE INDEX "MessageSequenceStep_sequenceId_idx" ON "MessageSequenceStep"("sequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageSequenceStep_sequenceId_stepOrder_key" ON "MessageSequenceStep"("sequenceId", "stepOrder");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_sequenceId_idx" ON "SequenceEnrollment"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_organizationId_idx" ON "SequenceEnrollment"("organizationId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_status_nextStepAt_idx" ON "SequenceEnrollment"("status", "nextStepAt");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_phone_idx" ON "SequenceEnrollment"("phone");

-- AddForeignKey
ALTER TABLE "MessageAutomation" ADD CONSTRAINT "MessageAutomation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MessageAutomation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSequence" ADD CONSTRAINT "MessageSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSequenceStep" ADD CONSTRAINT "MessageSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "MessageSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "MessageSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

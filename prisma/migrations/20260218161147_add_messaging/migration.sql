-- CreateEnum
CREATE TYPE "MessagingProviderType" AS ENUM ('META_CLOUD', 'TWILIO');

-- CreateTable
CREATE TABLE "MessagingConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "MessagingProviderType" NOT NULL DEFAULT 'META_CLOUD',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "metaPhoneNumberId" TEXT,
    "metaBusinessId" TEXT,
    "metaAccessToken" TEXT,
    "twilioAccountSid" TEXT,
    "twilioAuthToken" TEXT,
    "twilioPhoneNumber" TEXT,
    "defaultCountryCode" TEXT NOT NULL DEFAULT '+33',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "messagingConfigId" TEXT NOT NULL,
    "internalKey" TEXT NOT NULL,
    "providerTemplateName" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "fallbackText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConfig_organizationId_key" ON "MessagingConfig"("organizationId");

-- CreateIndex
CREATE INDEX "MessagingConfig_organizationId_idx" ON "MessagingConfig"("organizationId");

-- CreateIndex
CREATE INDEX "MessageTemplate_messagingConfigId_idx" ON "MessageTemplate"("messagingConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_messagingConfigId_internalKey_key" ON "MessageTemplate"("messagingConfigId", "internalKey");

-- AddForeignKey
ALTER TABLE "MessagingConfig" ADD CONSTRAINT "MessagingConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_messagingConfigId_fkey" FOREIGN KEY ("messagingConfigId") REFERENCES "MessagingConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ChatbotResponseType" AS ENUM ('TEXT', 'INTERACTIVE_BUTTONS', 'INTERACTIVE_LIST', 'REDIRECT_HUMAN');

-- CreateTable
CREATE TABLE "ChatbotRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "pattern" TEXT,
    "responseType" "ChatbotResponseType" NOT NULL DEFAULT 'TEXT',
    "response" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isHumanHandoff" BOOLEAN NOT NULL DEFAULT false,
    "handoffAt" TIMESTAMP(3),
    "lastBotReplyAt" TIMESTAMP(3),
    "lastMenuSent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatbotRule_organizationId_isActive_idx" ON "ChatbotRule"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ChatbotRule_priority_idx" ON "ChatbotRule"("priority");

-- CreateIndex
CREATE INDEX "ChatbotConversation_organizationId_idx" ON "ChatbotConversation"("organizationId");

-- CreateIndex
CREATE INDEX "ChatbotConversation_phone_idx" ON "ChatbotConversation"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotConversation_organizationId_phone_key" ON "ChatbotConversation"("organizationId", "phone");

-- AddForeignKey
ALTER TABLE "ChatbotRule" ADD CONSTRAINT "ChatbotRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

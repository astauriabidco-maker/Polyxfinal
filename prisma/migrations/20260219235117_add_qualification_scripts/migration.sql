-- CreateEnum
CREATE TYPE "ScriptNodeType" AS ENUM ('YES_NO', 'CHOICE', 'OPEN_TEXT', 'RATING', 'INFO');

-- CreateEnum
CREATE TYPE "ScriptCategory" AS ENUM ('OF_STANDARD', 'CFA', 'B2B', 'B2C', 'CUSTOM');

-- CreateTable
CREATE TABLE "QualificationScript" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ScriptCategory" NOT NULL DEFAULT 'OF_STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rootNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptNode" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "ScriptNodeType" NOT NULL DEFAULT 'YES_NO',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "scoreWeight" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "yesNextNodeId" TEXT,
    "noNextNodeId" TEXT,
    "defaultNextId" TEXT,
    "actionTrigger" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptExecution" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "maxPossibleScore" INTEGER NOT NULL DEFAULT 0,
    "scorePercentage" DOUBLE PRECISION,
    "recommendation" TEXT,
    "recommendedAction" TEXT,

    CONSTRAINT "ScriptExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptResponse" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "scoreEarned" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualificationScript_organizationId_idx" ON "QualificationScript"("organizationId");

-- CreateIndex
CREATE INDEX "QualificationScript_category_idx" ON "QualificationScript"("category");

-- CreateIndex
CREATE INDEX "ScriptNode_scriptId_idx" ON "ScriptNode"("scriptId");

-- CreateIndex
CREATE INDEX "ScriptNode_scriptId_ordre_idx" ON "ScriptNode"("scriptId", "ordre");

-- CreateIndex
CREATE INDEX "ScriptExecution_leadId_idx" ON "ScriptExecution"("leadId");

-- CreateIndex
CREATE INDEX "ScriptExecution_scriptId_idx" ON "ScriptExecution"("scriptId");

-- CreateIndex
CREATE INDEX "ScriptExecution_userId_idx" ON "ScriptExecution"("userId");

-- CreateIndex
CREATE INDEX "ScriptResponse_executionId_idx" ON "ScriptResponse"("executionId");

-- CreateIndex
CREATE INDEX "ScriptResponse_nodeId_idx" ON "ScriptResponse"("nodeId");

-- AddForeignKey
ALTER TABLE "QualificationScript" ADD CONSTRAINT "QualificationScript_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptNode" ADD CONSTRAINT "ScriptNode_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "QualificationScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "QualificationScript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptResponse" ADD CONSTRAINT "ScriptResponse_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ScriptExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptResponse" ADD CONSTRAINT "ScriptResponse_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ScriptNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

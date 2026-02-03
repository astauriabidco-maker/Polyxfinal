-- Migration: Add Multi-Site (Campus) support
-- This migration is safe for existing data

-- Step 1: Create the Site table first
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "uaiCode" TEXT,
    "siretNic" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes on Site
CREATE INDEX "Site_organizationId_idx" ON "Site"("organizationId");
CREATE INDEX "Site_uaiCode_idx" ON "Site"("uaiCode");
CREATE INDEX "Site_isActive_idx" ON "Site"("isActive");
CREATE UNIQUE INDEX "Site_organizationId_name_key" ON "Site"("organizationId", "name");

-- Step 3: Add FK from Site to Organization
ALTER TABLE "Site" ADD CONSTRAINT "Site_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Create a default "Siège" site for each existing Organization
INSERT INTO "Site" ("id", "organizationId", "name", "isHeadquarters", "city", "zipCode", "createdAt", "updatedAt")
SELECT 
    'site_' || "id",
    "id",
    'Siège Principal',
    true,
    'Paris',
    '75001',
    NOW(),
    NOW()
FROM "Organization";

-- Step 5: Add siteId column to Session (nullable first)
ALTER TABLE "Session" ADD COLUMN "siteId" TEXT;

-- Step 6: Populate siteId in Session from organizationId
UPDATE "Session" SET "siteId" = 'site_' || "organizationId";

-- Step 7: Make siteId NOT NULL in Session
ALTER TABLE "Session" ALTER COLUMN "siteId" SET NOT NULL;

-- Step 8: Add siteId column to Dossier (nullable first)
ALTER TABLE "Dossier" ADD COLUMN "siteId" TEXT;

-- Step 9: Populate siteId in Dossier from organizationId
UPDATE "Dossier" SET "siteId" = 'site_' || "organizationId";

-- Step 10: Make siteId NOT NULL in Dossier
ALTER TABLE "Dossier" ALTER COLUMN "siteId" SET NOT NULL;

-- Step 11: Add optional siteId to User
ALTER TABLE "User" ADD COLUMN "siteId" TEXT;

-- Step 12: Create indexes
CREATE INDEX "Dossier_siteId_idx" ON "Dossier"("siteId");
CREATE INDEX "Session_siteId_idx" ON "Session"("siteId");
CREATE INDEX "User_siteId_idx" ON "User"("siteId");

-- Step 13: Add Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

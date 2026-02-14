-- 1. Drop Default Value on Membership.role to remove dependency on Enum
ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;

-- 2. Transform Enum Columns to Text to free up the "Role" type name
ALTER TABLE "AuditLog" ALTER COLUMN "userRole" TYPE TEXT USING "userRole"::text;
ALTER TABLE "Validation" ALTER COLUMN "roleValidateur" TYPE TEXT USING "roleValidateur"::text;
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

-- 3. Drop the conflicting Enum Type
DROP TYPE "Role";

-- 4. Create the new Tables
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- 5. Create Indexes
CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");
CREATE UNIQUE INDEX "Role_organizationId_code_key" ON "Role"("organizationId", "code");
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- 6. Seed Default Roles
INSERT INTO "Role" ("id", "name", "code", "description", "isSystem", "updatedAt") VALUES
('role_admin', 'Administrateur', 'ADMIN', 'Accès complet à toutes les fonctionnalités', true, CURRENT_TIMESTAMP),
('role_resp_pedago', 'Responsable Pédagogique', 'RESP_PEDAGO', 'Gestion des programmes, sessions et intervenants', true, CURRENT_TIMESTAMP),
('role_resp_admin', 'Responsable Administratif', 'RESP_ADMIN', 'Gestion des dossiers, finances et contrats', true, CURRENT_TIMESTAMP),
('role_ref_qualite', 'Référent Qualité', 'REF_QUALITE', 'Suivi de la conformité Qualiopi', true, CURRENT_TIMESTAMP),
('role_format', 'Formateur', 'FORMAT', 'Accès aux sessions et émargements', true, CURRENT_TIMESTAMP);

-- 7. Migrate Membership Data
ALTER TABLE "Membership" ADD COLUMN "roleId" TEXT;

UPDATE "Membership"
SET "roleId" = (SELECT id FROM "Role" WHERE code = "Membership"."role");

-- If any role is missing (data integrity issue), we fallback to FORMAT or similar?
-- For now, we assume data integrity is good as it came from enum.

ALTER TABLE "Membership" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "Membership" DROP COLUMN "role";

-- 8. Add Foreign Keys
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

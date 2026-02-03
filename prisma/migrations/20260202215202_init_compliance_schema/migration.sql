-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RESP_PEDAGO', 'RESP_ADMIN', 'REF_QUALITE', 'FORMAT');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('BROUILLON', 'EN_ATTENTE_VALIDATION', 'ACTIF', 'SUSPENDU', 'CLOTURE', 'ABANDONNE');

-- CreateEnum
CREATE TYPE "TypeFinanceur" AS ENUM ('CPF', 'OPCO', 'ENTREPRISE', 'PERSONNEL', 'MIXTE');

-- CreateEnum
CREATE TYPE "TypeContrat" AS ENUM ('CONVENTION', 'CONTRAT');

-- CreateEnum
CREATE TYPE "TypePreuve" AS ENUM ('PROGRAMME', 'CGV', 'TEST_POSITIONNEMENT', 'ANALYSE_BESOIN', 'CONTRAT_SIGNE', 'ACCORD_FINANCEMENT', 'EMARGEMENT', 'RELEVE_CONNEXION', 'TRAVAUX_STAGIAIRE', 'CERTIFICAT_REALISATION', 'EVALUATION_CHAUD', 'FACTURE', 'AVENANT', 'JUSTIFICATIF_ABSENCE');

-- CreateEnum
CREATE TYPE "MotifAbandon" AS ENUM ('FORCE_MAJEURE', 'VOLONTAIRE', 'EXCLUSION', 'DEFAUT_PAIEMENT');

-- CreateEnum
CREATE TYPE "StatutCertification" AS ENUM ('ACTIVE', 'INACTIVE', 'EN_COURS');

-- CreateEnum
CREATE TYPE "Modalite" AS ENUM ('PRESENTIEL', 'FOAD', 'MIXTE');

-- CreateEnum
CREATE TYPE "NiveauAction" AS ENUM ('LECTURE', 'EDITION', 'VALIDATION', 'FORCAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FORMAT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "statut" "StatutCertification" NOT NULL DEFAULT 'ACTIVE',
    "dateFinValidite" TIMESTAMP(3),
    "urlFicheFC" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "objectifs" TEXT NOT NULL,
    "prerequis" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "modalitesEval" TEXT NOT NULL,
    "moyensPedago" TEXT NOT NULL,
    "accessibilitePSH" TEXT,
    "dureeHeures" INTEGER NOT NULL,
    "modalite" "Modalite" NOT NULL DEFAULT 'PRESENTIEL',
    "tarifHT" DECIMAL(10,2) NOT NULL,
    "tarifTTC" DECIMAL(10,2) NOT NULL,
    "certificationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "status" "PhaseStatus" NOT NULL DEFAULT 'BROUILLON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeSnapshot" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contenuSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "lieuFormation" TEXT,
    "placesMin" INTEGER NOT NULL DEFAULT 1,
    "placesMax" INTEGER NOT NULL,
    "formateurId" TEXT,
    "status" "PhaseStatus" NOT NULL DEFAULT 'BROUILLON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stagiaireNom" TEXT NOT NULL,
    "stagiairePrenom" TEXT NOT NULL,
    "stagiaireEmail" TEXT NOT NULL,
    "stagiaireTelephone" TEXT,
    "stagiaireAdresse" TEXT,
    "testPositionnementEnvoye" BOOLEAN NOT NULL DEFAULT false,
    "testPositionnementComplete" BOOLEAN NOT NULL DEFAULT false,
    "scorePositionnement" INTEGER,
    "seuilScoreMinimum" INTEGER NOT NULL DEFAULT 50,
    "alertePedagogiqueActive" BOOLEAN NOT NULL DEFAULT false,
    "declarationPSH" BOOLEAN,
    "adaptationsPSH" TEXT,
    "adaptationsPSHValidees" BOOLEAN NOT NULL DEFAULT false,
    "phaseActuelle" INTEGER NOT NULL DEFAULT 2,
    "status" "PhaseStatus" NOT NULL DEFAULT 'BROUILLON',
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateValidationAdmission" TIMESTAMP(3),
    "dateDebutEffectif" TIMESTAMP(3),
    "dateFinEffective" TIMESTAMP(3),
    "isAbandonne" BOOLEAN NOT NULL DEFAULT false,
    "motifAbandon" "MotifAbandon",
    "dateAbandon" TIMESTAMP(3),
    "abandonValidePedago" BOOLEAN NOT NULL DEFAULT false,
    "abandonValideAdmin" BOOLEAN NOT NULL DEFAULT false,
    "tauxAssiduite" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "certificatGenere" BOOLEAN NOT NULL DEFAULT false,
    "dateCertificat" TIMESTAMP(3),
    "factureGeneree" BOOLEAN NOT NULL DEFAULT false,
    "dateFacture" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Financeur" (
    "id" TEXT NOT NULL,
    "type" "TypeFinanceur" NOT NULL,
    "raisonSociale" TEXT,
    "siret" TEXT,
    "codeOPCO" TEXT,
    "numeroCPF" TEXT,
    "soldeCPF" DECIMAL(10,2),
    "contactNom" TEXT,
    "contactEmail" TEXT,
    "contactTelephone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Financeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "type" "TypeContrat" NOT NULL,
    "programmeSnapshotId" TEXT NOT NULL,
    "financeurId" TEXT NOT NULL,
    "montantHT" DECIMAL(10,2) NOT NULL,
    "montantTVA" DECIMAL(10,2) NOT NULL,
    "montantTTC" DECIMAL(10,2) NOT NULL,
    "dateSignature" TIMESTAMP(3),
    "dateDebutPrevue" TIMESTAMP(3) NOT NULL,
    "dateFinPrevue" TIMESTAMP(3) NOT NULL,
    "delaiRetractationJours" INTEGER,
    "dateFinRetractation" TIMESTAMP(3),
    "retractationRespectee" BOOLEAN NOT NULL DEFAULT false,
    "accordFinancementRecu" BOOLEAN NOT NULL DEFAULT false,
    "dateAccordFinancement" TIMESTAMP(3),
    "referenceAccord" TEXT,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "status" "PhaseStatus" NOT NULL DEFAULT 'BROUILLON',
    "mentionsLegalesIncluses" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avenant" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "ancienneValeur" JSONB NOT NULL,
    "nouvelleValeur" JSONB NOT NULL,
    "validePar" TEXT NOT NULL,
    "dateValidation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emargement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "dateEmargement" TIMESTAMP(3) NOT NULL,
    "demiJournee" TEXT NOT NULL,
    "estPresent" BOOLEAN NOT NULL DEFAULT false,
    "signatureStagiaire" TEXT,
    "signatureFormateur" TEXT,
    "absenceJustifiee" BOOLEAN NOT NULL DEFAULT false,
    "motifAbsence" TEXT,
    "justificatifPath" TEXT,
    "justificatifValide" BOOLEAN NOT NULL DEFAULT false,
    "isFOAD" BOOLEAN NOT NULL DEFAULT false,
    "tempsConnexion" INTEGER,
    "jalonAtteint" BOOLEAN NOT NULL DEFAULT false,
    "dateOriginale" TIMESTAMP(3),
    "isForced" BOOLEAN NOT NULL DEFAULT false,
    "forcedById" TEXT,
    "forcedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emargement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteDecrochage" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isTraitee" BOOLEAN NOT NULL DEFAULT false,
    "dateTraitement" TIMESTAMP(3),
    "actionPrise" TEXT,
    "traiteParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlerteDecrochage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" INTEGER,
    "commentaires" TEXT,
    "reponses" JSONB,
    "saisiPar" TEXT NOT NULL,
    "dateSaisie" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preuve" (
    "id" TEXT NOT NULL,
    "type" "TypePreuve" NOT NULL,
    "programmeId" TEXT,
    "dossierId" TEXT,
    "contratId" TEXT,
    "nomFichier" TEXT NOT NULL,
    "cheminFichier" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tailleFichier" INTEGER NOT NULL,
    "hashFichier" TEXT NOT NULL,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "signatureInfo" JSONB,
    "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "genereParId" TEXT,

    CONSTRAINT "Preuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "demandeurType" TEXT NOT NULL,
    "demandeurNom" TEXT NOT NULL,
    "demandeurEmail" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" "PhaseStatus" NOT NULL DEFAULT 'BROUILLON',
    "dateResolution" TIMESTAMP(3),
    "actionsCorrectives" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "validateurId" TEXT NOT NULL,
    "roleValidateur" "Role" NOT NULL,
    "decision" TEXT NOT NULL,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAlert" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "userRole" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "niveauAction" "NiveauAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "phase" INTEGER,
    "isForced" BOOLEAN NOT NULL DEFAULT false,
    "justification" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_code_key" ON "Certification"("code");

-- CreateIndex
CREATE INDEX "Certification_code_idx" ON "Certification"("code");

-- CreateIndex
CREATE INDEX "Certification_statut_idx" ON "Certification"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_reference_key" ON "Programme"("reference");

-- CreateIndex
CREATE INDEX "Programme_reference_idx" ON "Programme"("reference");

-- CreateIndex
CREATE INDEX "Programme_status_isPublished_idx" ON "Programme"("status", "isPublished");

-- CreateIndex
CREATE INDEX "ProgrammeSnapshot_programmeId_idx" ON "ProgrammeSnapshot"("programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeSnapshot_programmeId_version_key" ON "ProgrammeSnapshot"("programmeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Session_reference_key" ON "Session"("reference");

-- CreateIndex
CREATE INDEX "Session_programmeId_idx" ON "Session"("programmeId");

-- CreateIndex
CREATE INDEX "Session_dateDebut_dateFin_idx" ON "Session"("dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Dossier_sessionId_idx" ON "Dossier"("sessionId");

-- CreateIndex
CREATE INDEX "Dossier_stagiaireEmail_idx" ON "Dossier"("stagiaireEmail");

-- CreateIndex
CREATE INDEX "Dossier_status_phaseActuelle_idx" ON "Dossier"("status", "phaseActuelle");

-- CreateIndex
CREATE INDEX "Financeur_type_idx" ON "Financeur"("type");

-- CreateIndex
CREATE INDEX "Financeur_siret_idx" ON "Financeur"("siret");

-- CreateIndex
CREATE INDEX "Contrat_dossierId_idx" ON "Contrat"("dossierId");

-- CreateIndex
CREATE INDEX "Contrat_financeurId_idx" ON "Contrat"("financeurId");

-- CreateIndex
CREATE INDEX "Contrat_status_idx" ON "Contrat"("status");

-- CreateIndex
CREATE INDEX "Avenant_contratId_idx" ON "Avenant"("contratId");

-- CreateIndex
CREATE INDEX "Emargement_sessionId_idx" ON "Emargement"("sessionId");

-- CreateIndex
CREATE INDEX "Emargement_dossierId_idx" ON "Emargement"("dossierId");

-- CreateIndex
CREATE INDEX "Emargement_dateEmargement_idx" ON "Emargement"("dateEmargement");

-- CreateIndex
CREATE UNIQUE INDEX "Emargement_sessionId_dossierId_dateEmargement_demiJournee_key" ON "Emargement"("sessionId", "dossierId", "dateEmargement", "demiJournee");

-- CreateIndex
CREATE INDEX "AlerteDecrochage_dossierId_idx" ON "AlerteDecrochage"("dossierId");

-- CreateIndex
CREATE INDEX "AlerteDecrochage_isTraitee_idx" ON "AlerteDecrochage"("isTraitee");

-- CreateIndex
CREATE INDEX "Evaluation_dossierId_idx" ON "Evaluation"("dossierId");

-- CreateIndex
CREATE INDEX "Evaluation_type_idx" ON "Evaluation"("type");

-- CreateIndex
CREATE INDEX "Preuve_type_idx" ON "Preuve"("type");

-- CreateIndex
CREATE INDEX "Preuve_dossierId_idx" ON "Preuve"("dossierId");

-- CreateIndex
CREATE INDEX "Preuve_contratId_idx" ON "Preuve"("contratId");

-- CreateIndex
CREATE INDEX "Reclamation_status_idx" ON "Reclamation"("status");

-- CreateIndex
CREATE INDEX "Reclamation_ownerId_idx" ON "Reclamation"("ownerId");

-- CreateIndex
CREATE INDEX "Validation_entityType_entityId_idx" ON "Validation"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Validation_validateurId_idx" ON "Validation"("validateurId");

-- CreateIndex
CREATE INDEX "Validation_phase_idx" ON "Validation"("phase");

-- CreateIndex
CREATE INDEX "ComplianceAlert_dossierId_idx" ON "ComplianceAlert"("dossierId");

-- CreateIndex
CREATE INDEX "ComplianceAlert_ruleId_idx" ON "ComplianceAlert"("ruleId");

-- CreateIndex
CREATE INDEX "ComplianceAlert_isResolved_idx" ON "ComplianceAlert"("isResolved");

-- CreateIndex
CREATE INDEX "ComplianceAlert_severity_idx" ON "ComplianceAlert"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_phase_idx" ON "AuditLog"("phase");

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeSnapshot" ADD CONSTRAINT "ProgrammeSnapshot_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_formateurId_fkey" FOREIGN KEY ("formateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_programmeSnapshotId_fkey" FOREIGN KEY ("programmeSnapshotId") REFERENCES "ProgrammeSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_financeurId_fkey" FOREIGN KEY ("financeurId") REFERENCES "Financeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emargement" ADD CONSTRAINT "Emargement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emargement" ADD CONSTRAINT "Emargement_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preuve" ADD CONSTRAINT "Preuve_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_validateurId_fkey" FOREIGN KEY ("validateurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/**
 * TESTS DU COMPLIANCE ENGINE
 * ==========================
 * Tests unitaires pour le moteur de conformité ERP Formation.
 * 
 * @QA: Ces tests vérifient que les règles Qualiopi sont bien appliquées.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { validateStateChange, setPrismaInstance } from './engine';

// Créer le mock Prisma
const prismaMock = mockDeep<PrismaClient>();

// ============================================================================
// DONNÉES DE TEST
// ============================================================================

/**
 * Dossier de test avec assiduité incomplète (50%)
 * Scénario: Tentative de clôture avec assiduité insuffisante
 */
/**
 * Mock organization pour le contexte multi-tenant
 */
const createMockOrganization = () => ({
    id: 'org-001',
    name: 'Centre Formation Test',
    type: 'OF',
    ndaNumber: '12345678901', // NDA valide (11 chiffres)
    qualiopiCertified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
});

const createMockDossierIncompleteAssiduity = () => ({
    id: 'dossier-test-001',
    sessionId: 'session-001',
    stagiaireNom: 'Dupont',
    stagiairePrenom: 'Jean',
    stagiaireEmail: 'jean.dupont@test.fr',
    stagiaireTelephone: null,
    stagiaireAdresse: null,
    testPositionnementEnvoye: true,
    testPositionnementComplete: true,
    scorePositionnement: 75,
    seuilScoreMinimum: 50,
    alertePedagogiqueActive: false,
    declarationPSH: false,
    adaptationsPSH: null,
    adaptationsPSHValidees: false,
    phaseActuelle: 4,
    status: 'EN_COURS',
    dateInscription: new Date('2024-01-15'),
    dateValidationAdmission: new Date('2024-01-20'),
    dateDebutEffectif: new Date('2024-02-01'),
    dateFinEffective: null,
    isAbandonne: false,
    motifAbandon: null,
    dateAbandon: null,
    abandonValidePedago: false,
    abandonValideAdmin: false,
    // POINT CLÉ: Assiduité à 50% (violation de la règle CLOTURE)
    tauxAssiduite: 50.00,
    certificatGenere: false,
    dateCertificat: null,
    factureGeneree: false,
    dateFacture: null,
    createdById: 'user-001',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-01'),
    organizationId: 'org-001',
    companyId: null,
    tutorName: null,
    organization: createMockOrganization(),
    // Relations
    session: {
        id: 'session-001',
        programmeId: 'prog-001',
        reference: 'SESS-2024-001',
        dateDebut: new Date('2024-02-01'),
        dateFin: new Date('2024-02-28'),
        lieuFormation: 'Paris',
        placesMin: 5,
        placesMax: 15,
        formateurId: 'formateur-001',
        status: 'ACTIF',
        createdAt: new Date(),
        updatedAt: new Date(),
        programme: {
            id: 'prog-001',
            reference: 'FORM-2024-001',
            intitule: 'Formation Test',
            objectifs: 'Objectifs de test',
            prerequis: 'Aucun',
            contenu: 'Contenu détaillé',
            modalitesEval: 'QCM',
            moyensPedago: 'Supports',
            accessibilitePSH: 'Accessible',
            dureeHeures: 35,
            modalite: 'PRESENTIEL',
            tarifHT: 1500,
            tarifTTC: 1800,
            certificationId: 'cert-001',
            version: 1,
            isPublished: true,
            publishedAt: new Date(),
            status: 'ACTIF',
            createdAt: new Date(),
            updatedAt: new Date(),
            certification: {
                id: 'cert-001',
                code: 'RNCP12345',
                intitule: 'Certification Test',
                statut: 'ACTIVE',
                dateFinValidite: new Date('2025-12-31'),
                urlFicheFC: 'https://francecompetences.fr/rncp12345',
                lastCheckedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        },
    },
    contrats: [
        {
            id: 'contrat-001',
            dossierId: 'dossier-test-001',
            type: 'CONVENTION',
            programmeSnapshotId: 'snap-001',
            financeurId: 'financeur-001',
            montantHT: 1500,
            montantTVA: 300,
            montantTTC: 1800,
            dateSignature: new Date('2024-01-25'),
            dateDebutPrevue: new Date('2024-02-01'),
            dateFinPrevue: new Date('2024-02-28'),
            delaiRetractationJours: null,
            dateFinRetractation: null,
            retractationRespectee: true,
            accordFinancementRecu: true,
            dateAccordFinancement: new Date('2024-01-28'),
            referenceAccord: 'OPCO-2024-001',
            isSigned: true,
            status: 'ACTIF',
            mentionsLegalesIncluses: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            financeur: {
                id: 'financeur-001',
                type: 'OPCO',
                raisonSociale: 'OPCO Test',
                siret: '12345678901234',
                codeOPCO: 'OPCO01',
                numeroCPF: null,
                soldeCPF: null,
                contactNom: 'Contact OPCO',
                contactEmail: 'contact@opco.fr',
                contactTelephone: '0100000000',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        },
    ],
    preuves: [],
    emargements: [],
});

/**
 * Dossier de test avec assiduité complète (100%)
 */
const createMockDossierCompleteAssiduity = () => ({
    ...createMockDossierIncompleteAssiduity(),
    id: 'dossier-test-002',
    tauxAssiduite: 100.00,
    certificatGenere: true,
    dateCertificat: new Date('2024-02-28'),
});

// ============================================================================
// TESTS
// ============================================================================

describe('Compliance Engine', () => {
    beforeEach(() => {
        // Injecter le mock Prisma avant chaque test
        mockReset(prismaMock);
        setPrismaInstance(prismaMock as unknown as PrismaClient);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('validateStateChange', () => {

        // -------------------------------------------------------------------------
        // TEST PRINCIPAL: Blocage assiduité < 100% pour clôture
        // -------------------------------------------------------------------------
        it('should BLOCK transition to CLOTURE when assiduity is < 100%', async () => {
            // ARRANGE: Dossier avec 50% d'assiduité
            const mockDossier = createMockDossierIncompleteAssiduity();

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({
                id: 'alert-001',
                dossierId: mockDossier.id,
                ruleId: 'RULE_ASSIDUITE_INCOMPLETE',
                severity: 'BLOCKING',
                context: 'STATE_CHANGE',
                trigger: 'TO_CLOTURE',
                message: 'Assiduité incomplète (< 100%). Validation manuelle requise.',
                details: {},
                isResolved: false,
                resolvedById: null,
                resolvedAt: null,
                resolution: null,
                createdAt: new Date(),
            } as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT: Tentative de passage en CLOTURE
            const result = await validateStateChange(mockDossier.id, 'CLOTURE', 'user-001');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('RULE_ASSIDUITE_INCOMPLETE');
            expect(result.errors[0]).toContain('Assiduité incomplète');

            // Vérifier que ComplianceAlert a été créée
            expect(prismaMock.complianceAlert.create).toHaveBeenCalledTimes(1);
            expect(prismaMock.complianceAlert.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    dossierId: mockDossier.id,
                    ruleId: 'RULE_ASSIDUITE_INCOMPLETE',
                    severity: 'BLOCKING',
                    trigger: 'TO_CLOTURE',
                    isResolved: false,
                }),
            });
        });

        // -------------------------------------------------------------------------
        // TEST: Passage autorisé si assiduité = 100%
        // -------------------------------------------------------------------------
        it('should ALLOW transition to CLOTURE when assiduity is 100%', async () => {
            // ARRANGE: Dossier avec 100% d'assiduité
            const mockDossier = createMockDossierCompleteAssiduity();

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'CLOTURE');

            // ASSERT
            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);

            // Aucune alerte ne doit être créée
            expect(prismaMock.complianceAlert.create).not.toHaveBeenCalled();
        });

        // -------------------------------------------------------------------------
        // TEST: Dossier introuvable
        // -------------------------------------------------------------------------
        it('should throw error when dossier not found', async () => {
            // ARRANGE
            prismaMock.dossier.findUnique.mockResolvedValue(null);

            // ACT & ASSERT
            await expect(
                validateStateChange('non-existent-id', 'CLOTURE')
            ).rejects.toThrow('Dossier introuvable');
        });

        // -------------------------------------------------------------------------
        // TEST: Blocage contrat non signé pour démarrage
        // -------------------------------------------------------------------------
        it('should BLOCK transition to EN_COURS when contract not signed', async () => {
            // ARRANGE: Dossier avec contrat non signé
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.contrats[0].isSigned = false;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'EN_COURS');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.includes('RULE_CONTRAT_SIGNE'))).toBe(true);
        });

        // -------------------------------------------------------------------------
        // TEST: Blocage financement non accordé pour démarrage
        // -------------------------------------------------------------------------
        it('should BLOCK transition to EN_COURS when funding not approved', async () => {
            // ARRANGE: Dossier avec financement non accordé
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.contrats[0].accordFinancementRecu = false;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'EN_COURS');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.includes('RULE_FINANCEMENT_ACCORDE'))).toBe(true);
        });

        // -------------------------------------------------------------------------
        // TEST: Blocage certificat non généré pour facturation
        // -------------------------------------------------------------------------
        it('should BLOCK transition to FACTURE when certificate not generated', async () => {
            // ARRANGE: Dossier sans certificat
            const mockDossier = createMockDossierCompleteAssiduity();
            mockDossier.certificatGenere = false;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'FACTURE');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.includes('RULE_CERTIFICAT_POUR_FACTURE'))).toBe(true);
        });

        // -------------------------------------------------------------------------
        // TEST: Warning test positionnement non complété
        // -------------------------------------------------------------------------
        it('should return WARNING when positioning test not completed', async () => {
            // ARRANGE
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.testPositionnementComplete = false;
            mockDossier.declarationPSH = true;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'ADMIS');

            // ASSERT
            expect(result.warnings.some(w => w.includes('RULE_TEST_POSITIONNEMENT'))).toBe(true);
        });

        // =========================================================================
        // TESTS SPÉCIFIQUES CFA (Centre de Formation d'Apprentis)
        // =========================================================================

        // -------------------------------------------------------------------------
        // TEST CFA: Blocage si pas d'employeur/tuteur pour dossier CFA
        // -------------------------------------------------------------------------
        it('[CFA] should BLOCK transition to ADMIS when company missing for CFA', async () => {
            // ARRANGE: Organisation CFA, pas d'entreprise
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.organization.type = 'CFA';
            mockDossier.companyId = null;
            mockDossier.tutorName = null;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'ADMIS');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.includes('CFA') && e.includes('entreprise')
            )).toBe(true);
        });

        // -------------------------------------------------------------------------
        // TEST CFA: Blocage si pas de tuteur pour dossier CFA
        // -------------------------------------------------------------------------
        it('[CFA] should BLOCK transition to ACTIF when tutor missing for CFA', async () => {
            // ARRANGE: Organisation CFA, entreprise OK, pas de tuteur
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.organization.type = 'CFA';
            mockDossier.companyId = 'company-001';
            mockDossier.tutorName = null;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'ACTIF');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.includes('CFA') && e.includes("maître d'apprentissage")
            )).toBe(true);
        });

        // -------------------------------------------------------------------------
        // TEST CFA: Succès si employeur ET tuteur présents
        // -------------------------------------------------------------------------
        it('[CFA] should ALLOW transition to ADMIS when company AND tutor present', async () => {
            // ARRANGE: Organisation CFA avec entreprise et tuteur
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.organization.type = 'CFA';
            mockDossier.companyId = 'company-001';
            mockDossier.tutorName = 'Jean Dupont';
            mockDossier.declarationPSH = true;
            mockDossier.testPositionnementComplete = true;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'ADMIS');

            // ASSERT
            // Pas de blocage CFA (les autres blocages peuvent exister)
            expect(result.errors.filter(e => e.includes('CFA'))).toHaveLength(0);
        });

        // -------------------------------------------------------------------------
        // TEST: Blocage Qualiopi pour financement CPF
        // -------------------------------------------------------------------------
        it('should BLOCK when CPF funding without Qualiopi certification', async () => {
            // ARRANGE: Organisation sans Qualiopi, financement CPF
            const mockDossier = createMockDossierIncompleteAssiduity();
            mockDossier.organization.qualiopiCertified = false;
            mockDossier.contrats[0].financeur.type = 'CPF';

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'EN_COURS');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.includes('Qualiopi'))).toBe(true);
        });

        // -------------------------------------------------------------------------
        // TEST: Blocage NDA pour facturation
        // -------------------------------------------------------------------------
        it('should BLOCK transition to FACTURE when NDA missing', async () => {
            // ARRANGE: Organisation sans NDA
            const mockDossier = createMockDossierCompleteAssiduity();
            mockDossier.organization.ndaNumber = null;

            prismaMock.dossier.findUnique.mockResolvedValue(mockDossier as any);
            prismaMock.complianceAlert.create.mockResolvedValue({} as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // ACT
            const result = await validateStateChange(mockDossier.id, 'FACTURE');

            // ASSERT
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.includes('NDA'))).toBe(true);
        });

    });
});

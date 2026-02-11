/**
 * TESTS EXPORT DOSSIER OPCO
 * ===========================
 * Tests unitaires pour le service d'export dossier OPCO.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    listOPCOContrats,
    generateOPCOExport,
    generateOPCOTextExport,
    setPrismaInstance,
} from './opco-export';

// ─── Mock Prisma ──────────────────────────────────────────────

function createMockPrisma() {
    return {
        organization: { findUnique: vi.fn() },
        contrat: { findMany: vi.fn() },
        session: { findUnique: vi.fn() },
        dossier: { findMany: vi.fn() },
    };
}

const ORG_ID = 'org-opco-001';

function createMockContrat(overrides: any = {}) {
    return {
        id: 'ctr-001',
        type: 'CONVENTION',
        montantHT: 3500,
        montantTVA: 700,
        montantTTC: 4200,
        status: 'CONTRACTUALISE',
        dateSignature: new Date('2025-03-01'),
        isSigned: true,
        accordFinancementRecu: true,
        dateAccordFinancement: new Date('2025-02-15'),
        referenceAccord: 'OPCO-2025-1234',
        dateDebutPrevue: new Date('2025-04-01'),
        dateFinPrevue: new Date('2025-07-30'),
        financeur: {
            id: 'fin-001',
            type: 'OPCO',
            raisonSociale: 'OPCO Atlas',
            codeOPCO: 'ATLAS',
            siret: '98765432109876',
            contactNom: 'Sophie Conseil',
            contactEmail: 'sophie@opco-atlas.fr',
        },
        dossier: {
            sessionId: 'ses-001',
            session: {
                reference: 'SES-2025-001',
                programme: { intitule: 'Développement Web Full Stack' },
            },
        },
        ...overrides,
    };
}

function createMockDossierOPCO(overrides: any = {}) {
    return {
        id: 'dos-001',
        stagiaireNom: 'Martin',
        stagiairePrenom: 'Julie',
        stagiaireEmail: 'julie@test.fr',
        status: 'TERMINE',
        dateInscription: new Date('2025-03-01'),
        dateDebutEffectif: new Date('2025-04-01'),
        dateFinEffective: new Date('2025-07-30'),
        tauxAssiduite: 95,
        certificatGenere: true,
        dateCertificat: new Date('2025-08-01'),
        factureGeneree: true,
        dateFacture: new Date('2025-08-15'),
        declarationPSH: false,
        adaptationsPSH: null,
        contrats: [createMockContrat()],
        emargements: [
            {
                dateEmargement: new Date('2025-04-02'), demiJournee: 'AM',
                estPresent: true, absenceJustifiee: false, isFOAD: false,
                signatureStagiaire: 'sig-data', signatureFormateur: 'sig-data',
            },
            {
                dateEmargement: new Date('2025-04-02'), demiJournee: 'PM',
                estPresent: true, absenceJustifiee: false, isFOAD: false,
                signatureStagiaire: 'sig-data', signatureFormateur: 'sig-data',
            },
        ],
        evaluations: [
            { type: 'CHAUD', score: 85, commentaires: 'Très satisfaisant', dateSaisie: new Date('2025-08-01') },
        ],
        preuves: [
            { type: 'CONTRAT_SIGNE', nomFichier: 'convention.pdf', cheminFichier: '/docs/convention.pdf', dateGeneration: new Date() },
            { type: 'PROGRAMME', nomFichier: 'programme.pdf', cheminFichier: '/docs/programme.pdf', dateGeneration: new Date() },
            { type: 'CERTIFICAT_REALISATION', nomFichier: 'cert.pdf', cheminFichier: '/docs/cert.pdf', dateGeneration: new Date() },
            { type: 'ACCORD_FINANCEMENT', nomFichier: 'accord.pdf', cheminFichier: '/docs/accord.pdf', dateGeneration: new Date() },
        ],
        ...overrides,
    };
}

describe('Service Export Dossier OPCO', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
        mockPrisma = createMockPrisma();
        setPrismaInstance(mockPrisma);
    });

    describe('1. Liste contrats OPCO', () => {
        it('should list OPCO contracts grouped by session', async () => {
            mockPrisma.contrat.findMany.mockResolvedValue([
                createMockContrat({ id: 'ctr-1' }),
                createMockContrat({ id: 'ctr-2', montantHT: 2500 }),
            ]);

            const result = await listOPCOContrats(ORG_ID, 2025);

            expect(result.total).toBe(1); // grouped by session
            expect(result.contrats[0].nbStagiaires).toBe(2);
            expect(result.contrats[0].montantHT).toBe(6000);
        });

        it('should return empty for no OPCO contracts', async () => {
            mockPrisma.contrat.findMany.mockResolvedValue([]);

            const result = await listOPCOContrats(ORG_ID, 2025);

            expect(result.total).toBe(0);
            expect(result.contrats).toHaveLength(0);
        });
    });

    describe('2. Export complet', () => {
        it('should throw for unknown organization', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue(null);

            await expect(generateOPCOExport(ORG_ID, 'ses-001')).rejects.toThrow('Organisation introuvable');
        });

        it('should throw for unknown session', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({ name: 'Test', siret: '123', ndaNumber: '456' });
            mockPrisma.session.findUnique.mockResolvedValue(null);

            await expect(generateOPCOExport(ORG_ID, 'ses-001')).rejects.toThrow('Session introuvable');
        });

        it('should throw when session has no OPCO dossiers', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({ name: 'Test', siret: '123', ndaNumber: '456' });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID,
                programme: { id: 'p1', certification: null },
                site: { name: 'Site A', city: 'Paris' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([]);

            await expect(generateOPCOExport(ORG_ID, 'ses-001')).rejects.toThrow('Aucun dossier financé OPCO');
        });

        it('should generate a complete export with all sections', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'FormaPro SAS', siret: '12345678901234', ndaNumber: '11755555555',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-2025-001',
                dateDebut: new Date('2025-04-01'), dateFin: new Date('2025-07-30'),
                lieuFormation: 'Salle A',
                programme: {
                    id: 'prg-001', reference: 'PRG-001', intitule: 'Dev Web',
                    objectifs: 'Maîtriser le dev web', prerequis: 'Bases HTML',
                    dureeHeures: 400, modalite: 'PRESENTIEL',
                    certification: { code: 'RNCP31114', intitule: 'Développeur Web' },
                },
                site: { name: 'Siège Paris', city: 'Paris' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([
                createMockDossierOPCO(),
            ]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001', 'Admin');

            // Structure
            expect(data).toHaveProperty('metadata');
            expect(data).toHaveProperty('financeur');
            expect(data).toHaveProperty('programme');
            expect(data).toHaveProperty('sessionInfo');
            expect(data).toHaveProperty('stagiaires');
            expect(data).toHaveProperty('syntheseGlobale');

            // Financeur
            expect(data.financeur.type).toBe('OPCO');
            expect(data.financeur.codeOPCO).toBe('ATLAS');

            // Stagiaires
            expect(data.stagiaires).toHaveLength(1);
            const stag = data.stagiaires[0];
            expect(stag.stagiaireNom).toBe('Martin');
            expect(stag.tauxAssiduite).toBe(95);
            expect(stag.certificatGenere).toBe(true);
        });
    });

    describe('3. Pièces justificatives', () => {
        it('should mark all pieces as PRESENT for complete dossier', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: {
                    id: 'p1', reference: 'P1', intitule: 'T', objectifs: 'O',
                    prerequis: 'P', dureeHeures: 100, modalite: 'PRESENTIEL', certification: null
                },
                site: { name: 'S', city: 'C' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([createMockDossierOPCO()]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001');
            const pieces = data.stagiaires[0].pieces;

            const convention = pieces.find(p => p.type === 'CONVENTION');
            expect(convention?.status).toBe('PRESENT');

            const programme = pieces.find(p => p.type === 'PROGRAMME');
            expect(programme?.status).toBe('PRESENT');

            const accord = pieces.find(p => p.type === 'ACCORD_FINANCEMENT');
            expect(accord?.status).toBe('PRESENT');

            const cert = pieces.find(p => p.type === 'CERTIFICAT_REALISATION');
            expect(cert?.status).toBe('PRESENT');
        });

        it('should mark pieces as ABSENT for incomplete dossier', async () => {
            const incompleteDossier = createMockDossierOPCO({
                certificatGenere: false,
                factureGeneree: false,
                preuves: [], // no files
                contrats: [createMockContrat({
                    isSigned: false,
                    accordFinancementRecu: false,
                })],
                emargements: [],
                evaluations: [],
            });

            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: {
                    id: 'p1', reference: 'P1', intitule: 'T', objectifs: 'O',
                    prerequis: 'P', dureeHeures: 100, modalite: 'PRESENTIEL', certification: null
                },
                site: { name: 'S', city: 'C' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([incompleteDossier]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001');
            const pieces = data.stagiaires[0].pieces;

            const convention = pieces.find(p => p.type === 'CONVENTION');
            expect(convention?.status).toBe('INCOMPLET');

            const accord = pieces.find(p => p.type === 'ACCORD_FINANCEMENT');
            expect(accord?.status).toBe('ABSENT');
        });
    });

    describe('4. Complétude', () => {
        it('should score 100% for a fully complete TERMINE dossier', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: {
                    id: 'p1', reference: 'P1', intitule: 'T', objectifs: 'O',
                    prerequis: 'P', dureeHeures: 100, modalite: 'PRESENTIEL', certification: null
                },
                site: { name: 'S', city: 'C' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([createMockDossierOPCO()]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001');

            expect(data.stagiaires[0].completude.score).toBe(100);
            expect(data.stagiaires[0].completude.manquants).toHaveLength(0);
        });

        it('should list missing items for incomplete dossier', async () => {
            const incompleteDossier = createMockDossierOPCO({
                status: 'TERMINE',
                certificatGenere: false,
                factureGeneree: false,
                contrats: [createMockContrat({ isSigned: false, accordFinancementRecu: false })],
                emargements: [],
                evaluations: [],
            });

            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: {
                    id: 'p1', reference: 'P1', intitule: 'T', objectifs: 'O',
                    prerequis: 'P', dureeHeures: 100, modalite: 'PRESENTIEL', certification: null
                },
                site: { name: 'S', city: 'C' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([incompleteDossier]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001');
            const completude = data.stagiaires[0].completude;

            expect(completude.score).toBeLessThan(100);
            expect(completude.manquants).toContain('Convention/Contrat signé');
            expect(completude.manquants).toContain('Accord de financement OPCO');
            expect(completude.manquants).toContain('Émargements enregistrés');
            expect(completude.manquants).toContain('Certificat de réalisation');
            expect(completude.manquants).toContain('Facture');
        });
    });

    describe('5. Synthèse globale', () => {
        it('should compute global metrics', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: {
                    id: 'p1', reference: 'P1', intitule: 'T', objectifs: 'O',
                    prerequis: 'P', dureeHeures: 100, modalite: 'PRESENTIEL', certification: null
                },
                site: { name: 'S', city: 'C' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([
                createMockDossierOPCO({ id: 'dos-1' }),
                createMockDossierOPCO({ id: 'dos-2', tauxAssiduite: 85 }),
            ]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001');

            expect(data.syntheseGlobale.totalStagiaires).toBe(2);
            expect(data.syntheseGlobale.tauxAssiduiteGlobal).toBe(90); // (95+85)/2
            expect(data.syntheseGlobale.montantTotalHT).toBe(7000);
        });

        it('should alert on incomplete dossiers', async () => {
            const incompleteDossier = createMockDossierOPCO({
                status: 'TERMINE',
                certificatGenere: false,
                contrats: [createMockContrat({ accordFinancementRecu: false })],
            });

            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: {
                    id: 'p1', reference: 'P1', intitule: 'T', objectifs: 'O',
                    prerequis: 'P', dureeHeures: 100, modalite: 'PRESENTIEL', certification: null
                },
                site: { name: 'S', city: 'C' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([incompleteDossier]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001');

            expect(data.syntheseGlobale.alertes.length).toBeGreaterThan(0);
            expect(data.syntheseGlobale.alertes).toContainEqual(
                expect.stringContaining('sans accord de financement'),
            );
        });
    });

    describe('6. Export texte', () => {
        it('should generate a structured text export', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'FormaPro SAS', siret: '12345678901234', ndaNumber: '11755555555',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', organizationId: ORG_ID, reference: 'SES-2025-001',
                dateDebut: new Date('2025-04-01'), dateFin: new Date('2025-07-30'),
                lieuFormation: 'Salle A',
                programme: {
                    id: 'prg-001', reference: 'PRG-001', intitule: 'Dev Web',
                    objectifs: 'Maîtriser le dev web', prerequis: 'Bases HTML',
                    dureeHeures: 400, modalite: 'PRESENTIEL',
                    certification: { code: 'RNCP31114', intitule: 'Dev Web' },
                },
                site: { name: 'Siège Paris', city: 'Paris' },
            });
            mockPrisma.dossier.findMany.mockResolvedValue([createMockDossierOPCO()]);

            const data = await generateOPCOExport(ORG_ID, 'ses-001', 'Admin');
            const text = generateOPCOTextExport(data);

            expect(text).toContain('DOSSIER DE FINANCEMENT');
            expect(text).toContain('OPCO');
            expect(text).toContain('ORGANISME DE FORMATION');
            expect(text).toContain('FINANCEUR OPCO');
            expect(text).toContain('ACTION DE FORMATION');
            expect(text).toContain('SYNTHÈSE');
            expect(text).toContain('DOSSIERS STAGIAIRES');
            expect(text).toContain('Martin');
            expect(text).toContain('Julie');
            expect(text).toContain('ATLAS');
        });
    });
});

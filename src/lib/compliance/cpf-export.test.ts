/**
 * TESTS SERVICE CDC/CPF
 * =======================
 * Tests unitaires couvrant éligibilité, rétractation, EDOF et récapitulatif.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    checkCPFEligibilite,
    checkRetractation,
    generateEDOFDeclaration,
    generateCPFRecapitulatif,
    generateCPFTextExport,
    setPrismaInstance,
} from './cpf-export';

// ─── Mock Prisma ──────────────────────────────────────────────

function createMockPrisma() {
    return {
        organization: { findUnique: vi.fn() },
        programme: { findMany: vi.fn() },
        session: { findUnique: vi.fn(), findMany: vi.fn() },
        dossier: { findMany: vi.fn() },
    };
}

const ORG_ID = 'org-cpf-001';

function createMockProgramme(overrides: any = {}) {
    return {
        id: 'prg-001',
        reference: 'PRG-CPF-001',
        intitule: 'Développeur Web Full Stack',
        objectifs: 'Maîtriser le développement web frontend et backend',
        prerequis: 'Connaissances en programmation',
        contenu: 'HTML, CSS, JS, React, Node',
        modalitesEval: 'Projet final soutenu devant un jury professionnel',
        dureeHeures: 400,
        modalite: 'PRESENTIEL',
        tarifHT: 4500,
        tarifTTC: 5400,
        isPublished: true,
        certification: {
            id: 'cert-001',
            code: 'RNCP31114',
            intitule: 'Développeur Web et Web Mobile',
            statut: 'ACTIVE',
        },
        ...overrides,
    };
}

describe('Service CDC/CPF', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
        mockPrisma = createMockPrisma();
        setPrismaInstance(mockPrisma);
    });

    describe('1. Éligibilité CPF', () => {
        it('should mark programme with active certification as eligible', async () => {
            mockPrisma.programme.findMany.mockResolvedValue([createMockProgramme()]);

            const result = await checkCPFEligibilite(ORG_ID);

            expect(result).toHaveLength(1);
            expect(result[0].isEligible).toBe(true);
            expect(result[0].certificationCode).toBe('RNCP31114');
        });

        it('should reject programme without certification', async () => {
            mockPrisma.programme.findMany.mockResolvedValue([
                createMockProgramme({ certification: null }),
            ]);

            const result = await checkCPFEligibilite(ORG_ID);

            expect(result[0].isEligible).toBe(false);
            expect(result[0].raisons).toContainEqual(
                expect.stringContaining('certification'),
            );
        });

        it('should reject programme with inactive certification', async () => {
            mockPrisma.programme.findMany.mockResolvedValue([
                createMockProgramme({
                    certification: { code: 'RNCP-OLD', statut: 'INACTIVE', intitule: 'Old' },
                }),
            ]);

            const result = await checkCPFEligibilite(ORG_ID);

            expect(result[0].isEligible).toBe(false);
            expect(result[0].raisons).toContainEqual(
                expect.stringContaining('non active'),
            );
        });

        it('should reject programme with duration < 7h', async () => {
            mockPrisma.programme.findMany.mockResolvedValue([
                createMockProgramme({ dureeHeures: 3 }),
            ]);

            const result = await checkCPFEligibilite(ORG_ID);

            expect(result[0].isEligible).toBe(false);
            expect(result[0].raisons).toContainEqual(
                expect.stringContaining('7h'),
            );
        });

        it('should reject programme with insufficient objectives', async () => {
            mockPrisma.programme.findMany.mockResolvedValue([
                createMockProgramme({ objectifs: 'Bref' }),
            ]);

            const result = await checkCPFEligibilite(ORG_ID);

            expect(result[0].isEligible).toBe(false);
            expect(result[0].raisons).toContainEqual(
                expect.stringContaining('Objectifs'),
            );
        });
    });

    describe('2. Rétractation (14 jours)', () => {
        const now = new Date();

        it('should mark contract as retractable within 14 days', () => {
            const signedDate = new Date();
            signedDate.setDate(signedDate.getDate() - 5); // signed 5 days ago

            const result = checkRetractation(
                { id: 'ctr-1', dateSignature: signedDate, delaiRetractationJours: 14, retractationRespectee: false },
                { id: 'dos-1', stagiairePrenom: 'Julie', stagiaireNom: 'Martin', dateDebutEffectif: null },
            );

            expect(result.isRetractable).toBe(true);
            expect(result.joursRestants).toBeGreaterThan(0);
            expect(result.delaiJours).toBe(14);
        });

        it('should mark contract as non-retractable after 14 days', () => {
            const signedDate = new Date();
            signedDate.setDate(signedDate.getDate() - 20);

            const result = checkRetractation(
                { id: 'ctr-1', dateSignature: signedDate, delaiRetractationJours: 14, retractationRespectee: true },
                { id: 'dos-1', stagiairePrenom: 'Julie', stagiaireNom: 'Martin', dateDebutEffectif: null },
            );

            expect(result.isRetractable).toBe(false);
            expect(result.joursRestants).toBe(0);
        });

        it('should alert when formation starts before retractation ends', () => {
            const signedDate = new Date();
            signedDate.setDate(signedDate.getDate() - 2);

            const debutFormation = new Date();
            debutFormation.setDate(debutFormation.getDate() + 3); // begins in 3 days (within retractation)

            const result = checkRetractation(
                { id: 'ctr-1', dateSignature: signedDate, delaiRetractationJours: 14, retractationRespectee: false },
                { id: 'dos-1', stagiairePrenom: 'Julie', stagiaireNom: 'Martin', dateDebutEffectif: debutFormation },
            );

            expect(result.alertes).toContainEqual(
                expect.stringContaining('AVANT la fin du délai'),
            );
        });

        it('should handle unsigned contract', () => {
            const result = checkRetractation(
                { id: 'ctr-1', dateSignature: null, retractationRespectee: false },
                { id: 'dos-1', stagiairePrenom: 'Pierre', stagiaireNom: 'Dupont', dateDebutEffectif: null },
            );

            expect(result.isRetractable).toBe(false);
            expect(result.dateSignature).toBeNull();
            expect(result.alertes).toContainEqual(
                expect.stringContaining('non signé'),
            );
        });
    });

    describe('3. Déclaration EDOF', () => {
        it('should generate a declarable session', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                siret: '12345678901234', ndaNumber: '11755555555',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-001', reference: 'SES-CPF-001',
                dateDebut: new Date('2025-04-01'), dateFin: new Date('2025-07-30'),
                lieuFormation: 'Salle A', capaciteMax: 12,
                programme: createMockProgramme(),
                site: { name: 'Siège Paris', city: 'Paris', zipCode: '75001' },
                dossiers: [
                    { status: 'EN_COURS' }, { status: 'TERMINE' }, { status: 'BROUILLON' },
                ],
            });

            const decl = await generateEDOFDeclaration(ORG_ID, 'ses-001');

            expect(decl.statut).toBe('DECLARABLE');
            expect(decl.codeCertification).toBe('RNCP31114');
            expect(decl.nbPlaces).toBe(12);
            expect(decl.nbPlacesOccupees).toBe(2); // EN_COURS + TERMINE only
            expect(decl.ndaOrganisme).toBe('11755555555');
        });

        it('should mark as NON_ELIGIBLE when no certification', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                siret: '123', ndaNumber: '456',
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-002', reference: 'SES-002',
                dateDebut: new Date(), dateFin: new Date(),
                programme: createMockProgramme({ certification: null }),
                site: { name: 'S', city: 'C', zipCode: '69000' },
                dossiers: [],
            });

            const decl = await generateEDOFDeclaration(ORG_ID, 'ses-002');

            expect(decl.statut).toBe('NON_ELIGIBLE');
            expect(decl.anomalies).toContainEqual(
                expect.stringContaining('non éligible CPF'),
            );
        });

        it('should mark as INCOMPLETE when NDA missing', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                siret: '123', ndaNumber: null,
            });
            mockPrisma.session.findUnique.mockResolvedValue({
                id: 'ses-003', reference: 'SES-003',
                dateDebut: new Date(), dateFin: new Date(),
                programme: createMockProgramme(),
                site: { name: 'S', city: 'C', zipCode: '69000' },
                dossiers: [],
            });

            const decl = await generateEDOFDeclaration(ORG_ID, 'ses-003');

            expect(decl.statut).toBe('INCOMPLETE');
            expect(decl.anomalies).toContainEqual(
                expect.stringContaining('NDA'),
            );
        });
    });

    describe('4. Récapitulatif CPF', () => {
        it('should generate a complete CPF recap', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'FormaPro SAS', siret: '12345678901234', ndaNumber: '11755555555',
            });
            mockPrisma.programme.findMany.mockResolvedValue([
                createMockProgramme(),
                createMockProgramme({ id: 'prg-002', reference: 'PRG-002', certification: null }),
            ]);
            mockPrisma.session.findMany.mockResolvedValue([
                {
                    id: 'ses-1', reference: 'SES-CPF-001',
                    dateDebut: new Date('2025-04-01'), dateFin: new Date('2025-07-30'),
                    programme: createMockProgramme(),
                    site: { name: 'Paris', city: 'Paris', zipCode: '75001' },
                    capaciteMax: 12,
                    dossiers: [{ status: 'EN_COURS' }, { status: 'TERMINE' }],
                },
            ]);
            mockPrisma.dossier.findMany.mockResolvedValue([
                {
                    id: 'dos-1', stagiaireNom: 'Martin', stagiairePrenom: 'Julie',
                    stagiaireEmail: 'j@t.fr', status: 'TERMINE', tauxAssiduite: 90,
                    certificatGenere: true,
                    contrats: [{
                        id: 'ctr-1', montantTTC: 5400, dateSignature: new Date('2025-02-15'),
                        delaiRetractationJours: 14, retractationRespectee: true,
                        financeur: { type: 'CPF', numeroCPF: 'CPF-123456', soldeCPF: 3000 },
                    }],
                    session: { dateDebut: new Date('2025-04-01') },
                },
                {
                    id: 'dos-2', stagiaireNom: 'Dupont', stagiairePrenom: 'Pierre',
                    stagiaireEmail: 'p@t.fr', status: 'EN_COURS', tauxAssiduite: 55,
                    certificatGenere: false,
                    contrats: [{
                        id: 'ctr-2', montantTTC: 5400, dateSignature: new Date('2025-03-01'),
                        delaiRetractationJours: 14, retractationRespectee: false,
                        financeur: { type: 'CPF', numeroCPF: null, soldeCPF: null },
                    }],
                    session: { dateDebut: new Date('2025-04-01') },
                },
            ]);

            const recap = await generateCPFRecapitulatif(ORG_ID, 2025);

            // Structure
            expect(recap).toHaveProperty('metadata');
            expect(recap).toHaveProperty('eligibilite');
            expect(recap).toHaveProperty('sessions');
            expect(recap).toHaveProperty('stagiaires');
            expect(recap).toHaveProperty('financier');
            expect(recap).toHaveProperty('retractation');
            expect(recap).toHaveProperty('alertes');

            // Éligibilité
            expect(recap.eligibilite.totalProgrammes).toBe(2);
            expect(recap.eligibilite.programmesEligibles).toBe(1);
            expect(recap.eligibilite.programmesNonEligibles).toBe(1);

            // Stagiaires
            expect(recap.stagiaires.total).toBe(2);
            expect(recap.stagiaires.termines).toBe(1);
            expect(recap.stagiaires.enCours).toBe(1);

            // Financier
            expect(recap.financier.montantTotalCPF).toBe(10800);

            // Alertes — manque numéro CPF
            expect(recap.alertes).toContainEqual(
                expect.stringContaining('sans numéro CPF'),
            );
        });

        it('should alert when no eligible programmes', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'Test', siret: '123', ndaNumber: '456',
            });
            mockPrisma.programme.findMany.mockResolvedValue([
                createMockProgramme({ certification: null }),
            ]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.dossier.findMany.mockResolvedValue([]);

            const recap = await generateCPFRecapitulatif(ORG_ID, 2025);

            expect(recap.alertes).toContainEqual(
                expect.stringContaining('Aucun programme éligible CPF'),
            );
        });
    });

    describe('5. Export texte', () => {
        it('should generate a valid CPF text export', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                name: 'FormaPro SAS', siret: '12345678901234', ndaNumber: '11755555555',
            });
            mockPrisma.programme.findMany.mockResolvedValue([createMockProgramme()]);
            mockPrisma.session.findMany.mockResolvedValue([{
                id: 'ses-1', reference: 'SES-001',
                dateDebut: new Date(), dateFin: new Date(),
                programme: createMockProgramme(),
                site: { name: 'P', city: 'P', zipCode: '75001' },
                capaciteMax: 10, dossiers: [],
            }]);
            mockPrisma.dossier.findMany.mockResolvedValue([]);

            const recap = await generateCPFRecapitulatif(ORG_ID, 2025, 'Admin');
            const text = generateCPFTextExport(recap);

            expect(text).toContain('RÉCAPITULATIF CPF');
            expect(text).toContain('CAISSE DES DÉPÔTS');
            expect(text).toContain('ÉLIGIBILITÉ CPF');
            expect(text).toContain('EDOF');
            expect(text).toContain('RÉTRACTATION');
            expect(text).toContain('FormaPro SAS');
        });
    });
});

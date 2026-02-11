/**
 * TESTS BPF — Bilan Pédagogique et Financier
 * =============================================
 * Tests unitaires pour le service de génération du BPF (Cerfa 10443).
 * Utilise des mocks Prisma (pas de base de données réelle).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBPF, generateBPFTextExport, setPrismaInstance } from './bpf';

// ─── Mock Prisma ──────────────────────────────────────────────

function createMockPrisma() {
    return {
        organization: {
            findUnique: vi.fn(),
        },
        dossier: {
            findMany: vi.fn(),
        },
        session: {
            findMany: vi.fn(),
        },
        partner: {
            findMany: vi.fn(),
        },
    };
}

// ─── Fixtures ─────────────────────────────────────────────────

const ORG_ID = 'org-test-001';

const mockOrg = {
    name: 'FormaPro SAS',
    siret: '12345678901234',
    ndaNumber: '11755555555',
    type: 'OF_STANDARD',
    qualiopiCertified: true,
    qualiopiExpiry: new Date('2027-06-30'),
    responsableName: 'Jean Dupont',
};

function createMockDossier(overrides: any = {}) {
    return {
        id: 'dos-001',
        organizationId: ORG_ID,
        status: 'TERMINE',
        tauxAssiduite: 92.5,
        certificatGenere: true,
        factureGeneree: true,
        contrats: [
            {
                id: 'ctr-001',
                type: 'CONVENTION',
                montantHT: 2500.00,
                montantTVA: 500.00,
                montantTTC: 3000.00,
                financeur: {
                    id: 'fin-001',
                    type: 'OPCO',
                    raisonSociale: 'OPCO Atlas',
                    codeOPCO: 'ATLAS',
                },
            },
        ],
        session: {
            id: 'ses-001',
            dateDebut: new Date('2025-03-01'),
            dateFin: new Date('2025-06-30'),
            programme: {
                id: 'prg-001',
                reference: 'PRG-2025-A',
                intitule: 'Développement Web Full Stack',
                dureeHeures: 400,
                modalite: 'PRESENTIEL',
                certification: {
                    code: 'RNCP31114',
                    intitule: 'Développeur Web et Web Mobile',
                },
            },
        },
        emargements: [
            { estPresent: true, isFOAD: false, absenceJustifiee: false },
            { estPresent: true, isFOAD: false, absenceJustifiee: false },
            { estPresent: false, isFOAD: false, absenceJustifiee: true },
            { estPresent: true, isFOAD: true, absenceJustifiee: false },
        ],
        ...overrides,
    };
}

function createMockSession(overrides: any = {}) {
    return {
        id: 'ses-001',
        organizationId: ORG_ID,
        status: 'TERMINE',
        dateDebut: new Date('2025-03-01'),
        dateFin: new Date('2025-06-30'),
        programme: {
            id: 'prg-001',
            reference: 'PRG-2025-A',
            intitule: 'Développement Web Full Stack',
            dureeHeures: 400,
            modalite: 'PRESENTIEL',
            certification: {
                code: 'RNCP31114',
                intitule: 'Développeur Web et Web Mobile',
            },
        },
        dossiers: [createMockDossier()],
        ...overrides,
    };
}

function createMockPartner(overrides: any = {}) {
    return {
        id: 'ptr-001',
        companyName: 'PartnerCo',
        siret: '98765432109876',
        status: 'ACTIVE',
        totalLeadsSubmitted: 15,
        qualification: {
            conventionSignedAt: new Date('2025-01-15'),
        },
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────

describe('Service BPF (Bilan Pédagogique et Financier)', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
        mockPrisma = createMockPrisma();
        setPrismaInstance(mockPrisma);
    });

    describe('1. Identification (Cadre A)', () => {
        it('should include organization identification data', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.identification.raisonSociale).toBe('FormaPro SAS');
            expect(report.identification.siret).toBe('12345678901234');
            expect(report.identification.ndaNumber).toBe('11755555555');
            expect(report.identification.qualiopiCertified).toBe(true);
        });

        it('should alert when NDA is missing', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrg, ndaNumber: null });
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.alertes).toContainEqual(
                expect.stringContaining('Déclaration d\'Activité (NDA) non renseigné'),
            );
        });

        it('should alert when Qualiopi is not certified', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrg, qualiopiCertified: false });
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.alertes).toContainEqual(
                expect.stringContaining('Certification Qualiopi non active'),
            );
        });

        it('should throw for non-existent organization', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue(null);

            await expect(generateBPF('nonexistent', 2025)).rejects.toThrow('Organisation introuvable');
        });
    });

    describe('2. Bilan Financier (Cadre B)', () => {
        it('should aggregate financial data by financeur type', async () => {
            const dossierOPCO = createMockDossier({
                id: 'dos-opco',
                contrats: [{
                    type: 'CONVENTION', montantHT: 3000,
                    financeur: { type: 'OPCO' },
                }],
            });
            const dossierCPF = createMockDossier({
                id: 'dos-cpf',
                contrats: [{
                    type: 'CONTRAT', montantHT: 1500,
                    financeur: { type: 'CPF' },
                }],
            });
            const dossierEntreprise = createMockDossier({
                id: 'dos-ent',
                contrats: [{
                    type: 'CONVENTION', montantHT: 5000,
                    financeur: { type: 'ENTREPRISE' },
                }],
            });

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([dossierOPCO, dossierCPF, dossierEntreprise]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanFinancier.produitsFormation.caTotal).toBe(9500);
            expect(report.bilanFinancier.produitsFormation.caOPCO).toBe(3000);
            expect(report.bilanFinancier.produitsFormation.caCPF).toBe(1500);
            expect(report.bilanFinancier.produitsFormation.caEntreprise).toBe(5000);
            expect(report.bilanFinancier.nbConventions).toBe(2);
            expect(report.bilanFinancier.nbContrats).toBe(1);
        });

        it('should compute facturation rate', async () => {
            const dossierFacture = createMockDossier({
                factureGeneree: true,
                contrats: [{ type: 'CONTRAT', montantHT: 2000, financeur: { type: 'CPF' } }],
            });
            const dossierNonFacture = createMockDossier({
                id: 'dos-nonfact',
                factureGeneree: false,
                contrats: [{ type: 'CONTRAT', montantHT: 3000, financeur: { type: 'OPCO' } }],
            });

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([dossierFacture, dossierNonFacture]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanFinancier.montantFacture).toBe(2000);
            expect(report.bilanFinancier.tauxFacturation).toBe(40); // 2000/5000 = 40%
        });

        it('should alert when no revenue', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.alertes).toContainEqual(
                expect.stringContaining('Aucun chiffre d\'affaires'),
            );
        });
    });

    describe('3. Bilan Pédagogique (Cadre C)', () => {
        it('should count active trainees correctly', async () => {
            const actifs = [
                createMockDossier({ id: 'dos-1', status: 'EN_COURS' }),
                createMockDossier({ id: 'dos-2', status: 'TERMINE' }),
                createMockDossier({ id: 'dos-3', status: 'CLOTURE' }),
                createMockDossier({ id: 'dos-4', status: 'FACTURE' }),
                createMockDossier({ id: 'dos-5', status: 'ABANDONNE' }),
            ];
            const inactifs = [
                createMockDossier({ id: 'dos-6', status: 'BROUILLON' }),
                createMockDossier({ id: 'dos-7', status: 'ADMIS' }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([...actifs, ...inactifs]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            // Seuls les actifs (EN_COURS, TERMINE, CLOTURE, FACTURE, ABANDONNE) comptent
            expect(report.bilanPedagogique.totalStagiaires).toBe(5);
        });

        it('should distribute trainees by financeur', async () => {
            const dossiers = [
                createMockDossier({ id: '1', status: 'EN_COURS', contrats: [{ financeur: { type: 'OPCO' } }] }),
                createMockDossier({ id: '2', status: 'TERMINE', contrats: [{ financeur: { type: 'OPCO' } }] }),
                createMockDossier({ id: '3', status: 'EN_COURS', contrats: [{ financeur: { type: 'CPF' } }] }),
                createMockDossier({ id: '4', status: 'CLOTURE', contrats: [{ financeur: { type: 'PERSONNEL' } }] }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue(dossiers);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanPedagogique.stagiairesParFinanceur.opco).toBe(2);
            expect(report.bilanPedagogique.stagiairesParFinanceur.cpf).toBe(1);
            expect(report.bilanPedagogique.stagiairesParFinanceur.personnel).toBe(1);
        });

        it('should compute hours from emargements', async () => {
            const dossier = createMockDossier({
                status: 'TERMINE',
                emargements: [
                    { estPresent: true, isFOAD: false, absenceJustifiee: false },
                    { estPresent: true, isFOAD: false, absenceJustifiee: false },
                    { estPresent: true, isFOAD: true, absenceJustifiee: false },
                    { estPresent: false, isFOAD: false, absenceJustifiee: false }, // absent non justifié
                    { estPresent: false, isFOAD: false, absenceJustifiee: true },  // absent justifié = compté
                ],
            });

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([dossier]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            // 3 présent + 1 justifié = 4 demi-journées comptées
            // 4 * 3.5h = 14h
            expect(report.bilanPedagogique.totalHeuresDispensees).toBe(14);
            expect(report.bilanPedagogique.heuresParModalite.presentiel).toBe(10.5); // 3 * 3.5
            expect(report.bilanPedagogique.heuresParModalite.foad).toBe(3.5);         // 1 * 3.5
        });

        it('should fall back to theoretical hours when no emargements', async () => {
            const dossier = createMockDossier({
                status: 'TERMINE',
                emargements: [],
                session: {
                    programme: {
                        id: 'prg-001',
                        reference: 'PRG-X',
                        intitule: 'Formation test',
                        dureeHeures: 200,
                        modalite: 'PRESENTIEL',
                        certification: null,
                    },
                },
            });

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([dossier]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanPedagogique.totalHeuresDispensees).toBe(200);
            expect(report.alertes).toContainEqual(
                expect.stringContaining('émargement'),
            );
        });

        it('should compute completion rate', async () => {
            const dossiers = [
                createMockDossier({ id: '1', status: 'TERMINE' }),
                createMockDossier({ id: '2', status: 'CLOTURE' }),
                createMockDossier({ id: '3', status: 'EN_COURS' }),
                createMockDossier({ id: '4', status: 'ABANDONNE' }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue(dossiers);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            // 2 terminés / 4 actifs = 50%
            expect(report.bilanPedagogique.tauxReussite).toBe(50);
        });

        it('should alert on low assiduité', async () => {
            const dossiers = [
                createMockDossier({ id: '1', status: 'TERMINE', tauxAssiduite: 45 }),
                createMockDossier({ id: '2', status: 'EN_COURS', tauxAssiduite: 60 }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue(dossiers);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanPedagogique.tauxAssiduiteGlobal).toBe(52.5);
            expect(report.alertes).toContainEqual(
                expect.stringContaining('Taux d\'assiduité global faible'),
            );
        });

        it('should alert on missing certificates', async () => {
            const dossiers = [
                createMockDossier({ id: '1', status: 'TERMINE', certificatGenere: true }),
                createMockDossier({ id: '2', status: 'TERMINE', certificatGenere: false }),
                createMockDossier({ id: '3', status: 'CLOTURE', certificatGenere: false }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue(dossiers);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanPedagogique.nbCertificatsGeneres).toBe(1);
            expect(report.alertes).toContainEqual(
                expect.stringContaining('sans certificat de réalisation'),
            );
        });

        it('should group actions by programme', async () => {
            const session1 = createMockSession({
                id: 'ses-1',
                dossiers: [
                    createMockDossier({ id: '1', status: 'TERMINE' }),
                    createMockDossier({ id: '2', status: 'CLOTURE' }),
                ],
            });
            const session2 = createMockSession({
                id: 'ses-2',
                programme: {
                    id: 'prg-002',
                    reference: 'PRG-2025-B',
                    intitule: 'Data Science Avancée',
                    dureeHeures: 300,
                    modalite: 'MIXTE',
                    certification: null,
                },
                dossiers: [
                    createMockDossier({ id: '3', status: 'EN_COURS' }),
                ],
            });

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([session1, session2]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.bilanPedagogique.actionsFormation).toHaveLength(2);

            const progA = report.bilanPedagogique.actionsFormation.find(
                a => a.reference === 'PRG-2025-A',
            );
            expect(progA).toBeDefined();
            expect(progA!.nbStagiaires).toBe(2);
            expect(progA!.nbSessions).toBe(1);
            expect(progA!.certificationCode).toBe('RNCP31114');

            const progB = report.bilanPedagogique.actionsFormation.find(
                a => a.reference === 'PRG-2025-B',
            );
            expect(progB).toBeDefined();
            expect(progB!.nbStagiaires).toBe(1);
            expect(progB!.certificationCode).toBeNull();
        });
    });

    describe('4. Sous-traitance (Cadre D)', () => {
        it('should list active partners with convention status', async () => {
            const partners = [
                createMockPartner({ id: '1', companyName: 'PartnerA', status: 'ACTIVE' }),
                createMockPartner({
                    id: '2', companyName: 'PartnerB', status: 'ACTIVE',
                    qualification: { conventionSignedAt: null },
                }),
                createMockPartner({ id: '3', companyName: 'PartnerC', status: 'INACTIVE' }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue(partners);

            const report = await generateBPF(ORG_ID, 2025);

            // Seuls ACTIVE et SUSPENDED sont "actifs"
            expect(report.sousTraitance.confiee.nbPartenaires).toBe(2);
            expect(report.sousTraitance.confiee.partenaires[0].conventionSigned).toBe(true);
            expect(report.sousTraitance.confiee.partenaires[1].conventionSigned).toBe(false);
        });

        it('should alert when partner lacks convention', async () => {
            const partners = [
                createMockPartner({
                    id: '1', status: 'ACTIVE',
                    qualification: { conventionSignedAt: null },
                }),
            ];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue(partners);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.alertes).toContainEqual(
                expect.stringContaining('sans convention de sous-traitance'),
            );
        });
    });

    describe('5. Metadata', () => {
        it('should set correct exercise period', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID, 2025);

            expect(report.metadata.exercice).toBe(2025);
            // Dates are in ISO format — timezone offset means the UTC string may show 2024-12-31T23:00
            // so we just verify the exercise year is encoded
            expect(new Date(report.metadata.periodeDebut).getFullYear()).toBe(2025);
            expect(new Date(report.metadata.periodeFin).getFullYear()).toBe(2025);
            expect(report.metadata.reference).toContain('BPF-2025');
        });

        it('should default to previous year', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);

            const report = await generateBPF(ORG_ID);

            const expectedYear = new Date().getFullYear() - 1;
            expect(report.metadata.exercice).toBe(expectedYear);
        });
    });

    describe('6. Export texte (Cerfa)', () => {
        it('should generate a valid text export with all sections', async () => {
            const dossier = createMockDossier();
            const session = createMockSession();
            const partner = createMockPartner();

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue([dossier]);
            mockPrisma.session.findMany.mockResolvedValue([session]);
            mockPrisma.partner.findMany.mockResolvedValue([partner]);

            const report = await generateBPF(ORG_ID, 2025, 'Admin Test');
            const text = generateBPFTextExport(report);

            // All Cerfa sections present
            expect(text).toContain('CADRE A — IDENTIFICATION');
            expect(text).toContain('CADRE B — BILAN FINANCIER');
            expect(text).toContain('CADRE C — BILAN PÉDAGOGIQUE');
            expect(text).toContain('CADRE D — SOUS-TRAITANCE');
            expect(text).toContain('Cerfa n° 10443');

            // Organization data
            expect(text).toContain('FormaPro SAS');
            expect(text).toContain('12345678901234');
            expect(text).toContain('11755555555');

            // Financial
            expect(text).toContain('OPCO');
            expect(text).toContain('CPF');

            // Footer
            expect(text).toContain('DRIEETS');
            expect(text).toContain('Admin Test');
        });
    });

    describe('7. Scénarios E2E', () => {
        it('Full BPF generation for typical OF', async () => {
            const dossiers = [
                createMockDossier({
                    id: 'dos-1', status: 'TERMINE', tauxAssiduite: 95,
                    certificatGenere: true, factureGeneree: true,
                    contrats: [{ type: 'CONVENTION', montantHT: 4000, financeur: { type: 'OPCO' } }],
                    emargements: Array(80).fill(null).map(() => ({ estPresent: true, isFOAD: false, absenceJustifiee: false })),
                }),
                createMockDossier({
                    id: 'dos-2', status: 'TERMINE', tauxAssiduite: 88,
                    certificatGenere: true, factureGeneree: true,
                    contrats: [{ type: 'CONTRAT', montantHT: 1500, financeur: { type: 'CPF' } }],
                    emargements: Array(60).fill(null).map(() => ({ estPresent: true, isFOAD: true, absenceJustifiee: false })),
                }),
                createMockDossier({
                    id: 'dos-3', status: 'EN_COURS', tauxAssiduite: 75,
                    certificatGenere: false, factureGeneree: false,
                    contrats: [{ type: 'CONVENTION', montantHT: 3500, financeur: { type: 'ENTREPRISE' } }],
                    emargements: Array(40).fill(null).map(() => ({ estPresent: true, isFOAD: false, absenceJustifiee: false })),
                }),
                createMockDossier({
                    id: 'dos-4', status: 'ABANDONNE', tauxAssiduite: 30,
                    certificatGenere: false, factureGeneree: false,
                    contrats: [{ type: 'CONTRAT', montantHT: 2000, financeur: { type: 'PERSONNEL' } }],
                    emargements: [],
                }),
            ];

            const sessions = [createMockSession({ dossiers: dossiers.slice(0, 2) })];

            mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
            mockPrisma.dossier.findMany.mockResolvedValue(dossiers);
            mockPrisma.session.findMany.mockResolvedValue(sessions);
            mockPrisma.partner.findMany.mockResolvedValue([createMockPartner()]);

            const report = await generateBPF(ORG_ID, 2025, 'Directeur');

            // Verify completeness
            expect(report.identification.raisonSociale).toBe('FormaPro SAS');
            expect(report.bilanFinancier.produitsFormation.caTotal).toBe(11000);
            expect(report.bilanPedagogique.totalStagiaires).toBe(4);
            expect(report.bilanPedagogique.stagiairesParFinanceur.opco).toBe(1);
            expect(report.bilanPedagogique.stagiairesParFinanceur.cpf).toBe(1);
            expect(report.bilanPedagogique.stagiairesParFinanceur.entreprise).toBe(1);
            expect(report.bilanPedagogique.stagiairesParFinanceur.personnel).toBe(1);
            expect(report.bilanPedagogique.totalSessions).toBe(1);
            expect(report.sousTraitance.confiee.nbPartenaires).toBe(1);

            // Can export to text
            const text = generateBPFTextExport(report);
            expect(text.length).toBeGreaterThan(500);
        });
    });
});

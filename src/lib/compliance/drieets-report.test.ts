/**
 * TESTS RAPPORT ANNUEL DRIEETS
 * ===============================
 * Tests unitaires pour le service de rapport annuel DRIEETS.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateDRIEETSReport,
    generateDRIEETSTextExport,
    setPrismaInstance as setDRIEETSPrisma,
} from './drieets-report';
import { setPrismaInstance as setBPFPrisma } from './bpf';

// ─── Mock Prisma ──────────────────────────────────────────────

function createMockPrisma() {
    return {
        organization: { findUnique: vi.fn() },
        dossier: { findMany: vi.fn() },
        session: { findMany: vi.fn() },
        partner: { findMany: vi.fn() },
        reclamation: { findMany: vi.fn() },
        complianceAlert: { findMany: vi.fn() },
        auditLog: { findMany: vi.fn() },
    };
}

const ORG_ID = 'org-drieets-001';

const mockOrg = {
    name: 'FormaPro SAS',
    siret: '12345678901234',
    ndaNumber: '11755555555',
    type: 'OF_STANDARD',
    qualiopiCertified: true,
    qualiopiExpiry: new Date('2027-06-30'),
    responsableName: 'Jean Dupont',
    reglementInterieurUrl: '/docs/ri.pdf',
    cgvUrl: '/docs/cgv.pdf',
    livretAccueilUrl: '/docs/livret.pdf',
    signatureUrl: '/docs/signature.png',
    cachetUrl: '/docs/cachet.png',
    sites: [
        {
            id: 'site-1', name: 'Siège Paris', city: 'Paris', zipCode: '75001',
            isHeadquarters: true, uaiCode: null, isActive: true,
        },
        {
            id: 'site-2', name: 'Antenne Lyon', city: 'Lyon', zipCode: '69001',
            isHeadquarters: false, uaiCode: null, isActive: true,
        },
    ],
    members: [
        { userId: 'usr-1', role: 'ADMIN', user: { nom: 'Dupont', prenom: 'Jean', email: 'jean@test.fr' } },
        { userId: 'usr-2', role: 'RESP_PEDAGO', user: { nom: 'Martin', prenom: 'Marie', email: 'marie@test.fr' } },
        { userId: 'usr-3', role: 'FORMAT', user: { nom: 'Durand', prenom: 'Pierre', email: 'pierre@test.fr' } },
        { userId: 'usr-4', role: 'FORMAT', user: { nom: 'Lopez', prenom: 'Ana', email: 'ana@test.fr' } },
        { userId: 'usr-5', role: 'REF_QUALITE', user: { nom: 'Bernard', prenom: 'Luc', email: 'luc@test.fr' } },
    ],
    programmes: [
        {
            id: 'prg-1', reference: 'PRG-001', intitule: 'Développement Web', dureeHeures: 400,
            modalite: 'PRESENTIEL', tarifHT: 4500, isPublished: true,
            certification: { code: 'RNCP31114', intitule: 'Développeur Web' },
            sessions: [{ id: 'ses-1' }, { id: 'ses-2' }],
        },
        {
            id: 'prg-2', reference: 'PRG-002', intitule: 'Data Science', dureeHeures: 300,
            modalite: 'MIXTE', tarifHT: 3500, isPublished: true,
            certification: null,
            sessions: [{ id: 'ses-3' }],
        },
    ],
};

describe('Service Rapport Annuel DRIEETS', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
        mockPrisma = createMockPrisma();
        setDRIEETSPrisma(mockPrisma);
        setBPFPrisma(mockPrisma);
    });

    function setupDefaultMocks() {
        // For BPF service
        mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
        mockPrisma.dossier.findMany.mockResolvedValue([]);
        mockPrisma.session.findMany.mockResolvedValue([
            { id: 'ses-1', siteId: 'site-1', formateurId: 'usr-3', dossiers: [] },
            { id: 'ses-2', siteId: 'site-1', formateurId: 'usr-4', dossiers: [] },
            { id: 'ses-3', siteId: 'site-2', formateurId: 'usr-3', dossiers: [] },
        ]);
        mockPrisma.partner.findMany.mockResolvedValue([]);
        mockPrisma.reclamation.findMany.mockResolvedValue([]);
        mockPrisma.complianceAlert.findMany.mockResolvedValue([]);
        mockPrisma.auditLog.findMany.mockResolvedValue([]);
    }

    describe('1. Structure du rapport', () => {
        it('should include all sections', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report).toHaveProperty('metadata');
            expect(report).toHaveProperty('bpf');
            expect(report).toHaveProperty('sites');
            expect(report).toHaveProperty('effectifs');
            expect(report).toHaveProperty('catalogue');
            expect(report).toHaveProperty('qualite');
            expect(report).toHaveProperty('checklist');
            expect(report).toHaveProperty('synthese');
        });

        it('should set correct metadata', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025, 'Admin Test');

            expect(report.metadata.exercice).toBe(2025);
            expect(report.metadata.generatedBy).toBe('Admin Test');
        });
    });

    describe('2. Sites', () => {
        it('should list all active sites with session count', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.sites).toHaveLength(2);
            expect(report.sites[0].name).toBe('Siège Paris');
            expect(report.sites[0].isHeadquarters).toBe(true);
            expect(report.sites[0].nbSessions).toBe(2);  // ses-1, ses-2
            expect(report.sites[1].name).toBe('Antenne Lyon');
            expect(report.sites[1].nbSessions).toBe(1);  // ses-3
        });
    });

    describe('3. Effectifs', () => {
        it('should count members by role', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.effectifs.totalMembres).toBe(5);
            expect(report.effectifs.parRole['ADMIN']).toBe(1);
            expect(report.effectifs.parRole['RESP_PEDAGO']).toBe(1);
            expect(report.effectifs.parRole['FORMAT']).toBe(2);
            expect(report.effectifs.parRole['REF_QUALITE']).toBe(1);
        });

        it('should list formateurs with session count', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.effectifs.formateurs).toHaveLength(2);
            const pierre = report.effectifs.formateurs.find(f => f.nom === 'Durand');
            expect(pierre).toBeDefined();
            expect(pierre!.nbSessionsAnimees).toBe(2);  // ses-1 + ses-3
        });
    });

    describe('4. Catalogue', () => {
        it('should list programmes with session count', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.catalogue).toHaveLength(2);
            expect(report.catalogue[0].intitule).toBe('Développement Web');
            expect(report.catalogue[0].nbSessionsRealisees).toBe(2);
            expect(report.catalogue[0].certificationCode).toBe('RNCP31114');
        });
    });

    describe('5. Qualité', () => {
        it('should compute reclamation metrics', async () => {
            setupDefaultMocks();
            mockPrisma.reclamation.findMany.mockResolvedValue([
                { id: 'rec-1', dateResolution: new Date() },
                { id: 'rec-2', dateResolution: new Date() },
                { id: 'rec-3', dateResolution: null },
            ]);

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.qualite.totalReclamations).toBe(3);
            expect(report.qualite.reclamationsResolues).toBe(2);
            expect(report.qualite.reclamationsEnCours).toBe(1);
            expect(report.qualite.tauxResolution).toBe(67);
        });

        it('should compute compliance alert metrics', async () => {
            setupDefaultMocks();
            mockPrisma.complianceAlert.findMany.mockResolvedValue([
                { ruleId: 'RULE_CPF', severity: 'BLOCKING', isResolved: true },
                { ruleId: 'RULE_CPF', severity: 'BLOCKING', isResolved: false },
                { ruleId: 'RULE_CERTIF', severity: 'WARNING', isResolved: true },
            ]);

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.qualite.complianceAlerts.total).toBe(3);
            expect(report.qualite.complianceAlerts.resolved).toBe(2);
            expect(report.qualite.complianceAlerts.unresolved).toBe(1);
            expect(report.qualite.complianceAlerts.bySeverity['BLOCKING']).toBe(2);
        });

        it('should count audit forçages', async () => {
            setupDefaultMocks();
            mockPrisma.auditLog.findMany.mockResolvedValue([
                { action: 'UPDATE', isForced: true },
                { action: 'UPDATE', isForced: false },
                { action: 'CREATE', isForced: false },
            ]);

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.qualite.auditActions.total).toBe(3);
            expect(report.qualite.auditActions.forcages).toBe(1);
        });
    });

    describe('6. Checklist réglementaire', () => {
        it('should validate all regulatory obligations', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            const checkLabels = report.checklist.map(c => c.label);
            expect(checkLabels).toContain("Numéro de Déclaration d'Activité (NDA)");
            expect(checkLabels).toContain('SIRET valide');
            expect(checkLabels).toContain('Certification Qualiopi');
            expect(checkLabels).toContain('Règlement intérieur');
            expect(checkLabels).toContain('Conditions Générales de Vente (CGV)');
            expect(checkLabels).toContain("Livret d'accueil");
            expect(checkLabels).toContain('Responsable pédagogique désigné');
            expect(checkLabels).toContain('Référent qualité désigné');
        });

        it('should mark OK items when documents present', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            const nda = report.checklist.find(c => c.label.includes('NDA'));
            expect(nda?.status).toBe('OK');

            const ri = report.checklist.find(c => c.label.includes('Règlement'));
            expect(ri?.status).toBe('OK');

            const respPedago = report.checklist.find(c => c.label.includes('Responsable pédagogique'));
            expect(respPedago?.status).toBe('OK');
        });

        it('should mark KO items when documents missing', async () => {
            const orgMissing = {
                ...mockOrg,
                ndaNumber: null,
                reglementInterieurUrl: null,
                cgvUrl: null,
                livretAccueilUrl: null,
                members: [
                    { userId: 'usr-1', role: 'ADMIN', user: { nom: 'A', prenom: 'B', email: 'a@b.c' } },
                ],
            };
            mockPrisma.organization.findUnique.mockResolvedValue(orgMissing);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);
            mockPrisma.reclamation.findMany.mockResolvedValue([]);
            mockPrisma.complianceAlert.findMany.mockResolvedValue([]);
            mockPrisma.auditLog.findMany.mockResolvedValue([]);

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            const nda = report.checklist.find(c => c.label.includes('NDA'));
            expect(nda?.status).toBe('KO');

            const ri = report.checklist.find(c => c.label.includes('Règlement'));
            expect(ri?.status).toBe('KO');

            const respPedago = report.checklist.find(c => c.label.includes('Responsable pédagogique'));
            expect(respPedago?.status).toBe('KO');
        });
    });

    describe('7. Synthèse auto', () => {
        it('should generate strengths when compliance is good', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.synthese.pointsForts.length).toBeGreaterThan(0);
            expect(report.synthese.pointsForts).toContainEqual(
                expect.stringContaining('obligations réglementaires'),
            );
        });

        it('should generate warnings for KO items', async () => {
            const orgMissing = {
                ...mockOrg,
                ndaNumber: null,
                cgvUrl: null,
                members: [
                    { userId: 'usr-1', role: 'ADMIN', user: { nom: 'A', prenom: 'B', email: 'a@b.c' } },
                ],
            };
            mockPrisma.organization.findUnique.mockResolvedValue(orgMissing);
            mockPrisma.dossier.findMany.mockResolvedValue([]);
            mockPrisma.session.findMany.mockResolvedValue([]);
            mockPrisma.partner.findMany.mockResolvedValue([]);
            mockPrisma.reclamation.findMany.mockResolvedValue([]);
            mockPrisma.complianceAlert.findMany.mockResolvedValue([]);
            mockPrisma.auditLog.findMany.mockResolvedValue([]);

            const report = await generateDRIEETSReport(ORG_ID, 2025);

            expect(report.synthese.pointsVigilance.length).toBeGreaterThan(0);
            expect(report.synthese.recommandations.length).toBeGreaterThan(0);
        });
    });

    describe('8. Export texte', () => {
        it('should generate a complete text report', async () => {
            setupDefaultMocks();

            const report = await generateDRIEETSReport(ORG_ID, 2025, 'Admin');
            const text = generateDRIEETSTextExport(report);

            expect(text).toContain('RAPPORT ANNUEL');
            expect(text).toContain('DRIEETS');
            expect(text).toContain('SITES DE FORMATION');
            expect(text).toContain('EFFECTIFS');
            expect(text).toContain('CATALOGUE');
            expect(text).toContain('RÉSUMÉ BPF');
            expect(text).toContain('INDICATEURS QUALITÉ');
            expect(text).toContain('CHECKLIST RÉGLEMENTAIRE');
            expect(text).toContain('SYNTHÈSE');
            expect(text).toContain('FormaPro SAS');
        });
    });
});

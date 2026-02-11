/**
 * TESTS — REGISTRE RGPD ART. 30
 * ================================
 * Validation du service de génération du registre des traitements.
 * 
 * @Compliance: RGPD Art. 30
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = mockDeep<PrismaClient>();

import {
    generateRegister,
    getRegisterStats,
    setPrismaInstance,
} from '@/lib/prospection/rgpd-register';

describe('Registre RGPD Art. 30', () => {
    beforeEach(() => {
        mockReset(prismaMock);
        setPrismaInstance(prismaMock);
    });

    describe('Génération du registre', () => {

        it('should generate register without organizationId', async () => {
            const register = await generateRegister();

            expect(register).not.toBeNull();
            expect(register.metadata).toBeDefined();
            expect(register.controller).toBeDefined();
            expect(register.dpo).toBeDefined();
            expect(register.treatments).toBeInstanceOf(Array);
            expect(register.treatments.length).toBeGreaterThanOrEqual(5);
            expect(register.version).toBe('1.0.0');
        });

        it('should generate register with organizationId', async () => {
            prismaMock.organization.findUnique.mockResolvedValue({
                id: 'org-001',
                name: 'Formation Pro SAS',
            } as any);

            prismaMock.partner.findMany.mockResolvedValue([
                { companyName: 'Partenaire A', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                { companyName: 'Partenaire B', dpaSignedAt: null, contractSignedAt: new Date(), contractExpiresAt: null },
            ] as any);

            const register = await generateRegister('org-001');

            expect(register.metadata.organizationName).toBe('Formation Pro SAS');
            expect(register.metadata.organizationId).toBe('org-001');
        });

        it('should have all required fields per treatment (Art. 30 compliance)', async () => {
            const register = await generateRegister();

            for (const t of register.treatments) {
                // Art. 30(1) — Champs obligatoires
                expect(t.id).toBeTruthy();
                expect(t.name).toBeTruthy();
                expect(t.description).toBeTruthy();
                expect(t.purpose.length).toBeGreaterThan(0);          // Finalités
                expect(t.legalBasis).toBeTruthy();                     // Base légale
                expect(t.legalBasisDetail).toBeTruthy();
                expect(t.dataCategories.length).toBeGreaterThan(0);    // Catégories de données
                expect(t.dataConcernedPersons.length).toBeGreaterThan(0); // Personnes concernées
                expect(t.recipients.length).toBeGreaterThan(0);        // Destinataires
                expect(t.retentionPeriod).toBeTruthy();                // Durée de conservation
                expect(t.retentionDetail).toBeTruthy();
                expect(t.securityMeasures.length).toBeGreaterThan(0);  // Mesures de sécurité
                expect(t.transfersOutsideEU).toBeInstanceOf(Array);    // Transferts hors UE
                expect(t.dpia).toBeDefined();                          // AIPD
                expect(t.status).toBeTruthy();
                expect(t.lastReviewDate).toBeTruthy();
            }
        });

        it('should contain the 5 core treatments', async () => {
            const register = await generateRegister();

            const names = register.treatments.map(t => t.name);
            expect(names).toContain('Gestion des dossiers de formation');
            expect(names).toContain('Prospection commerciale — Gestion des leads');
            expect(names).toContain('Sous-traitance — Partenaires apporteurs d\'affaires');
            expect(names).toContain('Gestion des utilisateurs et authentification');
            expect(names).toContain('Journal d\'audit et traçabilité');
        });

        it('should have unique treatment IDs', async () => {
            const register = await generateRegister();
            const ids = register.treatments.map(t => t.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should enrich partner recipients dynamically', async () => {
            prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-001', name: 'Test Org' } as any);
            prismaMock.partner.findMany.mockResolvedValue([
                { companyName: 'DataCorp', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                { companyName: 'LeadGen SAS', dpaSignedAt: null, contractSignedAt: new Date(), contractExpiresAt: null },
            ] as any);

            const register = await generateRegister('org-001');

            // Le traitement Prospection (#2) doit contenir les partenaires comme SUBPROCESSOR
            const prospection = register.treatments.find(t => t.name.includes('Prospection'));
            expect(prospection).toBeDefined();

            const subProcessors = prospection!.recipients.filter(r => r.type === 'SUBPROCESSOR');
            expect(subProcessors.length).toBe(2);
            expect(subProcessors[0].name).toBe('DataCorp');
            expect(subProcessors[0].dpaStatus).toBe('SIGNED');
            expect(subProcessors[1].name).toBe('LeadGen SAS');
            expect(subProcessors[1].dpaStatus).toBe('PENDING');
        });

        it('should provide correct legal bases', async () => {
            const register = await generateRegister();

            const formations = register.treatments.find(t => t.name.includes('dossiers de formation'));
            expect(formations!.legalBasis).toContain('Art. 6.1.b');

            const leads = register.treatments.find(t => t.name.includes('Prospection'));
            expect(leads!.legalBasis).toContain('Art. 6.1.a');

            const partners = register.treatments.find(t => t.name.includes('Sous-traitance'));
            expect(partners!.legalBasis).toContain('Art. 6.1.f');

            const audit = register.treatments.find(t => t.name.includes('audit'));
            expect(audit!.legalBasis).toContain('Art. 6.1.c');
        });
    });

    describe('Statistiques du registre', () => {

        it('should compute register stats', async () => {
            prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-001', name: 'Test' } as any);
            prismaMock.partner.findMany.mockResolvedValue([
                { companyName: 'P1', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                { companyName: 'P2', dpaSignedAt: null, contractSignedAt: new Date(), contractExpiresAt: null },
            ] as any);

            const stats = await getRegisterStats('org-001');

            expect(stats.totalTreatments).toBeGreaterThanOrEqual(5);
            expect(stats.activeTreatments).toBeGreaterThanOrEqual(5);
            expect(stats.subProcessors).toBeGreaterThanOrEqual(2);
            expect(stats.dpaSigned).toBeGreaterThanOrEqual(1);
            expect(stats.dpaPending).toBeGreaterThanOrEqual(1);
            expect(stats.dpaPendingNames).toContain('P2');
            expect(stats.totalDataCategories).toBeGreaterThan(0);
            expect(stats.transfersOutsideEU).toBe(0);
            expect(stats.dpoDesignated).toBe(false);
            expect(stats.lastUpdate).toBeTruthy();
        });

        it('should report 0 subprocessors when no partners', async () => {
            prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-001', name: 'Test' } as any);
            prismaMock.partner.findMany.mockResolvedValue([]);

            const stats = await getRegisterStats('org-001');
            expect(stats.dpaPending).toBe(0);
            expect(stats.dpaSigned).toBe(0);
        });
    });

    describe('Structure CNIL', () => {

        it('should include metadata conforming to CNIL model', async () => {
            const register = await generateRegister();

            expect(register.metadata.registerVersion).toBeTruthy();
            expect(register.metadata.lastUpdate).toBeTruthy();
            expect(register.metadata.generatedBy).toContain('Polyx');
            expect(register.metadata.cnilReference).toContain('CNIL');
        });

        it('should include controller and DPO sections', async () => {
            const register = await generateRegister();

            expect(register.controller).toBeDefined();
            expect(register.controller.name).toBeTruthy();
            expect(register.dpo).toBeDefined();
            expect(typeof register.dpo.designated).toBe('boolean');
        });

        it('should specify data sensitivity levels', async () => {
            const register = await generateRegister();

            const allCategories = register.treatments.flatMap(t => t.dataCategories);
            for (const cat of allCategories) {
                expect(['STANDARD', 'SENSITIVE', 'HIGHLY_SENSITIVE']).toContain(cat.sensitivity);
            }
        });

        it('should include retention periods for all treatments', async () => {
            const register = await generateRegister();

            for (const t of register.treatments) {
                expect(t.retentionPeriod).toBeTruthy();
                expect(t.retentionDetail).toBeTruthy();
            }
        });
    });
});

/**
 * TESTS — QUALIFICATION PARTENAIRE (Qualiopi Ind. 17 & 26)
 * ============================================================
 * Validation du scoring, des guards d'ingestion et de la checklist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = mockDeep<PrismaClient>();

import {
    computeQualificationScore,
    checkPartnerQualification,
    evaluatePartner,
    evaluateAllPartners,
    updatePartnerDocuments,
    recordConvention,
    getQualificationStats,
    setPrismaInstance,
    QUALIFICATION_THRESHOLD,
    MAX_SCORE,
    SCORING_GRID,
} from '@/lib/prospection/partner-qualification';

describe('Qualification Partenaire — Qualiopi Ind. 17 & 26', () => {
    beforeEach(() => {
        mockReset(prismaMock);
        setPrismaInstance(prismaMock);
    });

    // ─────────────────────────────────────────────────────────
    // 1. Scoring Engine
    // ─────────────────────────────────────────────────────────

    describe('1. Scoring Engine', () => {

        it('should compute max score (100) for fully qualified partner', () => {
            const result = computeQualificationScore(
                {
                    companyName: 'Test SAS',
                    dpaSignedAt: new Date(),
                    contractSignedAt: new Date(),
                    contractExpiresAt: null,
                },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    hasKbis: true,
                    hasRcPro: true,
                    hasUrssaf: true,
                    hasReferences: true,
                    hasCertifications: true,
                    hasQualityCharter: true,
                },
            );

            expect(result.score).toBe(MAX_SCORE); // 100
            expect(result.grade).toBe('A');
            expect(result.isQualified).toBe(true);
            expect(result.missingCriteria).toHaveLength(0);
            expect(result.alerts).toHaveLength(0);
        });

        it('should compute 0 for partner with nothing', () => {
            const result = computeQualificationScore(
                {
                    companyName: 'Empty Corp',
                    dpaSignedAt: null,
                    contractSignedAt: null,
                    contractExpiresAt: null,
                },
                null,
            );

            expect(result.score).toBe(0);
            expect(result.grade).toBe('D');
            expect(result.isQualified).toBe(false);
            expect(result.missingCriteria.length).toBe(Object.keys(SCORING_GRID).length);
        });

        it('should give grade B for partial qualification (≥60)', () => {
            const result = computeQualificationScore(
                {
                    companyName: 'Partial SAS',
                    dpaSignedAt: new Date(),      // +15
                    contractSignedAt: new Date(),  // +10
                    contractExpiresAt: null,
                },
                {
                    conventionSignedAt: new Date(), // +20
                    conventionExpiresAt: null,
                    hasKbis: true,                  // +10
                    hasRcPro: true,                 // +15 → Total = 70
                    hasUrssaf: false,
                    hasReferences: false,
                    hasCertifications: false,
                    hasQualityCharter: false,
                },
            );

            expect(result.score).toBe(70);
            expect(result.grade).toBe('B');
            expect(result.isQualified).toBe(true);
        });

        it('should detect expired convention and remove points', () => {
            const result = computeQualificationScore(
                {
                    companyName: 'Expired Conv',
                    dpaSignedAt: new Date(),
                    contractSignedAt: new Date(),
                    contractExpiresAt: null,
                },
                {
                    conventionSignedAt: new Date('2024-01-01'),
                    conventionExpiresAt: new Date('2025-12-31'), // Expired
                    hasKbis: true,
                    hasRcPro: true,
                    hasUrssaf: false,
                    hasReferences: false,
                    hasCertifications: false,
                    hasQualityCharter: false,
                },
            );

            // Convention points should be 0 due to expiration
            const conventionDetail = result.details.find(d => d.criterion === 'conventionSigned');
            expect(conventionDetail?.points).toBe(0);
            expect(conventionDetail?.met).toBe(false);
            expect(result.alerts).toContain('Convention de sous-traitance expirée');
        });

        it('should detect expired RC Pro', () => {
            const result = computeQualificationScore(
                {
                    companyName: 'RC Expired',
                    dpaSignedAt: new Date(),
                    contractSignedAt: new Date(),
                    contractExpiresAt: null,
                },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    hasKbis: true,
                    hasRcPro: true,
                    hasUrssaf: true,
                    hasReferences: true,
                    hasCertifications: true,
                    hasQualityCharter: true,
                    rcProExpiresAt: new Date('2025-01-01'), // Expired
                },
            );

            const rcDetail = result.details.find(d => d.criterion === 'hasRcPro');
            expect(rcDetail?.points).toBe(0);
            expect(result.alerts).toContain('RC Pro expirée');
        });

        it('should detect URSSAF older than 6 months', () => {
            const sevenMonthsAgo = new Date();
            sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

            const result = computeQualificationScore(
                {
                    companyName: 'URSSAF Old',
                    dpaSignedAt: new Date(),
                    contractSignedAt: new Date(),
                    contractExpiresAt: null,
                },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    hasKbis: true,
                    hasRcPro: true,
                    hasUrssaf: true,
                    hasReferences: true,
                    hasCertifications: true,
                    hasQualityCharter: true,
                    urssafDate: sevenMonthsAgo,
                },
            );

            const urssafDetail = result.details.find(d => d.criterion === 'hasUrssaf');
            expect(urssafDetail?.points).toBe(0);
            expect(result.alerts).toContain('Attestation URSSAF de plus de 6 mois');
        });

        it('should detect expired contract', () => {
            const result = computeQualificationScore(
                {
                    companyName: 'Expired Contract',
                    dpaSignedAt: new Date(),
                    contractSignedAt: new Date('2024-01-01'),
                    contractExpiresAt: new Date('2025-01-01'), // Expired
                },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    hasKbis: true,
                    hasRcPro: true,
                    hasUrssaf: true,
                    hasReferences: true,
                    hasCertifications: true,
                    hasQualityCharter: true,
                },
            );

            const contractDetail = result.details.find(d => d.criterion === 'contractSigned');
            expect(contractDetail?.points).toBe(0);
            expect(result.alerts).toContain('Contrat commercial expiré');
        });

        it('should have exactly 9 scoring criteria', () => {
            expect(Object.keys(SCORING_GRID).length).toBe(9);
        });

        it('max score should be 100', () => {
            expect(MAX_SCORE).toBe(100);
        });

        it('qualification threshold should be 60', () => {
            expect(QUALIFICATION_THRESHOLD).toBe(60);
        });
    });

    // ─────────────────────────────────────────────────────────
    // 2. Guard d'Ingestion (checkPartnerQualification)
    // ─────────────────────────────────────────────────────────

    describe('2. Guard Ingestion Qualiopi', () => {

        it('should allow fully qualified partner', () => {
            const result = checkPartnerQualification(
                { companyName: 'OK', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    isQualified: true,
                    qualificationScore: 80,
                    hasKbis: true, hasRcPro: true, hasUrssaf: true,
                    hasReferences: true, hasCertifications: true, hasQualityCharter: true,
                },
            );
            expect(result).toBeNull(); // OK
        });

        it('should reject partner without convention (Ind. 17)', () => {
            const result = checkPartnerQualification(
                { companyName: 'No Conv', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                {
                    conventionSignedAt: null,
                    conventionExpiresAt: null,
                    isQualified: true,
                    qualificationScore: 70,
                    hasKbis: true, hasRcPro: true, hasUrssaf: true,
                    hasReferences: true, hasCertifications: true, hasQualityCharter: true,
                },
            );
            expect(result).not.toBeNull();
            expect(result!.code).toBe('QUALIOPI_CONVENTION_MISSING');
        });

        it('should reject partner with expired convention', () => {
            const result = checkPartnerQualification(
                { companyName: 'Exp Conv', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                {
                    conventionSignedAt: new Date('2024-01-01'),
                    conventionExpiresAt: new Date('2025-01-01'), // Expired
                    isQualified: true,
                    qualificationScore: 70,
                    hasKbis: true, hasRcPro: true, hasUrssaf: true,
                    hasReferences: true, hasCertifications: true, hasQualityCharter: true,
                },
            );
            expect(result).not.toBeNull();
            expect(result!.code).toBe('QUALIOPI_CONVENTION_EXPIRED');
        });

        it('should reject non-qualified partner (score < 60)', () => {
            const result = checkPartnerQualification(
                { companyName: 'Low Score', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    isQualified: false,
                    qualificationScore: 35,
                    hasKbis: false, hasRcPro: false, hasUrssaf: false,
                    hasReferences: false, hasCertifications: false, hasQualityCharter: false,
                },
            );
            expect(result).not.toBeNull();
            expect(result!.code).toBe('QUALIOPI_SCORE_INSUFFICIENT');
            expect(result!.message).toContain('35');
        });

        it('should allow partner without qualification record (retrocompat)', () => {
            const result = checkPartnerQualification(
                { companyName: 'Legacy', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                null,
            );
            // Rétrocompatibilité : pas de blocage si pas encore évalué
            expect(result).toBeNull();
        });
    });

    // ─────────────────────────────────────────────────────────
    // 3. Database Operations
    // ─────────────────────────────────────────────────────────

    describe('3. Évaluation & Persistance', () => {

        it('should evaluate and persist qualification', async () => {
            prismaMock.partner.findUniqueOrThrow.mockResolvedValue({
                id: 'p-001',
                companyName: 'Test SAS',
                organizationId: 'org-001',
                dpaSignedAt: new Date(),
                contractSignedAt: new Date(),
                contractExpiresAt: null,
                qualification: {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    hasKbis: true,
                    hasRcPro: true,
                    hasUrssaf: true,
                    hasReferences: true,
                    hasCertifications: false,
                    hasQualityCharter: false,
                },
            } as any);

            prismaMock.partnerQualification.upsert.mockResolvedValue({} as any);

            const result = await evaluatePartner('p-001', 'admin@test.com', 'Évaluation annuelle');

            expect(result.partnerId).toBe('p-001');
            expect(result.score).toBe(90); // All except certif (5) and charter (5)
            expect(result.grade).toBe('A');
            expect(result.isQualified).toBe(true);

            // Vérifie que upsert a été appelé
            expect(prismaMock.partnerQualification.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { partnerId: 'p-001' },
                    create: expect.objectContaining({
                        qualificationScore: 90,
                        qualificationGrade: 'A',
                        isQualified: true,
                    }),
                }),
            );
        });

        it('should evaluate all partners in organization', async () => {
            prismaMock.partner.findMany.mockResolvedValue([
                {
                    id: 'p-001', companyName: 'A', organizationId: 'org-001',
                    dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null,
                    qualification: {
                        conventionSignedAt: new Date(), conventionExpiresAt: null,
                        hasKbis: true, hasRcPro: true, hasUrssaf: true,
                        hasReferences: true, hasCertifications: true, hasQualityCharter: true,
                    },
                },
                {
                    id: 'p-002', companyName: 'B', organizationId: 'org-001',
                    dpaSignedAt: null, contractSignedAt: null, contractExpiresAt: null,
                    qualification: null,
                },
            ] as any);

            prismaMock.partnerQualification.upsert.mockResolvedValue({} as any);

            const results = await evaluateAllPartners('org-001');
            expect(results).toHaveLength(2);
            expect(results[0].score).toBe(100);
            expect(results[1].score).toBe(0);
        });

        it('should update documents and re-evaluate', async () => {
            prismaMock.partner.findUniqueOrThrow
                .mockResolvedValueOnce({ id: 'p-001', organizationId: 'org-001' } as any)
                .mockResolvedValueOnce({
                    id: 'p-001', organizationId: 'org-001', companyName: 'Test',
                    dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null,
                    qualification: {
                        conventionSignedAt: new Date(), conventionExpiresAt: null,
                        hasKbis: true, hasRcPro: true, hasUrssaf: false,
                        hasReferences: false, hasCertifications: false, hasQualityCharter: false,
                    },
                } as any);

            prismaMock.partnerQualification.upsert.mockResolvedValue({} as any);

            const result = await updatePartnerDocuments('p-001', {
                hasKbis: true,
                hasRcPro: true,
            });

            // Vérifie qu'on a upsert 2 fois : 1x pour docs, 1x pour re-évaluation
            expect(prismaMock.partnerQualification.upsert).toHaveBeenCalledTimes(2);
            expect(result.partnerId).toBe('p-001');
        });

        it('should record convention (Ind. 17)', async () => {
            prismaMock.partner.findUniqueOrThrow
                .mockResolvedValueOnce({ id: 'p-001', organizationId: 'org-001' } as any)
                .mockResolvedValueOnce({
                    id: 'p-001', organizationId: 'org-001', companyName: 'Test',
                    dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null,
                    qualification: {
                        conventionSignedAt: new Date(), conventionExpiresAt: null,
                        hasKbis: true, hasRcPro: true, hasUrssaf: true,
                        hasReferences: false, hasCertifications: false, hasQualityCharter: false,
                    },
                } as any);

            prismaMock.partnerQualification.upsert.mockResolvedValue({} as any);

            const result = await recordConvention('p-001', {
                signedAt: new Date(),
                type: 'PROSPECTION',
            });

            expect(result.conventionStatus).toBe('SIGNED');
        });
    });

    // ─────────────────────────────────────────────────────────
    // 4. Statistiques
    // ─────────────────────────────────────────────────────────

    describe('4. Statistiques Qualification', () => {

        it('should compute organization-wide stats', async () => {
            prismaMock.partner.findMany.mockResolvedValue([
                {
                    id: 'p-001', companyName: 'A',
                    dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null,
                    qualification: {
                        conventionSignedAt: new Date(), conventionExpiresAt: null,
                        hasKbis: true, hasRcPro: true, hasUrssaf: true,
                        hasReferences: true, hasCertifications: true, hasQualityCharter: true,
                        nextReviewAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
                    },
                },
                {
                    id: 'p-002', companyName: 'B',
                    dpaSignedAt: null, contractSignedAt: null, contractExpiresAt: null,
                    qualification: null,
                },
                {
                    id: 'p-003', companyName: 'C',
                    dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null,
                    qualification: {
                        conventionSignedAt: new Date('2024-01-01'),
                        conventionExpiresAt: new Date('2025-01-01'), // Expired
                        hasKbis: true, hasRcPro: false, hasUrssaf: false,
                        hasReferences: false, hasCertifications: false, hasQualityCharter: false,
                        nextReviewAt: null,
                    },
                },
            ] as any);

            const stats = await getQualificationStats('org-001');

            expect(stats.total).toBe(3);
            expect(stats.qualified).toBe(1);       // Only A with score 100
            expect(stats.nonQualified).toBe(2);     // B (0) and C (< 60)
            expect(stats.avgScore).toBeGreaterThan(0);
            expect(stats.gradeDistribution.A).toBe(1);
            expect(stats.gradeDistribution.D).toBeGreaterThanOrEqual(1);
            expect(stats.conventionsSigned).toBe(1);
            expect(stats.conventionsMissing).toBe(1);
            expect(stats.conventionsExpired).toBe(1);
            expect(stats.commonMissing.length).toBeGreaterThan(0);
            expect(stats.reviewsDueSoon).toBe(1); // Partner A has review in 10 days
        });

        it('should handle empty organization', async () => {
            prismaMock.partner.findMany.mockResolvedValue([]);

            const stats = await getQualificationStats('org-empty');

            expect(stats.total).toBe(0);
            expect(stats.qualified).toBe(0);
            expect(stats.avgScore).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────
    // 5. Edge Cases
    // ─────────────────────────────────────────────────────────

    describe('5. Edge Cases', () => {

        it('should handle partner with all documents but no convention', () => {
            const result = computeQualificationScore(
                { companyName: 'No Conv', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                {
                    conventionSignedAt: null, // Missing!
                    conventionExpiresAt: null,
                    hasKbis: true, hasRcPro: true, hasUrssaf: true,
                    hasReferences: true, hasCertifications: true, hasQualityCharter: true,
                },
            );

            // Score should be MAX - convention (20) = 80
            expect(result.score).toBe(80);
            expect(result.grade).toBe('A');
            expect(result.conventionStatus).toBe('MISSING');
        });

        it('should handle partner with convention but no documents', () => {
            const result = computeQualificationScore(
                { companyName: 'Conv Only', dpaSignedAt: new Date(), contractSignedAt: new Date(), contractExpiresAt: null },
                {
                    conventionSignedAt: new Date(),
                    conventionExpiresAt: null,
                    hasKbis: false, hasRcPro: false, hasUrssaf: false,
                    hasReferences: false, hasCertifications: false, hasQualityCharter: false,
                },
            );

            // Convention (20) + DPA (15) + Contract (10) = 45
            expect(result.score).toBe(45);
            expect(result.grade).toBe('C');
            expect(result.isQualified).toBe(false);
        });

        it('should tag each detail with correct category', () => {
            const result = computeQualificationScore(
                { companyName: 'Test', dpaSignedAt: null, contractSignedAt: null, contractExpiresAt: null },
                null,
            );

            const categories = new Set(result.details.map(d => d.category));
            expect(categories.has('Ind. 17')).toBe(true);
            expect(categories.has('RGPD')).toBe(true);
            expect(categories.has('Contractuel')).toBe(true);
            expect(categories.has('Ind. 26')).toBe(true);
        });
    });
});

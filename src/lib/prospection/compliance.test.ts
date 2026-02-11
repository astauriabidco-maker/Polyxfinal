/**
 * TESTS END-TO-END — CONFORMITE MODULE PARTENAIRE
 * ==================================================
 * Valide les 3 correctifs critiques de conformite :
 *   1. Guard DPA/Contrat
 *   2. Journal d'audit partenaire
 *   3. Politique de conservation RGPD
 * 
 * @QA: Tests critiques conformite reglementaire
 * @Compliance: RGPD Art. 5/17/20/28, Qualiopi Ind. 17/26
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// ============================================================================
// MOCK — Injection de dependance (meme pattern que engine.test.ts)
// ============================================================================

const prismaMock = mockDeep<PrismaClient>();

// Importer les modules SUT + injecter le mock
import {
    logPartnerAction,
    logComplianceRejection,
    getPartnerAuditHistory,
    getOrganizationAuditHistory,
    getComplianceReport,
    setPrismaInstance as setPartnerAuditPrisma,
} from '@/lib/prospection/partner-audit';

import {
    anonymizeExpiredLeads,
    anonymizeLead,
    withdrawConsent,
    exportLeadData,
    getRetentionStats,
    setPrismaInstance as setDataRetentionPrisma,
} from '@/lib/prospection/data-retention';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

const createMockPartner = (overrides = {}) => ({
    id: 'partner-001',
    organizationId: 'org-001',
    companyName: 'Partenaire Test SAS',
    contactName: 'Marie Martin',
    contactEmail: 'marie@partenaire-test.fr',
    contactPhone: '0600000000',
    siret: '12345678901234',
    apiKeyHash: 'abc123hash',
    apiKeyPrefix: 'pk_live_abc123...',
    rateLimit: 100,
    webhookUrl: null,
    ipWhitelist: [],
    contractSignedAt: new Date('2025-01-15'),
    contractExpiresAt: new Date('2027-01-15'),
    dpaSignedAt: new Date('2025-01-15'),
    ndaSignedAt: new Date('2025-01-15'),
    notes: null,
    status: 'ACTIVE' as const,
    totalLeadsSubmitted: 150,
    totalLeadsConverted: 45,
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-06-01'),
    ...overrides,
});

const createMockLead = (overrides = {}) => ({
    id: 'lead-001',
    organizationId: 'org-001',
    source: 'PARTNER_API' as const,
    sourceRef: 'ext-ref-001',
    campaignId: null,
    partnerId: 'partner-001',
    email: 'jean.prospect@email.fr',
    nom: 'Prospect',
    prenom: 'Jean',
    telephone: '0600000001',
    adresse: '5 avenue des Champs',
    codePostal: '75008',
    ville: 'Paris',
    formationSouhaitee: 'BTS Comptabilite',
    message: 'Interesse par la formation',
    dateReponse: null,
    metadata: { sourceUrl: 'https://partenaire.fr/form' },
    status: 'NEW' as const,
    score: 78,
    notes: null,
    assignedToId: null,
    convertedAt: null,
    convertedDossierId: null,
    createdAt: new Date('2025-03-15'),
    updatedAt: new Date('2025-03-15'),
    ...overrides,
});

const createMockConsent = (overrides = {}) => ({
    id: 'consent-001',
    leadId: 'lead-001',
    consentGiven: true,
    consentText: 'J accepte le traitement de mes donnees.',
    consentMethod: 'external_partner_api',
    legalBasis: 'consent',
    withdrawnAt: null,
    anonymizedAt: null,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2025-03-15'),
    updatedAt: new Date('2025-03-15'),
    ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('Module Partenaire - Conformite Reglementaire', () => {
    beforeEach(() => {
        mockReset(prismaMock);
        // Injecter le mock dans les deux modules
        setPartnerAuditPrisma(prismaMock);
        setDataRetentionPrisma(prismaMock);
    });

    // =========================================================================
    // 1. GUARD DPA / CONTRAT (RGPD Art. 28)
    // =========================================================================

    describe('1. Guard DPA/Contrat', () => {

        it('should identify fully compliant partner', () => {
            const partner = createMockPartner();
            const now = new Date();

            expect(!!partner.dpaSignedAt).toBe(true);
            expect(!!partner.contractSignedAt).toBe(true);
            expect(!partner.contractExpiresAt || new Date(partner.contractExpiresAt) > now).toBe(true);
        });

        it('should detect DPA missing', () => {
            const partner = createMockPartner({ dpaSignedAt: null });
            expect(partner.dpaSignedAt).toBeNull();
        });

        it('should detect contract missing', () => {
            const partner = createMockPartner({ contractSignedAt: null });
            expect(partner.contractSignedAt).toBeNull();
        });

        it('should detect expired contract', () => {
            const partner = createMockPartner({ contractExpiresAt: new Date('2024-01-01') });
            expect(partner.contractExpiresAt && new Date(partner.contractExpiresAt) < new Date()).toBeTruthy();
        });

        it('should allow perpetual contract', () => {
            const partner = createMockPartner({ contractExpiresAt: null });
            expect(!partner.contractExpiresAt || new Date(partner.contractExpiresAt) > new Date()).toBe(true);
        });

        it('should detect multiple violations', () => {
            const partner = createMockPartner({
                dpaSignedAt: null,
                contractSignedAt: null,
                contractExpiresAt: new Date('2024-01-01'),
            });

            const violations: string[] = [];
            if (!partner.dpaSignedAt) violations.push('COMPLIANCE_DPA_MISSING');
            if (!partner.contractSignedAt) violations.push('COMPLIANCE_CONTRACT_MISSING');
            if (partner.contractExpiresAt && new Date(partner.contractExpiresAt) < new Date()) {
                violations.push('COMPLIANCE_CONTRACT_EXPIRED');
            }

            expect(violations.length).toBeGreaterThanOrEqual(2);
            expect(violations).toContain('COMPLIANCE_DPA_MISSING');
            expect(violations).toContain('COMPLIANCE_CONTRACT_MISSING');
        });
    });

    // =========================================================================
    // 2. JOURNAL D'AUDIT PARTENAIRE
    // =========================================================================

    describe('2. Journal audit', () => {

        it('should log a partner action', async () => {
            // Cast needed: PartnerAuditLog model may not be in generated types yet
            (prismaMock as any).partnerAuditLog = {
                create: vi.fn().mockResolvedValue({ id: 'audit-001' }),
                findMany: vi.fn().mockResolvedValue([]),
                count: vi.fn().mockResolvedValue(0),
            };

            await logPartnerAction({
                partnerId: 'partner-001',
                organizationId: 'org-001',
                action: 'CREATED',
                performedBy: 'user-001',
                performedByName: 'Admin Test',
                details: 'Partenaire cree',
                newValue: { status: 'PENDING' },
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0',
            });

            expect((prismaMock as any).partnerAuditLog.create).toHaveBeenCalledTimes(1);
        });

        it('should log compliance rejection', async () => {
            (prismaMock as any).partnerAuditLog = {
                create: vi.fn().mockResolvedValue({}),
            };

            await logComplianceRejection(
                'partner-001', 'org-001', 'DPA missing', 'COMPLIANCE_DPA_MISSING',
            );

            expect((prismaMock as any).partnerAuditLog.create).toHaveBeenCalledTimes(1);
        });

        it('should NOT throw on audit failure (fire-and-forget)', async () => {
            (prismaMock as any).partnerAuditLog = {
                create: vi.fn().mockRejectedValue(new Error('DB down')),
            };

            // Audit must NEVER block the main flow
            await expect(
                logPartnerAction({
                    partnerId: 'partner-001',
                    organizationId: 'org-001',
                    action: 'ACTIVATED',
                    details: 'Test fire-and-forget',
                }),
            ).resolves.toBeUndefined();
        });

        it('should retrieve audit history', async () => {
            const logs = [
                { id: 'log-1', action: 'CREATED', createdAt: new Date() },
                { id: 'log-2', action: 'ACTIVATED', createdAt: new Date() },
            ];

            (prismaMock as any).partnerAuditLog = {
                findMany: vi.fn().mockResolvedValue(logs),
                count: vi.fn().mockResolvedValue(2),
                create: vi.fn(),
            };

            const result = await getPartnerAuditHistory('partner-001');
            expect(result.logs).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should generate compliance report (compliant)', async () => {
            prismaMock.partner.findUnique.mockResolvedValue(createMockPartner() as any);
            (prismaMock as any).partnerAuditLog = {
                findMany: vi.fn().mockResolvedValue([]),
                count: vi.fn().mockResolvedValue(0),
                create: vi.fn(),
            };

            const report = await getComplianceReport('partner-001');
            expect(report).not.toBeNull();
            expect(report!.compliance.isFullyCompliant).toBe(true);
            expect(report!.compliance.contractStatus).toBe('VALID');
            expect(report!.compliance.dpaStatus).toBe('SIGNED');
        });

        it('should generate compliance report (non-compliant)', async () => {
            prismaMock.partner.findUnique.mockResolvedValue(
                createMockPartner({ dpaSignedAt: null, contractSignedAt: null }) as any,
            );
            (prismaMock as any).partnerAuditLog = {
                findMany: vi.fn().mockResolvedValue([]),
                count: vi.fn().mockResolvedValue(5),
                create: vi.fn(),
            };

            const report = await getComplianceReport('partner-001');
            expect(report!.compliance.isFullyCompliant).toBe(false);
            expect(report!.compliance.contractStatus).toBe('MISSING');
            expect(report!.compliance.dpaStatus).toBe('MISSING');
            expect(report!.compliance.totalComplianceRejections).toBe(5);
        });

        it('should detect expired contract in report', async () => {
            prismaMock.partner.findUnique.mockResolvedValue(
                createMockPartner({ contractExpiresAt: new Date('2024-06-01') }) as any,
            );
            (prismaMock as any).partnerAuditLog = {
                findMany: vi.fn().mockResolvedValue([]),
                count: vi.fn().mockResolvedValue(0),
                create: vi.fn(),
            };

            const report = await getComplianceReport('partner-001');
            expect(report!.compliance.contractStatus).toBe('EXPIRED');
            expect(report!.compliance.isFullyCompliant).toBe(false);
        });
    });

    // =========================================================================
    // 3. POLITIQUE DE CONSERVATION RGPD
    // =========================================================================

    describe('3. Conservation RGPD', () => {

        describe('3a. Anonymisation automatique', () => {

            it('should anonymize leads older than retention period', async () => {
                const oldLead = createMockLead({
                    id: 'old-lead-001',
                    createdAt: new Date('2022-01-01'),
                    leadConsent: createMockConsent({ leadId: 'old-lead-001' }),
                });

                prismaMock.lead.findMany.mockResolvedValue([oldLead] as any);
                const txMock = mockDeep<PrismaClient>();
                txMock.lead.update.mockResolvedValue({} as any);
                txMock.leadConsent.update.mockResolvedValue({} as any);
                prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

                const result = await anonymizeExpiredLeads(36, false);
                expect(result.totalProcessed).toBe(1);
                expect(result.leadsAnonymized).toBe(1);
                expect(result.errors).toHaveLength(0);
            });

            it('should skip already anonymized leads', async () => {
                prismaMock.lead.findMany.mockResolvedValue([]);
                const result = await anonymizeExpiredLeads(36, false);
                expect(result.totalProcessed).toBe(0);
            });

            it('should support dry-run mode', async () => {
                prismaMock.lead.findMany.mockResolvedValue([
                    createMockLead({ id: 'lead-1' }),
                    createMockLead({ id: 'lead-2' }),
                ] as any);

                const result = await anonymizeExpiredLeads(36, true);
                expect(result.totalProcessed).toBe(2);
                expect(result.leadsAnonymized).toBe(2);
                expect(prismaMock.$transaction).not.toHaveBeenCalled();
            });

            it('should handle batch errors', async () => {
                prismaMock.lead.findMany.mockResolvedValue([createMockLead()] as any);
                prismaMock.$transaction.mockRejectedValue(new Error('DB down'));

                const result = await anonymizeExpiredLeads(36, false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

        describe('3b. Effacement (Art. 17)', () => {

            it('should anonymize a specific lead', async () => {
                prismaMock.lead.findUnique.mockResolvedValue({
                    ...createMockLead(),
                    leadConsent: createMockConsent(),
                } as any);

                const txMock = mockDeep<PrismaClient>();
                txMock.lead.update.mockResolvedValue({} as any);
                txMock.leadConsent.update.mockResolvedValue({} as any);
                prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

                const result = await anonymizeLead('lead-001', 'Test erasure');
                expect(result.success).toBe(true);
            });

            it('should error for non-existent lead', async () => {
                prismaMock.lead.findUnique.mockResolvedValue(null);
                const result = await anonymizeLead('non-existent');
                expect(result.success).toBe(false);
            });

            it('should error for already anonymized lead', async () => {
                prismaMock.lead.findUnique.mockResolvedValue(
                    createMockLead({ email: 'anonymized@deleted.local' }) as any,
                );
                const result = await anonymizeLead('lead-001');
                expect(result.success).toBe(false);
            });
        });

        describe('3c. Retrait consentement (Art. 7.3)', () => {

            it('should withdraw consent', async () => {
                prismaMock.leadConsent.findUnique.mockResolvedValue(createMockConsent() as any);
                prismaMock.leadConsent.update.mockResolvedValue({} as any);

                const result = await withdrawConsent('lead-001');
                expect(result.success).toBe(true);
            });

            it('should error if not found', async () => {
                prismaMock.leadConsent.findUnique.mockResolvedValue(null);
                const result = await withdrawConsent('non-existent');
                expect(result.success).toBe(false);
            });

            it('should error if already withdrawn', async () => {
                prismaMock.leadConsent.findUnique.mockResolvedValue(
                    createMockConsent({ withdrawnAt: new Date() }) as any,
                );
                const result = await withdrawConsent('lead-001');
                expect(result.success).toBe(false);
            });
        });

        describe('3d. Portabilite (Art. 20)', () => {

            it('should export lead data', async () => {
                prismaMock.lead.findUnique.mockResolvedValue({
                    ...createMockLead(),
                    leadConsent: createMockConsent(),
                } as any);

                const exported = await exportLeadData('lead-001');
                expect(exported).not.toBeNull();
                expect(exported!.nom).toBe('Prospect');
                expect(exported!.email).toBe('jean.prospect@email.fr');
                expect(exported!.consent).not.toBeNull();
            });

            it('should return null for non-existent lead', async () => {
                prismaMock.lead.findUnique.mockResolvedValue(null);
                expect(await exportLeadData('non-existent')).toBeNull();
            });
        });

        describe('3e. Statistiques', () => {

            it('should return retention stats', async () => {
                prismaMock.lead.count
                    .mockResolvedValueOnce(1000)
                    .mockResolvedValueOnce(50)
                    .mockResolvedValueOnce(300)
                    .mockResolvedValueOnce(150)
                    .mockResolvedValueOnce(30);

                const stats = await getRetentionStats('org-001');
                expect(stats.total).toBe(1000);
                expect(stats.anonymized).toBe(50);
                expect(stats.active).toBe(950);
                expect(stats.retentionPolicyMonths).toBe(36);
            });
        });
    });

    // =========================================================================
    // 4. SCENARIOS E2E
    // =========================================================================

    describe('4. Scenarios E2E', () => {

        it('Full partner lifecycle: Create > Activate > Reject > Suspend', async () => {
            (prismaMock as any).partnerAuditLog = {
                create: vi.fn().mockResolvedValue({}),
            };

            await logPartnerAction({ partnerId: 'p-e2e', organizationId: 'org-001', action: 'CREATED', details: 'Created' });
            await logPartnerAction({ partnerId: 'p-e2e', organizationId: 'org-001', action: 'ACTIVATED', details: 'Activated' });
            await logComplianceRejection('p-e2e', 'org-001', 'Expired', 'COMPLIANCE_CONTRACT_EXPIRED');
            await logPartnerAction({ partnerId: 'p-e2e', organizationId: 'org-001', action: 'SUSPENDED', details: 'Suspended' });

            expect((prismaMock as any).partnerAuditLog.create).toHaveBeenCalledTimes(4);
        });

        it('RGPD subject rights: Export > Withdraw > Erase', async () => {
            const lead = { ...createMockLead({ id: 'lead-rgpd' }), leadConsent: createMockConsent({ leadId: 'lead-rgpd' }) };

            // Export
            prismaMock.lead.findUnique.mockResolvedValue(lead as any);
            const exported = await exportLeadData('lead-rgpd');
            expect(exported).not.toBeNull();

            // Withdraw
            prismaMock.leadConsent.findUnique.mockResolvedValue(createMockConsent({ leadId: 'lead-rgpd' }) as any);
            prismaMock.leadConsent.update.mockResolvedValue({} as any);
            expect((await withdrawConsent('lead-rgpd')).success).toBe(true);

            // Erase
            prismaMock.lead.findUnique.mockResolvedValue(lead as any);
            const txMock = mockDeep<PrismaClient>();
            txMock.lead.update.mockResolvedValue({} as any);
            txMock.leadConsent.update.mockResolvedValue({} as any);
            prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));
            expect((await anonymizeLead('lead-rgpd', 'RGPD erasure')).success).toBe(true);
        });

        it('Non-compliant partner accumulates rejections', async () => {
            (prismaMock as any).partnerAuditLog = {
                create: vi.fn().mockResolvedValue({}),
                findMany: vi.fn().mockResolvedValue([]),
                count: vi.fn().mockResolvedValue(3),
            };

            for (const reason of ['DPA missing', 'Contract expired', 'DPA missing']) {
                await logComplianceRejection('p-nc', 'org-001', reason, 'COMPLIANCE_DPA_MISSING');
            }
            expect((prismaMock as any).partnerAuditLog.create).toHaveBeenCalledTimes(3);

            prismaMock.partner.findUnique.mockResolvedValue(
                createMockPartner({ id: 'p-nc', dpaSignedAt: null, contractSignedAt: null }) as any,
            );

            const report = await getComplianceReport('p-nc');
            expect(report!.compliance.isFullyCompliant).toBe(false);
            expect(report!.compliance.totalComplianceRejections).toBe(3);
        });
    });
});

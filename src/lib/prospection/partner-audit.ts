/**
 * PARTNER AUDIT SERVICE — Journal de traçabilité réglementaire
 * ================================================================
 * Enregistre toutes les actions admin et système sur les partenaires.
 * 
 * Conformité :
 *   - Qualiopi Indicateur 17 : traçabilité de la sous-traitance
 *   - Qualiopi Indicateur 26 : contrôle des intervenants externes
 *   - RGPD Art. 5 (1)(f) : principe de responsabilité (accountability)
 *   - RGPD Art. 30 : registre des traitements
 */

import { prisma as defaultPrisma } from '@/lib/prisma';
import { Prisma, PrismaClient } from '@prisma/client';

// Instance injectable (pour les tests)
let prismaInstance: any = null;

export function setPrismaInstance(instance: any): void {
    prismaInstance = instance;
}

function getPrisma(): any {
    return prismaInstance || defaultPrisma;
}


// ─── Types d'actions auditées ─────────────────────────────────

export type PartnerAuditAction =
    | 'CREATED'
    | 'ACTIVATED'
    | 'SUSPENDED'
    | 'REACTIVATED'
    | 'CONTRACT_SIGNED'
    | 'CONTRACT_EXPIRED'
    | 'DPA_SIGNED'
    | 'NDA_SIGNED'
    | 'API_KEY_GENERATED'
    | 'API_KEY_REVOKED'
    | 'RATE_LIMIT_CHANGED'
    | 'STATUS_CHANGED'
    | 'UPDATED'
    | 'DELETED'
    | 'LEAD_REJECTED_COMPLIANCE'
    | 'WEBHOOK_CONFIGURED'
    | 'IP_WHITELIST_CHANGED'
    | 'QUALIFICATION_EVALUATED'
    | 'QUALIFICATION_DOCUMENTS_UPDATED'
    | 'CONVENTION_SIGNED';

// ─── Interface d'entrée ───────────────────────────────────────

export interface AuditLogEntry {
    partnerId: string;
    organizationId: string;
    action: PartnerAuditAction;
    performedBy?: string | null;       // userId (null = system)
    performedByName?: string | null;   // Nom lisible
    details?: string | null;           // Description
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
}

// ─── Service principal ────────────────────────────────────────

/**
 * Enregistre une entrée d'audit pour une action sur un partenaire.
 * Cette fonction est fire-and-forget (ne bloque pas le flux principal).
 */
export async function logPartnerAction(entry: AuditLogEntry): Promise<void> {
    try {
        await getPrisma().partnerAuditLog.create({
            data: {
                partnerId: entry.partnerId,
                organizationId: entry.organizationId,
                action: entry.action,
                performedBy: entry.performedBy || null,
                performedByName: entry.performedByName || null,
                details: entry.details || null,
                previousValue: (entry.previousValue || undefined) as Prisma.InputJsonValue | undefined,
                newValue: (entry.newValue || undefined) as Prisma.InputJsonValue | undefined,
                ipAddress: entry.ipAddress || null,
                userAgent: entry.userAgent || null,
            },
        });
    } catch (err) {
        // L'audit ne doit JAMAIS bloquer le flux principal
        console.error('[PartnerAudit] ⚠️ Erreur journalisation:', err);
    }
}

/**
 * Enregistre un rejet de lead pour non-conformité.
 * Appelé automatiquement par le guard DPA/contrat.
 */
export async function logComplianceRejection(
    partnerId: string,
    organizationId: string,
    reason: string,
    code: string,
): Promise<void> {
    await logPartnerAction({
        partnerId,
        organizationId,
        action: 'LEAD_REJECTED_COMPLIANCE',
        details: `Lead rejeté — ${reason} (code: ${code})`,
        newValue: { rejectionCode: code, reason },
    });
}

// ─── Requêtes pour le dashboard d'audit ───────────────────────

/**
 * Récupère l'historique d'audit d'un partenaire.
 */
export async function getPartnerAuditHistory(
    partnerId: string,
    options?: { limit?: number; offset?: number },
) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [logs, total] = await Promise.all([
        getPrisma().partnerAuditLog.findMany({
            where: { partnerId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        getPrisma().partnerAuditLog.count({
            where: { partnerId },
        }),
    ]);

    return { logs, total, limit, offset };
}

/**
 * Récupère l'historique d'audit de tous les partenaires d'une org.
 * Utile pour les rapports Qualiopi.
 */
export async function getOrganizationAuditHistory(
    organizationId: string,
    options?: {
        limit?: number;
        offset?: number;
        action?: PartnerAuditAction;
        from?: Date;
        to?: Date;
    },
) {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const where: Record<string, unknown> = { organizationId };
    if (options?.action) where.action = options.action;
    if (options?.from || options?.to) {
        where.createdAt = {
            ...(options?.from ? { gte: options.from } : {}),
            ...(options?.to ? { lte: options.to } : {}),
        };
    }

    const [logs, total] = await Promise.all([
        getPrisma().partnerAuditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                partner: {
                    select: { companyName: true, status: true },
                },
            },
        }),
        getPrisma().partnerAuditLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
}

/**
 * Génère un rapport de conformité pour un partenaire.
 * Inclut les dates clés et le statut réglementaire.
 */
export async function getComplianceReport(partnerId: string) {
    const partner = await getPrisma().partner.findUnique({
        where: { id: partnerId },
        select: {
            id: true,
            companyName: true,
            siret: true,
            status: true,
            contractSignedAt: true,
            contractExpiresAt: true,
            dpaSignedAt: true,
            ndaSignedAt: true,
            createdAt: true,
        },
    });

    if (!partner) return null;

    const now = new Date();
    const contractValid = partner.contractSignedAt !== null
        && (!partner.contractExpiresAt || new Date(partner.contractExpiresAt) > now);

    const recentActions = await getPrisma().partnerAuditLog.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    const complianceRejections = await getPrisma().partnerAuditLog.count({
        where: {
            partnerId,
            action: 'LEAD_REJECTED_COMPLIANCE',
        },
    });

    return {
        partner: {
            ...partner,
            contractValid,
            dpaValid: partner.dpaSignedAt !== null,
            ndaValid: partner.ndaSignedAt !== null,
        },
        compliance: {
            isFullyCompliant: contractValid && partner.dpaSignedAt !== null,
            contractStatus: !partner.contractSignedAt
                ? 'MISSING'
                : !contractValid
                    ? 'EXPIRED'
                    : 'VALID',
            dpaStatus: partner.dpaSignedAt ? 'SIGNED' : 'MISSING',
            ndaStatus: partner.ndaSignedAt ? 'SIGNED' : 'NOT_REQUIRED',
            totalComplianceRejections: complianceRejections,
        },
        recentActions,
    };
}

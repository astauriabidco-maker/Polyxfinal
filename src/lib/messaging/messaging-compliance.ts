/**
 * MESSAGING COMPLIANCE — RGPD Compliance Layer for WhatsApp
 * ===========================================================
 * Centralizes all RGPD compliance checks for the messaging module:
 *   - Consent verification before sending (Art. 6.1.a / 6.1.b)
 *   - Opt-out handling via STOP keyword (Art. 7.3)
 *   - Audit logging of sent/received messages
 *   - Message anonymization for erasure requests (Art. 17)
 *
 * @Compliance: RGPD Art. 6, 7.3, 17, 20, 30
 */

import { prisma } from '@/lib/prisma';

// ─── Constants ───────────────────────────────────────────────

/** Keywords that trigger opt-out (case-insensitive) */
export const OPT_OUT_KEYWORDS = ['STOP', 'ARRETER', 'ARRÊTER', 'UNSUBSCRIBE', 'DESINSCRIPTION', 'DÉSINSCRIPTION'];

/** Auto-reply message sent when user opts out */
export const OPT_OUT_REPLY = '✅ Votre demande de désinscription a été prise en compte. Vous ne recevrez plus de messages marketing. Pour exercer vos droits RGPD, contactez votre organisme de formation.';

// ─── Types ───────────────────────────────────────────────────

export interface ConsentCheckResult {
    allowed: boolean;
    reason?: string;
    legalBasis?: 'CONSENT' | 'CONTRACT' | 'EXEMPT';
}

// ─── Consent Verification (Art. 6) ──────────────────────────

/**
 * Check if we have legal basis to send a message to this recipient.
 *
 * Rules:
 * - If dossierId is present → base légale = contrat (Art. 6.1.b) → always allowed
 * - If leadId is present → check LeadConsent.consentGiven + not withdrawn
 * - If neither → allowed (system/transactional message)
 */
export async function checkConsentBeforeSend(
    organizationId: string,
    phone: string,
    leadId?: string,
    dossierId?: string,
): Promise<ConsentCheckResult> {
    // Transactional messages linked to a dossier → contract basis
    if (dossierId) {
        return { allowed: true, legalBasis: 'CONTRACT' };
    }

    // No lead → can't verify consent, allow (system message)
    if (!leadId) {
        return { allowed: true, legalBasis: 'EXEMPT' };
    }

    try {
        // Check consent status
        const consent = await (prisma as any).leadConsent.findUnique({
            where: { leadId },
            select: { consentGiven: true, withdrawnAt: true, anonymizedAt: true },
        });

        // No consent record found → block (precautionary principle)
        if (!consent) {
            return {
                allowed: false,
                reason: 'Aucun consentement enregistré pour ce lead (Art. 6.1.a)',
            };
        }

        // Consent withdrawn
        if (consent.withdrawnAt) {
            return {
                allowed: false,
                reason: `Consentement retiré le ${new Date(consent.withdrawnAt).toLocaleDateString('fr-FR')} (Art. 7.3)`,
            };
        }

        // Data anonymized
        if (consent.anonymizedAt) {
            return {
                allowed: false,
                reason: 'Données anonymisées — lead effacé (Art. 17)',
            };
        }

        // Consent not given
        if (!consent.consentGiven) {
            return {
                allowed: false,
                reason: 'Consentement non donné (Art. 6.1.a)',
            };
        }

        return { allowed: true, legalBasis: 'CONSENT' };
    } catch (err) {
        console.error('[Compliance] Consent check failed:', err);
        // Fail open for operational continuity, but log
        return { allowed: true, legalBasis: 'EXEMPT' };
    }
}

// ─── Opt-Out Handling (Art. 7.3) ────────────────────────────

/**
 * Check if an inbound message is an opt-out request.
 */
export function isOptOutMessage(text: string): boolean {
    const normalized = text.trim().toUpperCase().replace(/[^A-ZÉÊÈ]/g, '');
    return OPT_OUT_KEYWORDS.some(kw => normalized === kw.replace(/[^A-ZÉÊÈ]/g, ''));
}

/**
 * Process an opt-out request:
 * 1. Find lead by phone
 * 2. Withdraw consent (set withdrawnAt)
 * 3. Create audit log
 */
export async function handleOptOut(
    organizationId: string,
    phone: string,
): Promise<{ success: boolean; leadId?: string }> {
    try {
        const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        const variants = [normalizedPhone, `+${normalizedPhone}`, `0${normalizedPhone.slice(2)}`];

        // Find lead
        const lead = await (prisma as any).lead.findFirst({
            where: {
                organizationId,
                telephone: { in: variants },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        if (!lead) {
            console.warn(`[Compliance] Opt-out received but no lead found for phone: ${normalizedPhone}`);
            return { success: false };
        }

        // Withdraw consent
        const now = new Date();
        await (prisma as any).leadConsent.upsert({
            where: { leadId: lead.id },
            update: { withdrawnAt: now },
            create: {
                leadId: lead.id,
                consentGiven: false,
                consentText: 'Désinscription via WhatsApp (STOP)',
                consentMethod: 'WHATSAPP_OPT_OUT',
                legalBasis: 'Retrait de consentement (Art. 7.3)',
                withdrawnAt: now,
            },
        });

        // Find a system/admin user for audit log
        const adminUser = await (prisma as any).user.findFirst({
            where: { organizationId, role: { code: 'ADMIN' } },
            select: { id: true },
        });

        // Audit log
        if (adminUser) {
            await (prisma as any).auditLog.create({
                data: {
                    organizationId,
                    userId: adminUser.id,
                    userRole: 'SYSTEM',
                    action: 'RGPD_OPT_OUT_WHATSAPP',
                    niveauAction: 'EDITION',
                    entityType: 'Lead',
                    entityId: lead.id,
                    newState: {
                        channel: 'WHATSAPP',
                        phone: normalizedPhone,
                        method: 'STOP_KEYWORD',
                        withdrawnAt: now.toISOString(),
                    },
                    ipAddress: '0.0.0.0',
                },
            });
        }

        console.log(`[Compliance] ✅ Opt-out processed for lead ${lead.id} (phone: ${normalizedPhone})`);
        return { success: true, leadId: lead.id };
    } catch (err) {
        console.error('[Compliance] Opt-out handling failed:', err);
        return { success: false };
    }
}

// ─── Audit Logging ──────────────────────────────────────────

/**
 * Log a sent message to AuditLog for RGPD traceability.
 * Non-blocking — errors are caught and logged.
 */
export async function auditMessageSent(
    organizationId: string,
    messageId: string,
    to: string,
    channel: string,
    templateKey?: string,
    sentById?: string,
    status?: string,
): Promise<void> {
    try {
        // Use sentBy or find admin for system messages
        let userId = sentById;
        if (!userId) {
            const admin = await (prisma as any).user.findFirst({
                where: { organizationId, role: { code: 'ADMIN' } },
                select: { id: true },
            });
            userId = admin?.id;
        }

        if (!userId) return; // Can't create audit without userId

        await (prisma as any).auditLog.create({
            data: {
                organizationId,
                userId,
                userRole: sentById ? 'USER' : 'SYSTEM',
                action: 'MESSAGE_SENT',
                niveauAction: 'CREATION',
                entityType: 'Message',
                entityId: messageId,
                newState: {
                    to,
                    channel,
                    templateKey: templateKey || null,
                    status: status || 'SENT',
                    timestamp: new Date().toISOString(),
                },
                ipAddress: '127.0.0.1',
            },
        });
    } catch (err) {
        console.error('[Compliance] Audit log creation failed:', err);
    }
}

// ─── Message Anonymization (Art. 17) ────────────────────────

/**
 * Anonymize all messages for a given lead.
 * Called by the RGPD erasure flow.
 */
export async function anonymizeLeadMessages(leadId: string): Promise<number> {
    try {
        const result = await (prisma as any).message.updateMany({
            where: { leadId },
            data: {
                content: '[CONTENU ANONYMISÉ — Art. 17 RGPD]',
                phone: '0000000000',
            },
        });

        console.log(`[Compliance] Anonymized ${result.count} messages for lead ${leadId}`);
        return result.count;
    } catch (err) {
        console.error('[Compliance] Message anonymization failed:', err);
        return 0;
    }
}

/**
 * Export all messages for a given lead (Art. 20 portability).
 */
export async function exportLeadMessages(leadId: string): Promise<any[]> {
    try {
        const messages = await (prisma as any).message.findMany({
            where: { leadId },
            select: {
                id: true,
                direction: true,
                channel: true,
                content: true,
                phone: true,
                status: true,
                templateKey: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        return messages;
    } catch (err) {
        console.error('[Compliance] Message export failed:', err);
        return [];
    }
}

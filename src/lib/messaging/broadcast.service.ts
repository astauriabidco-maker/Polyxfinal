/**
 * BROADCAST SERVICE — Mass Message Sending
 * ==========================================
 * Resolves recipients from filters, sends messages with rate limiting,
 * and tracks delivery status per recipient.
 */

import { prisma } from '@/lib/prisma';
import { sendMessage } from './messaging.service';

// ─── Types ────────────────────────────────────────────────────

export interface BroadcastFilters {
    sessionId?: string;
    siteId?: string;
    status?: string[];        // PhaseStatus values
    formation?: string;       // Programme titre (partial match)
    tags?: string[];           // ContactTag values
    source?: string;          // Lead source
}

interface Recipient {
    phone: string;
    nom: string;
    prenom: string;
    leadId?: string;
    dossierId?: string;
}

// ─── Resolve Recipients ──────────────────────────────────────

/**
 * Build a list of unique phone numbers from filter criteria.
 * Queries dossiers by session/site/status/formation,
 * and leads by tags/source.
 */
export async function resolveRecipients(
    organizationId: string,
    filters: BroadcastFilters
): Promise<Recipient[]> {
    const recipientMap = new Map<string, Recipient>();

    // 1. Dossiers filter (session, site, status, formation)
    if (filters.sessionId || filters.siteId || filters.status?.length || filters.formation) {
        const where: any = {
            organizationId,
            stagiaireTelephone: { not: null },
        };
        if (filters.sessionId) where.sessionId = filters.sessionId;
        if (filters.siteId) where.siteId = filters.siteId;
        if (filters.status?.length) where.status = { in: filters.status };
        if (filters.formation) {
            where.session = {
                programme: {
                    titre: { contains: filters.formation, mode: 'insensitive' },
                },
            };
        }

        const dossiers = await prisma.dossier.findMany({
            where,
            select: {
                id: true,
                stagiaireNom: true,
                stagiairePrenom: true,
                stagiaireTelephone: true,
            },
            take: 5000,
        });

        for (const d of dossiers) {
            if (!d.stagiaireTelephone) continue;
            const phone = normalizePhone(d.stagiaireTelephone);
            if (!recipientMap.has(phone)) {
                recipientMap.set(phone, {
                    phone,
                    nom: d.stagiaireNom,
                    prenom: d.stagiairePrenom,
                    dossierId: d.id,
                });
            }
        }
    }

    // 2. Tags filter (leads with specific tags)
    if (filters.tags?.length) {
        const taggedLeads = await (prisma as any).contactTag.findMany({
            where: {
                organizationId,
                tag: { in: filters.tags },
            },
            select: { leadId: true },
            distinct: ['leadId'],
        });

        const leadIds = taggedLeads.map((t: any) => t.leadId);
        if (leadIds.length > 0) {
            const leads = await prisma.lead.findMany({
                where: {
                    id: { in: leadIds },
                    telephone: { not: null },
                },
                select: {
                    id: true,
                    nom: true,
                    prenom: true,
                    telephone: true,
                },
            });

            for (const lead of leads) {
                if (!lead.telephone) continue;
                const phone = normalizePhone(lead.telephone);
                if (!recipientMap.has(phone)) {
                    recipientMap.set(phone, {
                        phone,
                        nom: lead.nom,
                        prenom: lead.prenom,
                        leadId: lead.id,
                    });
                }
            }
        }
    }

    // 3. Source filter (leads by source)
    if (filters.source) {
        const leads = await prisma.lead.findMany({
            where: {
                organizationId,
                source: filters.source as any,
                telephone: { not: null },
            },
            select: {
                id: true,
                nom: true,
                prenom: true,
                telephone: true,
            },
            take: 5000,
        });

        for (const lead of leads) {
            if (!lead.telephone) continue;
            const phone = normalizePhone(lead.telephone);
            if (!recipientMap.has(phone)) {
                recipientMap.set(phone, {
                    phone,
                    nom: lead.nom,
                    prenom: lead.prenom,
                    leadId: lead.id,
                });
            }
        }
    }

    return Array.from(recipientMap.values());
}

// ─── Start Broadcast ─────────────────────────────────────────

/**
 * Send messages to all recipients with rate limiting (1 msg/sec).
 * Updates progress in real-time.
 */
export async function startBroadcast(broadcastId: string): Promise<void> {
    const broadcast = await (prisma as any).broadcast.findUnique({
        where: { id: broadcastId },
        include: {
            recipients: { where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } },
        },
    });

    if (!broadcast || broadcast.status !== 'DRAFT') {
        throw new Error('Broadcast introuvable ou déjà lancé');
    }

    // Mark as sending
    await (prisma as any).broadcast.update({
        where: { id: broadcastId },
        data: { status: 'SENDING', startedAt: new Date() },
    });

    let sentCount = broadcast.sentCount;
    let failedCount = broadcast.failedCount;

    for (const recipient of broadcast.recipients) {
        // Check if broadcast was cancelled
        const current = await (prisma as any).broadcast.findUnique({
            where: { id: broadcastId },
            select: { status: true },
        });
        if (current.status === 'CANCELLED' || current.status === 'PAUSED') break;

        try {
            const result = await sendMessage(broadcast.organizationId, {
                to: recipient.phone,
                text: broadcast.content || '',
                channel: broadcast.channel === 'SMS' ? 'sms' : 'whatsapp',
                templateKey: broadcast.templateKey || undefined,
                leadId: recipient.leadId || undefined,
                dossierId: recipient.dossierId || undefined,
            });

            if (result.success) {
                await (prisma as any).broadcastRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        status: 'SENT',
                        externalId: result.externalId || null,
                        sentAt: new Date(),
                    },
                });
                sentCount++;
            } else {
                await (prisma as any).broadcastRecipient.update({
                    where: { id: recipient.id },
                    data: { status: 'FAILED', error: result.error || 'Unknown' },
                });
                failedCount++;
            }
        } catch (err) {
            await (prisma as any).broadcastRecipient.update({
                where: { id: recipient.id },
                data: { status: 'FAILED', error: err instanceof Error ? err.message : 'Error' },
            });
            failedCount++;
        }

        // Update progress
        await (prisma as any).broadcast.update({
            where: { id: broadcastId },
            data: { sentCount, failedCount },
        });

        // Rate limiting: 1 message per second
        await sleep(1000);
    }

    // Mark as completed
    const finalStatus = failedCount === broadcast.totalRecipients ? 'FAILED' : 'COMPLETED';
    await (prisma as any).broadcast.update({
        where: { id: broadcastId },
        data: { status: finalStatus, completedAt: new Date() },
    });
}

// ─── Get Progress ────────────────────────────────────────────

export async function getBroadcastProgress(broadcastId: string) {
    const broadcast = await (prisma as any).broadcast.findUnique({
        where: { id: broadcastId },
        select: {
            id: true,
            name: true,
            status: true,
            totalRecipients: true,
            sentCount: true,
            deliveredCount: true,
            failedCount: true,
            startedAt: true,
            completedAt: true,
        },
    });

    if (!broadcast) return null;

    // Get detailed status counts
    const statusCounts = await (prisma as any).broadcastRecipient.groupBy({
        by: ['status'],
        where: { broadcastId },
        _count: true,
    });

    const counts: Record<string, number> = {};
    for (const c of statusCounts) {
        counts[c.status] = c._count;
    }

    return {
        ...broadcast,
        pending: counts.PENDING || 0,
        sent: counts.SENT || 0,
        delivered: counts.DELIVERED || 0,
        read: counts.READ || 0,
        failed: counts.FAILED || 0,
        progress: broadcast.totalRecipients > 0
            ? Math.round(((broadcast.sentCount + broadcast.failedCount) / broadcast.totalRecipients) * 100)
            : 0,
    };
}

// ─── Get Dynamic Segments ────────────────────────────────────

export async function getDynamicSegments(organizationId: string) {
    // Sessions actives avec nombre de dossiers
    const sessions = await prisma.session.findMany({
        where: {
            organizationId,
            status: { in: ['ACTIF', 'EN_COURS'] },
        },
        include: {
            programme: { select: { titre: true } },
            site: { select: { name: true } },
            _count: { select: { dossiers: true } },
        },
        orderBy: { dateDebut: 'desc' },
        take: 20,
    });

    const sites = await prisma.site.findMany({
        where: { organizationId },
        include: {
            _count: { select: { dossiers: true } },
        },
    });

    // Tags populaires
    const tags = await (prisma as any).contactTag.groupBy({
        by: ['tag'],
        where: { organizationId },
        _count: true,
        orderBy: { _count: { tag: 'desc' } },
        take: 20,
    });

    return {
        sessions: sessions.map(s => ({
            id: s.id,
            label: `${s.programme?.titre || 'Session'} — ${s.reference}`,
            site: s.site?.name || '',
            dateDebut: s.dateDebut,
            dateFin: s.dateFin,
            count: s._count.dossiers,
        })),
        sites: sites.map(s => ({
            id: s.id,
            label: s.name,
            count: s._count.dossiers,
        })),
        tags: tags.map((t: any) => ({
            tag: t.tag,
            count: t._count,
        })),
    };
}

// ─── Helpers ─────────────────────────────────────────────────

function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

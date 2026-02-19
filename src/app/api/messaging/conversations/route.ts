/**
 * API CONVERSATIONS — Liste des conversations groupées
 * =====================================================
 * GET — Liste les conversations (groupées par phone) avec dernier message
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/messaging/conversations
 * Returns conversations grouped by phone number with last message
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = 30;

        const orgId = session.user.organizationId;

        // Get all unique conversations with last message using raw SQL for grouping
        const conversations = await (prisma as any).$queryRaw`
            SELECT 
                m.phone,
                m."leadId",
                MAX(m."createdAt") as "lastMessageAt",
                COUNT(*) as "totalMessages",
                COUNT(*) FILTER (WHERE m.direction = 'INBOUND' AND m."isRead" = false) as "unreadCount",
                (
                    SELECT m2.content FROM "Message" m2 
                    WHERE m2.phone = m.phone AND m2."organizationId" = ${orgId}
                    ORDER BY m2."createdAt" DESC LIMIT 1
                ) as "lastMessage",
                (
                    SELECT m2.direction FROM "Message" m2 
                    WHERE m2.phone = m.phone AND m2."organizationId" = ${orgId}
                    ORDER BY m2."createdAt" DESC LIMIT 1
                ) as "lastDirection",
                (
                    SELECT m2.status FROM "Message" m2 
                    WHERE m2.phone = m.phone AND m2."organizationId" = ${orgId}
                    ORDER BY m2."createdAt" DESC LIMIT 1
                ) as "lastStatus"
            FROM "Message" m
            WHERE m."organizationId" = ${orgId}
            GROUP BY m.phone, m."leadId"
            ORDER BY MAX(m."createdAt") DESC
            LIMIT ${limit}
            OFFSET ${(page - 1) * limit}
        `;

        // Enrich with lead info
        const leadIds = [...new Set(
            (conversations as any[])
                .filter(c => c.leadId)
                .map(c => c.leadId)
        )];

        let leadsMap: Record<string, any> = {};
        if (leadIds.length > 0) {
            const leads = await (prisma as any).lead.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, nom: true, prenom: true, email: true, formationSouhaitee: true, status: true },
            });
            leadsMap = Object.fromEntries(leads.map((l: any) => [l.id, l]));
        }

        // Also try to match unlinked conversations to leads by phone
        const unlinkedPhones = (conversations as any[])
            .filter(c => !c.leadId)
            .map(c => c.phone);

        if (unlinkedPhones.length > 0) {
            const phoneLeads = await (prisma as any).lead.findMany({
                where: {
                    organizationId: orgId,
                    telephone: { in: unlinkedPhones.flatMap((p: string) => [p, `+${p}`, `0${p.slice(2)}`]) },
                },
                select: { id: true, nom: true, prenom: true, email: true, telephone: true, formationSouhaitee: true, status: true },
                orderBy: { createdAt: 'desc' },
            });
            for (const lead of phoneLeads) {
                const normalizedPhone = lead.telephone?.replace(/[\s\-\(\)\+]/g, '');
                if (normalizedPhone && !leadsMap[lead.id]) {
                    leadsMap[`phone:${normalizedPhone}`] = lead;
                }
            }
        }

        const enriched = (conversations as any[]).map(c => {
            const lead = c.leadId
                ? leadsMap[c.leadId]
                : leadsMap[`phone:${c.phone}`];

            return {
                phone: c.phone,
                leadId: c.leadId || lead?.id || null,
                contactName: lead ? `${lead.prenom} ${lead.nom}` : null,
                contactEmail: lead?.email || null,
                leadStatus: lead?.status || null,
                formation: lead?.formationSouhaitee || null,
                lastMessage: c.lastMessage?.substring(0, 100),
                lastDirection: c.lastDirection,
                lastStatus: c.lastStatus,
                lastMessageAt: c.lastMessageAt,
                totalMessages: Number(c.totalMessages),
                unreadCount: Number(c.unreadCount),
            };
        });

        // Apply search filter
        const filtered = search
            ? enriched.filter(c =>
                c.contactName?.toLowerCase().includes(search.toLowerCase()) ||
                c.phone.includes(search) ||
                c.contactEmail?.toLowerCase().includes(search.toLowerCase())
            )
            : enriched;

        // Count total unread
        const totalUnread = filtered.reduce((sum, c) => sum + c.unreadCount, 0);

        return NextResponse.json({ conversations: filtered, totalUnread });
    } catch (error) {
        console.error('Erreur GET /api/messaging/conversations:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

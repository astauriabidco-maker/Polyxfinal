/**
 * BROADCASTS CRUD — List & Create
 * =================================
 * GET  — List all broadcasts for the organization
 * POST — Create a new broadcast (resolve recipients, save as DRAFT)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveRecipients, BroadcastFilters } from '@/lib/messaging/broadcast.service';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const broadcasts = await (prisma as any).broadcast.findMany({
            where: { organizationId: session.user.organizationId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { recipients: true } },
            },
        });

        return NextResponse.json({ broadcasts });
    } catch (error) {
        console.error('Erreur GET /api/messaging/broadcasts:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, channel, templateKey, content, filters } = body;

        if (!name || !filters) {
            return NextResponse.json({ error: 'name et filters sont requis' }, { status: 400 });
        }

        if (!content && !templateKey) {
            return NextResponse.json({ error: 'content ou templateKey requis' }, { status: 400 });
        }

        const parsedFilters: BroadcastFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;

        // Resolve recipients
        const recipients = await resolveRecipients(session.user.organizationId, parsedFilters);

        if (recipients.length === 0) {
            return NextResponse.json({ error: 'Aucun destinataire trouvé pour ces filtres' }, { status: 400 });
        }

        // Create broadcast with recipients
        const broadcast = await (prisma as any).broadcast.create({
            data: {
                organizationId: session.user.organizationId,
                name,
                description: description || null,
                channel: channel || 'WHATSAPP',
                templateKey: templateKey || null,
                content: content || null,
                filters: JSON.stringify(parsedFilters),
                totalRecipients: recipients.length,
                createdById: session.user.id || null,
                recipients: {
                    create: recipients.map(r => ({
                        phone: r.phone,
                        leadId: r.leadId || null,
                        dossierId: r.dossierId || null,
                    })),
                },
            },
            include: {
                _count: { select: { recipients: true } },
            },
        });

        return NextResponse.json({ broadcast, recipientCount: recipients.length }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/messaging/broadcasts:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

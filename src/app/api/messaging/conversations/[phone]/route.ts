/**
 * API CONVERSATION [phone] — Historique et envoi dans une conversation
 * =====================================================================
 * GET  — Historique paginé des messages avec un numéro
 * POST — Envoyer un message freeform dans cette conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendMessage } from '@/lib/messaging/messaging.service';

/**
 * GET /api/messaging/conversations/[phone]
 * Returns paginated message history for a phone number
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { phone: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = 50;
        const phone = params.phone;

        const messages = await (prisma as any).message.findMany({
            where: {
                organizationId: session.user.organizationId,
                phone,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
            include: {
                sentBy: {
                    select: { id: true, nom: true, prenom: true },
                },
                lead: {
                    select: { id: true, nom: true, prenom: true, status: true },
                },
            },
        });

        const total = await (prisma as any).message.count({
            where: {
                organizationId: session.user.organizationId,
                phone,
            },
        });

        return NextResponse.json({
            messages: messages.reverse(), // Oldest first for chat display
            total,
            page,
            hasMore: page * limit < total,
        });
    } catch (error) {
        console.error('Erreur GET /api/messaging/conversations/[phone]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/messaging/conversations/[phone]
 * Send a message in conversation
 * Body: { text, channel?, templateKey?, params?, leadId? }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { phone: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { text, channel, templateKey, templateParams, leadId } = body;

        if (!text && !templateKey) {
            return NextResponse.json({ error: 'text ou templateKey requis' }, { status: 400 });
        }

        const result = await sendMessage(session.user.organizationId, {
            to: params.phone,
            text,
            channel: channel || 'whatsapp',
            templateKey,
            params: templateParams,
            leadId,
            sentById: session.user.id,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Erreur POST /api/messaging/conversations/[phone]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

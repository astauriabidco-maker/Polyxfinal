/**
 * API CONVERSATION READ — Marquer les messages comme lus
 * =======================================================
 * PUT — Marque tous les messages INBOUND non-lus comme lus
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/messaging/conversations/[phone]/read
 * Mark all inbound messages from this phone as read
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { phone: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const updated = await (prisma as any).message.updateMany({
            where: {
                organizationId: session.user.organizationId,
                phone: params.phone,
                direction: 'INBOUND',
                isRead: false,
            },
            data: { isRead: true },
        });

        return NextResponse.json({ updated: updated.count });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/conversations/[phone]/read:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

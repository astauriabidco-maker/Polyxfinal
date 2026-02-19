/**
 * BROADCAST BY ID — Details, Start, Cancel
 * ==========================================
 * GET    — Broadcast details with recipient list
 * PUT    — Start or pause the broadcast
 * DELETE — Cancel / delete a broadcast
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startBroadcast } from '@/lib/messaging/broadcast.service';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id } = await params;

        const broadcast = await (prisma as any).broadcast.findFirst({
            where: { id, organizationId: session.user.organizationId },
            include: {
                recipients: {
                    orderBy: { createdAt: 'asc' },
                    take: 100,
                },
            },
        });

        if (!broadcast) {
            return NextResponse.json({ error: 'Broadcast introuvable' }, { status: 404 });
        }

        return NextResponse.json({ broadcast });
    } catch (error) {
        console.error('Erreur GET /api/messaging/broadcasts/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action } = body; // 'start', 'pause', 'cancel'

        const existing = await (prisma as any).broadcast.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Broadcast introuvable' }, { status: 404 });
        }

        if (action === 'start') {
            if (existing.status !== 'DRAFT') {
                return NextResponse.json({ error: 'Seul un brouillon peut être lancé' }, { status: 400 });
            }

            // Start sending in background (non-blocking)
            startBroadcast(id).catch(err =>
                console.error(`[Broadcast ${id}] Error:`, err)
            );

            return NextResponse.json({
                success: true,
                message: 'Broadcast lancé',
                status: 'SENDING',
            });
        }

        if (action === 'pause') {
            await (prisma as any).broadcast.update({
                where: { id },
                data: { status: 'PAUSED' },
            });
            return NextResponse.json({ success: true, status: 'PAUSED' });
        }

        if (action === 'cancel') {
            await (prisma as any).broadcast.update({
                where: { id },
                data: { status: 'CANCELLED' },
            });
            return NextResponse.json({ success: true, status: 'CANCELLED' });
        }

        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/broadcasts/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id } = await params;

        const existing = await (prisma as any).broadcast.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Broadcast introuvable' }, { status: 404 });
        }

        await (prisma as any).broadcast.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/broadcasts/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

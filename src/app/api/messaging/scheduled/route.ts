/**
 * SCHEDULED MESSAGES — Queue Management
 * ========================================
 * GET  — List scheduled messages (with filters)
 * POST — Schedule a manual message
 * DELETE — Cancel a pending message
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // PENDING, SENT, FAILED, CANCELLED
        const limit = parseInt(searchParams.get('limit') || '50');

        const where: any = {
            organizationId: session.user.organizationId,
        };
        if (status) where.status = status;

        const scheduled = await (prisma as any).scheduledMessage.findMany({
            where,
            orderBy: { scheduledAt: 'desc' },
            take: limit,
            include: {
                automation: { select: { name: true, event: true } },
            },
        });

        // Count by status
        const counts = await (prisma as any).scheduledMessage.groupBy({
            by: ['status'],
            where: { organizationId: session.user.organizationId },
            _count: true,
        });

        const statusCounts: Record<string, number> = {};
        for (const c of counts) {
            statusCounts[c.status] = c._count;
        }

        return NextResponse.json({ scheduled, counts: statusCounts });
    } catch (error) {
        console.error('Erreur GET /api/messaging/scheduled:', error);
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
        const { phone, content, scheduledAt, channel, templateKey, leadId, dossierId } = body;

        if (!phone || !content || !scheduledAt) {
            return NextResponse.json({ error: 'phone, content et scheduledAt sont requis' }, { status: 400 });
        }

        const scheduled = await (prisma as any).scheduledMessage.create({
            data: {
                organizationId: session.user.organizationId,
                phone: phone.replace(/[\s\-\(\)\+]/g, ''),
                content,
                channel: channel || 'WHATSAPP',
                templateKey: templateKey || null,
                scheduledAt: new Date(scheduledAt),
                sentById: session.user.id || null,
                leadId: leadId || null,
                dossierId: dossierId || null,
            },
        });

        return NextResponse.json({ scheduled }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/messaging/scheduled:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id requis' }, { status: 400 });
        }

        const existing = await (prisma as any).scheduledMessage.findFirst({
            where: {
                id,
                organizationId: session.user.organizationId,
                status: 'PENDING',
            },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Message introuvable ou déjà envoyé' }, { status: 404 });
        }

        await (prisma as any).scheduledMessage.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/scheduled:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

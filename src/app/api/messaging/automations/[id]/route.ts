/**
 * AUTOMATION BY ID — Update & Delete
 * ======================================
 * PUT    — Update (toggle active, edit content)
 * DELETE — Remove an automation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

        // Verify ownership
        const existing = await (prisma as any).messageAutomation.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Automation introuvable' }, { status: 404 });
        }

        const updated = await (prisma as any).messageAutomation.update({
            where: { id },
            data: {
                name: body.name ?? existing.name,
                description: body.description ?? existing.description,
                event: body.event ?? existing.event,
                channel: body.channel ?? existing.channel,
                templateKey: body.templateKey ?? existing.templateKey,
                content: body.content ?? existing.content,
                delayMinutes: body.delayMinutes ?? existing.delayMinutes,
                conditions: body.conditions !== undefined
                    ? (body.conditions ? JSON.stringify(body.conditions) : null)
                    : existing.conditions,
                isActive: body.isActive ?? existing.isActive,
            },
        });

        return NextResponse.json({ automation: updated });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/automations/[id]:', error);
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

        const existing = await (prisma as any).messageAutomation.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Automation introuvable' }, { status: 404 });
        }

        await (prisma as any).messageAutomation.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/automations/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

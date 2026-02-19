/**
 * AUTOMATIONS CRUD — List & Create Automations
 * ===============================================
 * GET  — List all automations for the organization
 * POST — Create a new automation rule
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const automations = await (prisma as any).messageAutomation.findMany({
            where: { organizationId: session.user.organizationId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { scheduledMessages: true } },
            },
        });

        return NextResponse.json({ automations });
    } catch (error) {
        console.error('Erreur GET /api/messaging/automations:', error);
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
        const { name, description, event, channel, templateKey, content, delayMinutes, conditions, isActive } = body;

        if (!name || !event) {
            return NextResponse.json({ error: 'name et event sont requis' }, { status: 400 });
        }

        const automation = await (prisma as any).messageAutomation.create({
            data: {
                organizationId: session.user.organizationId,
                name,
                description: description || null,
                event,
                channel: channel || 'WHATSAPP',
                templateKey: templateKey || null,
                content: content || null,
                delayMinutes: delayMinutes || 0,
                conditions: conditions ? JSON.stringify(conditions) : null,
                isActive: isActive !== false,
            },
        });

        return NextResponse.json({ automation }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/messaging/automations:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

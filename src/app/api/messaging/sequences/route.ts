/**
 * SEQUENCES CRUD — List, Create, Update, Delete
 * ================================================
 * GET  — List sequences with steps
 * POST — Create sequence with steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const sequences = await (prisma as any).messageSequence.findMany({
            where: { organizationId: session.user.organizationId },
            include: {
                steps: { orderBy: { stepOrder: 'asc' } },
                _count: { select: { enrollments: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ sequences });
    } catch (error) {
        console.error('Erreur GET /api/messaging/sequences:', error);
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
        const { name, description, triggerEvent, stopOnReply, steps } = body;

        if (!name || !triggerEvent || !steps?.length) {
            return NextResponse.json({ error: 'name, triggerEvent et steps sont requis' }, { status: 400 });
        }

        const sequence = await (prisma as any).messageSequence.create({
            data: {
                organizationId: session.user.organizationId,
                name,
                description: description || null,
                triggerEvent,
                stopOnReply: stopOnReply !== false,
                steps: {
                    create: steps.map((step: any, index: number) => ({
                        stepOrder: index + 1,
                        delayDays: step.delayDays || 0,
                        channel: step.channel || 'WHATSAPP',
                        templateKey: step.templateKey || null,
                        content: step.content || null,
                    })),
                },
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });

        return NextResponse.json({ sequence }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/messaging/sequences:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, description, triggerEvent, stopOnReply, isActive, steps } = body;

        if (!id) {
            return NextResponse.json({ error: 'id requis' }, { status: 400 });
        }

        const existing = await (prisma as any).messageSequence.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Séquence introuvable' }, { status: 404 });
        }

        // Update sequence
        const updated = await (prisma as any).messageSequence.update({
            where: { id },
            data: {
                name: name ?? existing.name,
                description: description ?? existing.description,
                triggerEvent: triggerEvent ?? existing.triggerEvent,
                stopOnReply: stopOnReply ?? existing.stopOnReply,
                isActive: isActive ?? existing.isActive,
            },
        });

        // If steps provided, replace them all
        if (steps) {
            await (prisma as any).messageSequenceStep.deleteMany({
                where: { sequenceId: id },
            });
            await (prisma as any).messageSequenceStep.createMany({
                data: steps.map((step: any, index: number) => ({
                    sequenceId: id,
                    stepOrder: index + 1,
                    delayDays: step.delayDays || 0,
                    channel: step.channel || 'WHATSAPP',
                    templateKey: step.templateKey || null,
                    content: step.content || null,
                })),
            });
        }

        const result = await (prisma as any).messageSequence.findUnique({
            where: { id },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });

        return NextResponse.json({ sequence: result });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/sequences:', error);
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

        const existing = await (prisma as any).messageSequence.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Séquence introuvable' }, { status: 404 });
        }

        await (prisma as any).messageSequence.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/sequences:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

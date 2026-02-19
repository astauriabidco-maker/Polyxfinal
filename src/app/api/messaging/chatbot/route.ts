/**
 * CHATBOT RULES CRUD — Manage auto-reply rules
 * ================================================
 * GET    — List all rules (+ seed defaults if none exist)
 * POST   — Create a new rule
 * PUT    — Update a rule
 * DELETE — Delete a rule (non-default only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { seedDefaultRules, releaseHumanHandoff } from '@/lib/messaging/chatbot.service';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // Auto-seed default rules if first time
        await seedDefaultRules(session.user.organizationId);

        const rules = await (prisma as any).chatbotRule.findMany({
            where: { organizationId: session.user.organizationId },
            orderBy: { priority: 'desc' },
        });

        // Get active handoffs
        const handoffs = await (prisma as any).chatbotConversation.findMany({
            where: {
                organizationId: session.user.organizationId,
                isHumanHandoff: true,
            },
            select: { phone: true, handoffAt: true },
        });

        return NextResponse.json({ rules, handoffs });
    } catch (error) {
        console.error('Erreur GET /api/messaging/chatbot:', error);
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
        const { name, keywords, pattern, responseType, response, priority } = body;

        if (!name || !keywords || !response) {
            return NextResponse.json({ error: 'name, keywords et response requis' }, { status: 400 });
        }

        const rule = await (prisma as any).chatbotRule.create({
            data: {
                organizationId: session.user.organizationId,
                name,
                keywords,
                pattern: pattern || null,
                responseType: responseType || 'TEXT',
                response: typeof response === 'string' ? response : JSON.stringify(response),
                priority: priority || 0,
            },
        });

        return NextResponse.json({ rule }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/messaging/chatbot:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();

        // Special action: release handoff
        if (body.action === 'release_handoff' && body.phone) {
            await releaseHumanHandoff(session.user.organizationId, body.phone);
            return NextResponse.json({ success: true });
        }

        const { id, ...updates } = body;
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

        // Ensure response is string
        if (updates.response && typeof updates.response !== 'string') {
            updates.response = JSON.stringify(updates.response);
        }

        const rule = await (prisma as any).chatbotRule.update({
            where: { id },
            data: updates,
        });

        return NextResponse.json({ rule });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/chatbot:', error);
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
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

        // Check if it's a default rule
        const rule = await (prisma as any).chatbotRule.findFirst({
            where: { id, organizationId: session.user.organizationId },
        });
        if (!rule) return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 });

        await (prisma as any).chatbotRule.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/chatbot:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

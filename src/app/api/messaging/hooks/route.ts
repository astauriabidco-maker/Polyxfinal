/**
 * API — Messaging Hooks Configuration
 * ====================================
 * GET  — Returns current hook toggles for the organization
 * PUT  — Updates hook toggles (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { HOOK_NAMES, HOOK_LABELS } from '@/lib/messaging/notification-hooks';

// ─── GET: Current hook states ────────────────────────────────

export async function GET() {
    const session = await auth();
    if (!session?.user?.organizationId) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    try {
        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId: session.user.organizationId },
            select: { isActive: true, enabledHooks: true },
        });

        const enabledHooks = (config?.enabledHooks as Record<string, boolean>) || {};

        // Build response with all hooks and their state
        const hooks = Object.entries(HOOK_LABELS).map(([key, meta]) => ({
            id: key,
            ...meta,
            enabled: enabledHooks[key] === true,
        }));

        return NextResponse.json({
            messagingActive: config?.isActive || false,
            hooks,
        });
    } catch (error) {
        console.error('Erreur GET /api/messaging/hooks:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// ─── PUT: Update hook toggles ────────────────────────────────

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.organizationId) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { hookId, enabled } = body;

        if (!hookId || typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'hookId et enabled requis' }, { status: 400 });
        }

        // Validate hook name
        const validHooks = Object.values(HOOK_NAMES);
        if (!validHooks.includes(hookId)) {
            return NextResponse.json({ error: `Hook inconnu: ${hookId}` }, { status: 400 });
        }

        // Get current config
        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId: session.user.organizationId },
            select: { enabledHooks: true },
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration WhatsApp non trouvée. Configurez d\'abord la messagerie.' }, { status: 404 });
        }

        // Update the specific hook
        const currentHooks = (config.enabledHooks as Record<string, boolean>) || {};
        const updatedHooks = { ...currentHooks, [hookId]: enabled };

        await (prisma as any).messagingConfig.update({
            where: { organizationId: session.user.organizationId },
            data: { enabledHooks: updatedHooks },
        });

        console.log(`[Hooks] ${hookId} ${enabled ? 'ENABLED' : 'DISABLED'} for org ${session.user.organizationId}`);

        return NextResponse.json({ success: true, hookId, enabled });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/hooks:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

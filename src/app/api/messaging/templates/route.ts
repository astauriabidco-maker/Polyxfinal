/**
 * API MESSAGING TEMPLATES — CRUD des mappages de templates
 * ==========================================================
 * GET  - Liste les templates de l'organisation
 * POST - Crée un nouveau mapping template
 * PUT  - Met à jour un template existant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/messaging/templates
 * Liste tous les templates messaging de l'organisation
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        const organizationId = session.user.organizationId;

        // Get config first
        const config = await prisma.messagingConfig.findUnique({
            where: { organizationId },
        });

        if (!config) {
            return NextResponse.json({ templates: [], message: 'Aucune configuration messaging' });
        }

        const templates = await prisma.messageTemplate.findMany({
            where: { messagingConfigId: config.id },
            orderBy: { internalKey: 'asc' },
        });

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Erreur GET /api/messaging/templates:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/messaging/templates
 * Crée un nouveau mapping template
 * Body: { internalKey, providerTemplateName, language?, fallbackText?, isActive? }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { internalKey, providerTemplateName, language, fallbackText, isActive } = body;

        if (!internalKey || !providerTemplateName) {
            return NextResponse.json(
                { error: 'internalKey et providerTemplateName requis' },
                { status: 400 }
            );
        }

        // Get or create config
        let config = await prisma.messagingConfig.findUnique({
            where: { organizationId },
        });

        if (!config) {
            return NextResponse.json(
                { error: 'Configurez d\'abord le provider messaging via /api/messaging/config' },
                { status: 400 }
            );
        }

        const template = await prisma.messageTemplate.create({
            data: {
                messagingConfigId: config.id,
                internalKey,
                providerTemplateName,
                language: language || 'fr',
                fallbackText: fallbackText || null,
                isActive: isActive ?? true,
            },
        });

        return NextResponse.json({ success: true, template }, { status: 201 });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json(
                { error: 'Un template avec cette clé interne existe déjà' },
                { status: 409 }
            );
        }
        console.error('Erreur POST /api/messaging/templates:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * PUT /api/messaging/templates
 * Met à jour un template existant
 * Body: { id, providerTemplateName?, fallbackText?, isActive?, language? }
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { id, providerTemplateName, fallbackText, isActive, language } = body;

        if (!id) {
            return NextResponse.json({ error: 'id du template requis' }, { status: 400 });
        }

        // Verify ownership via config
        const config = await prisma.messagingConfig.findUnique({
            where: { organizationId },
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration messaging introuvable' }, { status: 404 });
        }

        // Check template belongs to this config
        const existing = await prisma.messageTemplate.findFirst({
            where: { id, messagingConfigId: config.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
        }

        const template = await prisma.messageTemplate.update({
            where: { id },
            data: {
                ...(providerTemplateName !== undefined && { providerTemplateName }),
                ...(fallbackText !== undefined && { fallbackText: fallbackText || null }),
                ...(isActive !== undefined && { isActive }),
                ...(language !== undefined && { language }),
            },
        });

        return NextResponse.json({ success: true, template });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/templates:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * API MESSAGING TEMPLATES META — CRUD sur Meta Cloud API
 * ========================================================
 * GET    - Liste les templates depuis le WABA Meta
 * POST   - Crée un template et le soumet à Meta pour approbation
 * DELETE - Supprime un template chez Meta
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MetaCloudProvider, CreateMetaTemplateInput } from '@/lib/messaging/providers/meta-cloud';

function getMetaProvider(config: any): MetaCloudProvider | null {
    if (config.provider !== 'META_CLOUD') return null;
    if (!config.metaPhoneNumberId || !config.metaAccessToken || !config.metaBusinessId) return null;

    return new MetaCloudProvider({
        phoneNumberId: config.metaPhoneNumberId,
        accessToken: config.metaAccessToken,
        businessAccountId: config.metaBusinessId,
    });
}

/**
 * GET /api/messaging/templates/meta
 * Liste tous les templates existants sur le WABA
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

        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId: session.user.organizationId },
        });

        if (!config) {
            return NextResponse.json({ error: 'Configurez d\'abord la messagerie' }, { status: 400 });
        }

        const provider = getMetaProvider(config);
        if (!provider) {
            return NextResponse.json({ error: 'Provider Meta Cloud non configuré (vérifiez Phone Number ID, Business ID et Access Token)' }, { status: 400 });
        }

        const result = await provider.listTemplates();

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 422 });
        }

        return NextResponse.json({ templates: result.templates });
    } catch (error) {
        console.error('Erreur GET /api/messaging/templates/meta:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/messaging/templates/meta
 * Crée un nouveau template et le soumet pour approbation
 * Body: { name, language, category, components }
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

        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId: session.user.organizationId },
        });

        if (!config) {
            return NextResponse.json({ error: 'Configurez d\'abord la messagerie' }, { status: 400 });
        }

        const provider = getMetaProvider(config);
        if (!provider) {
            return NextResponse.json({ error: 'Provider Meta Cloud non configuré' }, { status: 400 });
        }

        const body = await request.json();
        const { name, language, category, components } = body as CreateMetaTemplateInput;

        if (!name || !language || !category || !components?.length) {
            return NextResponse.json(
                { error: 'name, language, category et components requis' },
                { status: 400 }
            );
        }

        // Validate template name format (lowercase alphanumeric + underscores)
        if (!/^[a-z0-9_]+$/.test(name)) {
            return NextResponse.json(
                { error: 'Le nom du template doit contenir uniquement des lettres minuscules, chiffres et underscores' },
                { status: 400 }
            );
        }

        const result = await provider.createTemplate({ name, language, category, components });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            templateId: result.templateId,
            status: result.status,
        }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/messaging/templates/meta:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * DELETE /api/messaging/templates/meta
 * Supprime un template par nom
 * Body: { name }
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }
        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId: session.user.organizationId },
        });

        if (!config) {
            return NextResponse.json({ error: 'Configurez d\'abord la messagerie' }, { status: 400 });
        }

        const provider = getMetaProvider(config);
        if (!provider) {
            return NextResponse.json({ error: 'Provider Meta Cloud non configuré' }, { status: 400 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: 'name requis' }, { status: 400 });
        }

        const result = await provider.deleteTemplate(name);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 422 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/templates/meta:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

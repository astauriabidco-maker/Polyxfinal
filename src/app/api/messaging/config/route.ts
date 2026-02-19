/**
 * API MESSAGING CONFIG — Configuration messagerie par organisation
 * =================================================================
 * GET  - Récupérer la config messaging de l'organisation
 * PUT  - Mettre à jour la config (provider, tokens, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/messaging/config
 * Récupère la config messaging + templates de l'organisation
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // Admin only
        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        const organizationId = session.user.organizationId;

        let config = await prisma.messagingConfig.findUnique({
            where: { organizationId },
            include: {
                templates: {
                    orderBy: { internalKey: 'asc' },
                },
            },
        });

        // Si aucune config, retourner une config vide
        if (!config) {
            return NextResponse.json({
                config: null,
                message: 'Aucune configuration messaging. Créez-en une via PUT.',
            });
        }

        // Masquer les tokens sensibles dans la réponse
        const safeConfig = {
            ...config,
            metaAccessToken: config.metaAccessToken ? '••••••••' + config.metaAccessToken.slice(-4) : null,
            twilioAuthToken: config.twilioAuthToken ? '••••••••' + config.twilioAuthToken.slice(-4) : null,
        };

        return NextResponse.json({ config: safeConfig });
    } catch (error) {
        console.error('Erreur GET /api/messaging/config:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * PUT /api/messaging/config
 * Créer ou mettre à jour la config messaging
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

        const {
            provider,
            isActive,
            metaPhoneNumberId,
            metaBusinessId,
            metaAccessToken,
            twilioAccountSid,
            twilioAuthToken,
            twilioPhoneNumber,
            defaultCountryCode,
        } = body;

        // Upsert config
        const config = await prisma.messagingConfig.upsert({
            where: { organizationId },
            create: {
                organizationId,
                provider: provider || 'META_CLOUD',
                isActive: isActive ?? false,
                metaPhoneNumberId: metaPhoneNumberId || null,
                metaBusinessId: metaBusinessId || null,
                metaAccessToken: metaAccessToken || null,
                twilioAccountSid: twilioAccountSid || null,
                twilioAuthToken: twilioAuthToken || null,
                twilioPhoneNumber: twilioPhoneNumber || null,
                defaultCountryCode: defaultCountryCode || '+33',
            },
            update: {
                provider: provider || undefined,
                isActive: isActive ?? undefined,
                metaPhoneNumberId: metaPhoneNumberId !== undefined ? (metaPhoneNumberId || null) : undefined,
                metaBusinessId: metaBusinessId !== undefined ? (metaBusinessId || null) : undefined,
                // Ne pas écraser le token s'il est masqué (••••)
                ...(metaAccessToken && !metaAccessToken.startsWith('••••') && { metaAccessToken }),
                twilioAccountSid: twilioAccountSid !== undefined ? (twilioAccountSid || null) : undefined,
                ...(twilioAuthToken && !twilioAuthToken.startsWith('••••') && { twilioAuthToken }),
                twilioPhoneNumber: twilioPhoneNumber !== undefined ? (twilioPhoneNumber || null) : undefined,
                defaultCountryCode: defaultCountryCode || undefined,
            },
        });

        return NextResponse.json({
            success: true,
            config: {
                ...config,
                metaAccessToken: config.metaAccessToken ? '••••••••' + config.metaAccessToken.slice(-4) : null,
                twilioAuthToken: config.twilioAuthToken ? '••••••••' + config.twilioAuthToken.slice(-4) : null,
            },
        });
    } catch (error) {
        console.error('Erreur PUT /api/messaging/config:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

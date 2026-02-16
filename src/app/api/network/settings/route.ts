/**
 * API NETWORK SETTINGS - Configuration complète du réseau franchise
 * ==================================================================
 * GET - Récupérer la configuration (templates + taux + conformité)
 * PUT - Mettre à jour la configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const orgId = session.user.organizationId;

        // Récupérer les settings réseau
        const settings = await prisma.networkSettings.findFirst({
            where: { organizationId: orgId },
        });

        // Récupérer les taux depuis l'organisation
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                royaltyRate: true,
                leadFeeRate: true,
            },
        });

        // Fusionner settings + taux org
        return NextResponse.json({
            // Templates emails
            onboardingEmailSubject: settings?.onboardingEmailSubject ?? "Signature de vos contrats de partenariat - Polyx ERP",
            onboardingEmailBody: settings?.onboardingEmailBody ?? "Bonjour {{contactName}},\n\nVeuillez signer vos contrats de partenariat ici : {{onboardingUrl}}\n\nDocuments joints : Contrat.pdf, DPA.pdf, CGV.pdf",
            activationEmailSubject: settings?.activationEmailSubject ?? "Activation de votre accès API - Polyx ERP",
            activationEmailBody: settings?.activationEmailBody ?? "Félicitations {{contactName}},\n\nVos contrats ont été contre-signés par Polyx ERP.\n\nVOTRE CLÉ API : {{apiKey}}\n\nDOCUMENTATION TECHNIQUE : {{docsUrl}}",
            apiDocumentationMarkdown: settings?.apiDocumentationMarkdown ?? "# Documentation API Partenaires\n\nIntégrez vos flux de leads...",
            // Conformité Loi Doubin
            doubinDelayDays: settings?.doubinDelayDays ?? 20,
            // Taux de redevance (depuis Organization)
            royaltyRate: org?.royaltyRate ?? 5.0,
            leadFeeRate: org?.leadFeeRate ?? 15.0,
        });
    } catch (error: any) {
        console.error('Erreur GET /api/network/settings:', error);
        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // Seuls les ADMIN peuvent modifier la configuration réseau
        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
        }

        const body = await request.json();
        const orgId = session.user.organizationId;

        // 1. Persister les templates + doubinDelayDays dans NetworkSettings
        const settings = await prisma.networkSettings.upsert({
            where: { organizationId: orgId },
            update: {
                onboardingEmailSubject: body.onboardingEmailSubject,
                onboardingEmailBody: body.onboardingEmailBody,
                activationEmailSubject: body.activationEmailSubject,
                activationEmailBody: body.activationEmailBody,
                apiDocumentationMarkdown: body.apiDocumentationMarkdown,
                doubinDelayDays: body.doubinDelayDays ?? 20,
            },
            create: {
                organizationId: orgId,
                onboardingEmailSubject: body.onboardingEmailSubject,
                onboardingEmailBody: body.onboardingEmailBody,
                activationEmailSubject: body.activationEmailSubject,
                activationEmailBody: body.activationEmailBody,
                apiDocumentationMarkdown: body.apiDocumentationMarkdown,
                doubinDelayDays: body.doubinDelayDays ?? 20,
            },
        });

        // 2. Persister les taux dans Organization
        if (body.royaltyRate !== undefined || body.leadFeeRate !== undefined) {
            await prisma.organization.update({
                where: { id: orgId },
                data: {
                    ...(body.royaltyRate !== undefined && { royaltyRate: body.royaltyRate }),
                    ...(body.leadFeeRate !== undefined && { leadFeeRate: body.leadFeeRate }),
                },
            });
        }

        return NextResponse.json({ success: true, settings });
    } catch (error) {
        console.error('Erreur PUT /api/network/settings:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * API NETWORK SETTINGS - Gestion des templates dynamiques
 * =======================================================
 * GET - Récupérer les templates de l'organisation
 * PUT - Mettre à jour les templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get('organizationId');

        let whereClause = {};
        if (orgId) {
            whereClause = { organizationId: orgId };
        }

        const settings = await prisma.networkSettings.findFirst({
            where: whereClause,
        });

        // Valeurs par défaut si non créées
        if (!settings) {
            return NextResponse.json({
                onboardingEmailSubject: "Signature de vos contrats de partenariat - Polyx ERP",
                onboardingEmailBody: "Bonjour {{contactName}},\n\nVeuillez signer vos contrats de partenariat ici : {{onboardingUrl}}\n\nDocuments joints : Contrat.pdf, DPA.pdf, CGV.pdf",
                activationEmailSubject: "Activation de votre accès API - Polyx ERP",
                activationEmailBody: "Félicitations {{contactName}},\n\nVos contrats ont été contre-signés par Polyx ERP.\n\nVOTRE CLÉ API : {{apiKey}}\n\nDOCUMENTATION TECHNIQUE : {{docsUrl}}",
                apiDocumentationMarkdown: "# Documentation API Partenaires\n\nIntégrez vos flux de leads...",
            });
        }

        return NextResponse.json(settings);
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

        const body = await request.json();

        const settings = await prisma.networkSettings.upsert({
            where: { organizationId: session.user.organizationId },
            update: {
                onboardingEmailSubject: body.onboardingEmailSubject,
                onboardingEmailBody: body.onboardingEmailBody,
                activationEmailSubject: body.activationEmailSubject,
                activationEmailBody: body.activationEmailBody,
                apiDocumentationMarkdown: body.apiDocumentationMarkdown,
            },
            create: {
                organizationId: session.user.organizationId,
                onboardingEmailSubject: body.onboardingEmailSubject,
                onboardingEmailBody: body.onboardingEmailBody,
                activationEmailSubject: body.activationEmailSubject,
                activationEmailBody: body.activationEmailBody,
                apiDocumentationMarkdown: body.apiDocumentationMarkdown,
            },
        });

        return NextResponse.json({ success: true, settings });
    } catch (error) {
        console.error('Erreur PUT /api/network/settings:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

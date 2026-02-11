/**
 * API DOCUMENTATION DOWNLOAD — Téléchargement PDF personnalisé
 * =============================================================
 * GET /api/partners/[id]/api-doc
 * 
 * Génère et retourne un PDF de documentation API personnalisé
 * pour le partenaire spécifié.
 * 
 * Accès : ADMIN ou RESP_ADMIN
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { ApiDocumentationPdf, ApiDocData } from '@/lib/partners/documents/api-doc-renderer';
import React from 'react';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        // 1. Auth
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role } = session.user;

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès refusé. Rôle ADMIN ou RESP_ADMIN requis.' },
                { status: 403 }
            );
        }

        // 2. Charger le partenaire
        const partner = await prisma.partner.findFirst({
            where: {
                id: params.id,
                organizationId,
            },
            include: {
                organization: true,
            },
        });

        if (!partner) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        // 3. Vérifier que le partenaire a une clé API
        if (!partner.apiKeyPrefix) {
            return NextResponse.json(
                { error: 'Ce partenaire n\'a pas encore de clé API. Activez-le d\'abord.' },
                { status: 400 }
            );
        }

        // 4. Construire les données pour le PDF
        const now = new Date();
        const formatDate = (d: Date) =>
            d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        // Déterminer la base URL
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const host = request.headers.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;

        const docData: ApiDocData = {
            partner: {
                companyName: partner.companyName,
                contactName: partner.contactName,
                contactEmail: partner.contactEmail,
                apiKeyPrefix: partner.apiKeyPrefix,
                rateLimit: partner.rateLimit,
            },
            org: {
                name: partner.organization.name,
                supportEmail: (partner.organization as any).contactEmail || `support@${partner.organization.name.toLowerCase().replace(/\s+/g, '')}.fr`,
            },
            meta: {
                generatedAt: formatDate(now),
                baseUrl,
            },
        };

        // 5. Générer le PDF
        const pdfBuffer = await renderToBuffer(
            React.createElement(ApiDocumentationPdf, { data: docData }) as any
        );

        // 6. Audit
        await prisma.auditLog.create({
            data: {
                organizationId,
                userId: session.user.id,
                userRole: role,
                action: 'API_DOC_DOWNLOAD',
                niveauAction: 'LECTURE',
                entityType: 'Partner',
                entityId: partner.id,
                newState: {
                    partnerName: partner.companyName,
                    downloadedAt: now.toISOString(),
                },
            },
        });

        console.log(`[API Doc] 📥 Documentation API téléchargée pour ${partner.companyName} par ${session.user.id}`);

        // 7. Retourner le PDF
        const filename = `API_Documentation_${partner.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().split('T')[0]}.pdf`;

        return new NextResponse(Buffer.from(pdfBuffer) as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('[API Doc Download] Error:', error instanceof Error ? error.message : error);
        console.error('[API Doc Download] Stack:', error instanceof Error ? error.stack : 'no stack');
        return NextResponse.json(
            { error: `Erreur lors de la génération de la documentation: ${error instanceof Error ? error.message : 'Erreur interne'}` },
            { status: 500 }
        );
    }
}

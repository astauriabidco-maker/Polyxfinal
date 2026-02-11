/**
 * API PARTNERS DOCUMENTS/PREVIEW — Prévisualisation PDF
 * =====================================================
 * GET /api/partners/[id]/documents/preview?type=CONTRACT|DPA
 * 
 * Génère dynamiquement le PDF à partir du template actif de l'organisme
 * et des données du partenaire. Retourne le PDF en streaming.
 * 
 * Accessible:
 *   - Par les admins (authentifiés)
 *   - Par le partenaire via la page d'onboarding (public, via partner ID)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { getActiveTemplate } from '@/lib/partners/documents/template-service';
import { DynamicDocumentPdf, buildDocumentData } from '@/lib/partners/documents/pdf-renderer';
import React from 'react';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const partnerId = params.id;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') as 'CONTRACT' | 'DPA' | null;

        if (!type || !['CONTRACT', 'DPA', 'CGV'].includes(type)) {
            return NextResponse.json(
                { error: 'Paramètre "type" requis (CONTRACT, DPA, ou CGV).' },
                { status: 400 }
            );
        }

        // Charger le partenaire avec l'organisation
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            include: {
                organization: true,
            },
        });

        if (!partner) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        // Charger le template actif de l'organisation
        const template = await getActiveTemplate(partner.organizationId, type);

        if (!template) {
            return NextResponse.json(
                { error: `Aucun template "${type}" trouvé pour cet organisme.` },
                { status: 404 }
            );
        }

        // Construire les données de contexte
        const data = buildDocumentData(partner, partner.organization);

        // Générer le PDF
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = React.createElement(DynamicDocumentPdf, {
            template: {
                title: template.title,
                sections: template.sections as { title: string; content: string }[],
                footerText: template.footerText || '',
            },
            data,
        }) as any;
        const pdfStream = await renderToStream(element);

        // Convertir le stream Node.js en ReadableStream pour Response
        const chunks: Uint8Array[] = [];
        for await (const chunk of pdfStream) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const pdfBuffer = Buffer.concat(chunks);

        const fileName = `${type.toLowerCase()}_${partner.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_v${template.version}.pdf`;

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${fileName}"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error) {
        console.error('[Documents Preview] Error:', error);
        return NextResponse.json({ error: 'Erreur lors de la génération du document' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { renderToStream } from '@react-pdf/renderer';
import { DIPTemplate } from '@/lib/network/documents/DIPTemplate';
import React from 'react';

export async function GET(
    request: NextRequest,
    { params }: { params: { candidateId: string } }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { candidateId } = params;

    try {
        // 1. Récupérer le candidat
        const candidate = await prisma.franchiseCandidate.findUnique({
            where: { id: candidateId },
            include: { organization: true }, // Head Office
        });

        if (!candidate) {
            return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 });
        }

        // 2. Générer le PDF en tant que stream
        const stream = await renderToStream(
            (<DIPTemplate
                candidate={candidate}
                organization={candidate.organization}
            />) as React.ReactElement
        );

        // 3. Retourner le stream avec les headers PDF
        return new NextResponse(stream as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="DIP_${candidate.companyName.replace(/\s+/g, '_')}.pdf"`,
            },
        });
    } catch (error) {
        console.error('[API DIP Generate] Erreur:', error);
        return NextResponse.json({ error: 'Erreur lors de la génération du document' }, { status: 500 });
    }
}

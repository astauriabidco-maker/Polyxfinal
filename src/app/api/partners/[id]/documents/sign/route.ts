/**
 * API PARTNERS DOCUMENTS - Signature des contrats de conformité
 * =============================================================
 * POST /api/partners/[id]/documents/sign
 * 
 * Simule la signature électronique du Contrat et du DPA.
 * C'est la "Compliance Gate" obligatoire avant activation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const partnerId = params.id;
        const body = await request.json();
        const { documentType } = body; // 'CONTRACT' ou 'DPA'

        if (!['CONTRACT', 'DPA'].includes(documentType)) {
            return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 });
        }

        const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
        });

        if (!partner) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        const updateData: any = {};
        if (documentType === 'CONTRACT') {
            updateData.contractSignedAt = new Date();
            updateData.contractUrl = `https://polyx-vault.s3.amazonaws.com/contracts/${partnerId}_signed.pdf`;
        } else {
            updateData.dpaSignedAt = new Date();
        }

        const updatedPartner = await prisma.partner.update({
            where: { id: partnerId },
            data: updateData,
        });

        // Log de l'action de signature (Crucial pour l'audit Qualiopi)
        await prisma.auditLog.create({
            data: {
                organizationId: partner.organizationId,
                userId: 'SYSTEM', // Ou l'ID de l'utilisateur qui signe si authentifié comme partenaire
                userRole: 'ADMIN',
                action: `SIGN_${documentType}`,
                niveauAction: 'VALIDATION',
                entityType: 'Partner',
                entityId: partnerId,
                newState: { signedAt: new Date() },
            }
        });

        return NextResponse.json({
            success: true,
            message: `${documentType} signé avec succès`,
            partner: updatedPartner
        });

    } catch (error) {
        console.error('Erreur signature document:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

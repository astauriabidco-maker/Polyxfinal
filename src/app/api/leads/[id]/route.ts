/**
 * API LEADS/[ID] - Gestion d'un lead spécifique
 * ================================================
 * PUT    - Modifier le statut/score/notes
 * DELETE - Anonymiser (RGPD droit à l'oubli)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface RouteParams {
    params: { id: string };
}

/**
 * PUT /api/leads/:id
 * Modifier le statut, score ou notes d'un lead
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const leadId = params.id;
        const organizationId = session.user.organizationId;
        const body = await request.json();

        // Vérifier que le lead appartient à l'organisation
        const existingLead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead non trouvé' }, { status: 404 });
        }

        const data: any = {};
        if (body.status) data.status = body.status;
        if (body.score !== undefined) data.score = body.score;
        if (body.notes !== undefined) data.notes = body.notes;
        if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId;

        // Si converti, enregistrer la date
        if (body.status === 'CONVERTED') {
            data.convertedAt = new Date();
            if (body.dossierId) data.convertedDossierId = body.dossierId;
        }

        const lead = await prisma.lead.update({
            where: { id: leadId },
            data,
        });

        return NextResponse.json({ success: true, lead });
    } catch (error) {
        console.error('Erreur PUT /api/leads/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * DELETE /api/leads/:id
 * RGPD : Anonymiser le lead (droit à l'oubli)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const leadId = params.id;
        const organizationId = session.user.organizationId;

        const existingLead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead non trouvé' }, { status: 404 });
        }

        // Anonymiser au lieu de supprimer (RGPD)
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                email: `anonymized-${leadId}@deleted.rgpd`,
                nom: 'ANONYMISÉ',
                prenom: 'ANONYMISÉ',
                telephone: null,
                codePostal: null,
                ville: null,
                message: null,
                metadata: Prisma.DbNull,
                status: 'ARCHIVED',
            },
        });

        // Marquer le consentement comme retiré
        await prisma.leadConsent.updateMany({
            where: { leadId },
            data: {
                withdrawnAt: new Date(),
                anonymizedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, message: 'Lead anonymisé conformément au RGPD' });
    } catch (error) {
        console.error('Erreur DELETE /api/leads/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

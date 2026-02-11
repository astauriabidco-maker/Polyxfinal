/**
 * API PARTNERS ONBOARDING - Données publiques pour la signature
 * =============================================================
 * GET /api/partners/onboarding/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const partner = await prisma.partner.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                companyName: true,
                contactName: true,
                status: true,
                contractSignedAt: true,
                dpaSignedAt: true,
                organization: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!partner) {
            return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
        }

        return NextResponse.json(partner);
    } catch (error) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * API — Royalty Calculation
 * ==========================
 * GET: Calcule les redevances dues par un franchisé
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getRoyaltiesDue, getNetworkRoyaltiesSummary } from '@/lib/network/royalties';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const organizationId = req.nextUrl.searchParams.get('organizationId');
    const month = req.nextUrl.searchParams.get('month');
    const summary = req.nextUrl.searchParams.get('summary');

    if (!month) {
        return NextResponse.json({ error: 'Paramètre "month" requis (format: YYYY-MM)' }, { status: 400 });
    }

    // Validation du format mois
    if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'Format de mois invalide (attendu: YYYY-MM)' }, { status: 400 });
    }

    try {
        // Mode résumé réseau (pour le HEAD_OFFICE)
        if (summary === 'network' && organizationId) {
            const result = await getNetworkRoyaltiesSummary(organizationId, month);
            return NextResponse.json(result);
        }

        // Mode franchisé individuel
        if (!organizationId) {
            return NextResponse.json({ error: 'Paramètre "organizationId" requis' }, { status: 400 });
        }

        const result = await getRoyaltiesDue(organizationId, month);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur de calcul';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

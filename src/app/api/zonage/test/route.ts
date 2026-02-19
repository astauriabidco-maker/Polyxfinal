/**
 * API ZONAGE/TEST - Tester un code postal
 * ==========================================
 * POST { codePostal } → retourne le site matché
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveZone } from '@/lib/prospection/lead-dispatch';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { codePostal } = body;

        if (!codePostal) {
            return NextResponse.json({ error: 'Code postal requis' }, { status: 400 });
        }

        const result = await resolveZone(session.user.organizationId, codePostal);

        if (!result) {
            return NextResponse.json({
                matched: false,
                message: `Aucune zone ne couvre le code postal "${codePostal}"`,
            });
        }

        return NextResponse.json({
            matched: true,
            siteId: result.siteId,
            siteName: result.siteName,
            prefix: result.prefix,
            label: result.label,
        });
    } catch (error) {
        console.error('Erreur POST /api/zonage/test:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

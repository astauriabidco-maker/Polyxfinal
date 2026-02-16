/**
 * API — Lead Dispatch
 * ====================
 * POST: Dispatche un dossier du siège vers un franchisé
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dispatchLead } from '@/lib/dossiers/dispatch';
import { dispatchLeadSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Seuls les ADMIN peuvent dispatcher des leads
    if (session.user.role?.code !== 'ADMIN') {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = dispatchLeadSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation échouée', details: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    try {
        const result = await dispatchLead(parsed.data.dossierId, parsed.data.studentZipCode);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur de dispatching';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

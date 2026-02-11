/**
 * API — Lead Dispatch
 * ====================
 * POST: Dispatche un dossier du siège vers un franchisé
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dispatchLead } from '@/lib/network/dispatch';
import { z } from 'zod';

const dispatchSchema = z.object({
    dossierId: z.string().min(1, 'dossierId requis'),
    studentZipCode: z.string().min(4, 'Code postal requis'),
});

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = dispatchSchema.safeParse(body);

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

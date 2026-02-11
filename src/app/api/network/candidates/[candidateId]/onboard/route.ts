/**
 * API — Onboard Franchisee
 * =========================
 * POST: Transforme un candidat signé en franchise opérationnelle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { onboardFranchisee } from '@/lib/network/onboard';
import { z } from 'zod';

const onboardSchema = z.object({
    adminPassword: z.string().min(8, 'Mot de passe min 8 caractères'),
    siret: z.string().length(14, 'SIRET doit contenir 14 caractères'),
    city: z.string().min(1, 'Ville requise'),
    zipCode: z.string().min(4, 'Code postal requis'),
    address: z.string().optional(),
});

export async function POST(
    req: NextRequest,
    { params }: { params: { candidateId: string } }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifier le rôle ADMIN
    if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = onboardSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation échouée', details: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    const result = await onboardFranchisee({
        candidateId: params.candidateId,
        ...parsed.data,
    });

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
        message: 'Franchise créée avec succès',
        organization: result.organization,
    }, { status: 201 });
}

/**
 * API — Onboard Franchisee
 * =========================
 * POST: Transforme un candidat signé en franchise opérationnelle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { onboardFranchisee } from '@/lib/network/onboard';
import { onboardFranchiseeSchema } from '@/lib/validation';

export async function POST(
    req: NextRequest,
    { params }: { params: { candidateId: string } }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifier le rôle ADMIN
    if (session.user.role.code !== 'ADMIN') {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = onboardFranchiseeSchema.safeParse(body);

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

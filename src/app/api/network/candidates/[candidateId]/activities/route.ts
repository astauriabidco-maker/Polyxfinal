import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

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
        const activities = await prisma.candidateActivity.findMany({
            where: { candidateId },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(activities);
    } catch (error) {
        console.error('[API Candidate Activities] Erreur:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

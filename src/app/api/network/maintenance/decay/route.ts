import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { processMotivationDecay } from '@/lib/network/motivation';

/**
 * Endpoint de maintenance pour lancer le script de dégradation de la motivation.
 * En production, cet endpoint peut être appelé par un cron job sécurisé via un secret.
 */
export async function POST(request: NextRequest) {
    const session = await auth();

    // Protection par rôle ADMIN ou token secret pour un cron
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.MAINTENANCE_SECRET}`;

    if (!session && !isCron) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    if (session && session.user.role !== 'ADMIN' && !isCron) {
        return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });
    }

    try {
        const result = await processMotivationDecay();
        return NextResponse.json({
            success: true,
            message: 'Script de dégradation de la motivation exécuté avec succès.',
            data: result
        });
    } catch (error) {
        console.error('[API Decay] Erreur maintenance:', error);
        return NextResponse.json({ error: 'Erreur lors de l\'exécution du script' }, { status: 500 });
    }
}

/**
 * API SUPERVISEUR — Scan manuel
 * =============================
 * Endpoint pour déclencher manuellement le scan de conformité du superviseur.
 * IDÉALEMENT protégé (admin only) ou utilisé par un cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupervisorService } from '@/lib/compliance/supervisor/supervisor.service';

export async function GET(request: NextRequest) {
    // TODO: Ajouter vérification authentification / rôles (RBAC)
    // const session = await auth();
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const results = await SupervisorService.runAllScans();

        // Calcul du nombre total d'alertes
        const totalAlerts = Object.values(results).reduce((acc, curr) => acc + curr.length, 0);

        return NextResponse.json({
            success: true,
            timestamp: new Date(),
            totalAlerts,
            details: results
        });
    } catch (error) {
        console.error('[API Supervisor] Erreur scan:', error);
        return NextResponse.json(
            { error: 'Erreur lors de l\'exécution du scan superviseur' },
            { status: 500 }
        );
    }
}

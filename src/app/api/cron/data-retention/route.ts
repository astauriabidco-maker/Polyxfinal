/**
 * API DATA RETENTION — Purge RGPD automatique
 * ==============================================
 * POST /api/cron/data-retention  — Anonymise les leads expirés (cron quotidien)
 * 
 * Sécurité : Protégée par CRON_SECRET header
 * 
 * @Compliance: RGPD Art. 5 (1)(e), Art. 17, Délibération CNIL 2019-131
 */

import { NextRequest, NextResponse } from 'next/server';
import { anonymizeExpiredLeads, getRetentionStats } from '@/lib/prospection/data-retention';

const CRON_SECRET = process.env.CRON_SECRET || 'default-cron-secret';

export async function POST(req: NextRequest) {
    try {
        // Authentification par secret — sécurité cron
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dryRun = searchParams.get('dryRun') === 'true';
        const months = parseInt(searchParams.get('months') || '36', 10);

        console.log(`[CRON] 🗓️ Démarrage purge RGPD — rétention: ${months} mois${dryRun ? ' [DRY RUN]' : ''}`);

        const result = await anonymizeExpiredLeads(months, dryRun);

        return NextResponse.json({
            success: true,
            ...result,
            message: dryRun
                ? `[DRY RUN] ${result.leadsAnonymized} leads seraient anonymisés`
                : `${result.leadsAnonymized} leads anonymisés en ${result.durationMs}ms`,
        });
    } catch (error) {
        console.error('[CRON Data Retention] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * GET — Statistiques de conservation (pour le dashboard)
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const stats = await getRetentionStats();

        return NextResponse.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('[CRON Data Retention Stats] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * CRON RÉTENTION RGPD — Anonymisation automatique
 * ===================================================
 * GET /api/cron/rgpd-retention
 * 
 * Ce endpoint est conçu pour être appelé quotidiennement par un
 * service de CRON (Vercel Cron, GitHub Actions, ou cron système).
 * 
 * Il anonymise automatiquement les leads dont la durée de conservation
 * (36 mois par défaut) est dépassée.
 * 
 * Sécurité :
 *   - Protégé par un token CRON_SECRET (header Authorization)
 *   - Logging complet dans AuditLog
 *   - Mode dry-run disponible (query ?dryRun=true)
 * 
 * @Compliance: RGPD Art. 5.1.e (limitation de conservation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { anonymizeExpiredLeads, getRetentionStats } from '@/lib/prospection/data-retention';

// Configurable via env var ; par défaut "polyx-cron-secret"
const CRON_SECRET = process.env.CRON_SECRET || 'polyx-cron-secret';

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    // ── 1. Vérification du token CRON ────────────────────────
    const authHeader = request.headers.get('Authorization');
    const cronToken = authHeader?.replace('Bearer ', '');

    if (cronToken !== CRON_SECRET) {
        console.warn('[CRON RGPD] ⛔ Tentative non autorisée');
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // ── 2. Vérifier le mode (dry-run vs live) ────────────────
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const retentionMonths = parseInt(url.searchParams.get('months') || '36') || 36;

    console.log(`[CRON RGPD] 🕐 Démarrage — mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}, rétention: ${retentionMonths} mois`);

    try {
        // ── 3. Statistiques avant exécution ───────────────────
        const statsBefore = await getRetentionStats();

        // ── 4. Exécution de l'anonymisation ───────────────────
        const result = await anonymizeExpiredLeads(retentionMonths, dryRun);

        // ── 5. Statistiques après exécution ───────────────────
        const statsAfter = await getRetentionStats();

        // ── 6. Journalisation de l'exécution CRON ──────────────
        if (!dryRun && result.leadsAnonymized > 0) {
            // Log structuré pour monitoring (Vercel, Datadog, etc.)
            console.log(JSON.stringify({
                event: 'RGPD_CRON_RETENTION',
                timestamp: new Date().toISOString(),
                leadsAnonymized: result.leadsAnonymized,
                consentsUpdated: result.consentsUpdated,
                retentionMonths,
                totalProcessed: result.totalProcessed,
                durationMs: result.durationMs,
                errors: result.errors,
            }));
        }

        const totalDuration = Date.now() - startTime;

        console.log(`[CRON RGPD] ✅ Terminé en ${totalDuration}ms — ${result.leadsAnonymized} leads anonymisés${dryRun ? ' (dry-run)' : ''}`);

        // ── 7. Réponse détaillée ──────────────────────────────
        return NextResponse.json({
            success: true,
            mode: dryRun ? 'DRY_RUN' : 'LIVE',
            retentionMonths,
            result: {
                totalProcessed: result.totalProcessed,
                leadsAnonymized: result.leadsAnonymized,
                consentsUpdated: result.consentsUpdated,
                durationMs: result.durationMs,
                errors: result.errors,
            },
            stats: {
                before: statsBefore,
                after: dryRun ? null : statsAfter,
            },
            executedAt: new Date().toISOString(),
            totalDurationMs: totalDuration,
        });
    } catch (error: any) {
        console.error('[CRON RGPD] ❌ Erreur:', error?.message);

        return NextResponse.json({
            success: false,
            error: error?.message || 'Erreur inconnue',
            executedAt: new Date().toISOString(),
        }, { status: 500 });
    }
}

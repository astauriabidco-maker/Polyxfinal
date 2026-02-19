/**
 * SERVICE SUPERVISEUR DE CONFORMITÉ (WATCHDOG)
 * ============================================
 * Ce service agit comme un auditeur permanent. Il scanne périodiquement
 * les données de la base pour détecter les anomalies de conformité.
 */

import { prisma } from '@/lib/prisma';
import { getRetentionStats } from '@/lib/prospection/data-retention';

export interface ComplianceAlert {
    id: string;
    module: 'RGPD' | 'QUALIOPI' | 'BPF' | 'DRIEETS';
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    details?: string;
    actionRequired?: string;
    createdAt: Date;
}

export class SupervisorService {

    /**
     * Lance un scan complet de la conformité RGPD.
     * @returns Liste des anomalies détectées
     */
    static async scanRGPD(): Promise<ComplianceAlert[]> {
        const alerts: ComplianceAlert[] = [];
        const now = new Date();

        try {
            // 1. Récupération des données RGPD existantes

            /* ─── A. Vérification de la Rétention (Droit à l'oubli) ─── */
            // On utilise la fonction existante pour récupérer les stats
            const stats = await getRetentionStats(); // Scan global (toutes orgs) ou spécifier orgId si contextuel

            // Le champ renvoyé par getRetentionStats est 'nextPurgeEligible' qui est (older36m - anonymized)
            // Mais dans le type retourné par l'appel, typescript ne le voit pas forcément si non typé explicitement.
            // On cast le retour ou on accède proprement. getRetentionStats retourne un objet typé implicitement.
            const eligibleCount = (stats as any).nextPurgeEligible || 0;

            if (eligibleCount > 0) {
                alerts.push({
                    id: `rgpd-retention-${now.getTime()}`,
                    module: 'RGPD',
                    severity: 'CRITICAL',
                    message: `${eligibleCount} fiches contact dépassent la durée de conservation légale (3 ans).`,
                    details: 'Ces données doivent être purgées ou anonymisées sans délai pour respecter le principe de limitation de la conservation.',
                    actionRequired: '/prospection/rgpd?tab=retention',
                    createdAt: now
                });
            }

            /* ─── B. Vérification des Sous-traitants (DPA manquants) ─── */
            // TODO: Connecter au vrai registre quand il sera persisté
            // Pour l'instant, pas d'alerte DPA simulée pour éviter le bruit


        } catch (error) {
            console.error('[Supervisor] Erreur lors du scan RGPD:', error);
            alerts.push({
                id: `rgpd-error-${now.getTime()}`,
                module: 'RGPD',
                severity: 'WARNING',
                message: 'Le scan de surveillance RGPD a échoué.',
                details: error instanceof Error ? error.message : 'Erreur inconnue',
                createdAt: now
            });
        }

        return alerts;
    }

    /**
     * Lance tous les scans disponibles.
     */
    static async runAllScans(): Promise<Record<string, ComplianceAlert[]>> {
        console.log('[Supervisor] 🕵️‍♂️ Démarrage des scans de conformité...');

        const rgpdAlerts = await this.scanRGPD();
        // const qualiopiAlerts = await this.scanQualiopi(); // À venir
        // const bpfAlerts = await this.scanBPF(); // À venir

        const results = {
            rgpd: rgpdAlerts,
            qualiopi: [],
            bpf: []
        };

        const totalAlerts = rgpdAlerts.length;
        console.log(`[Supervisor] Scan terminé. ${totalAlerts} alerte(s) détectée(s).`);

        return results;
    }
}

/**
 * LEAD DATA RETENTION — Politique de conservation RGPD
 * ========================================================
 * Anonymise automatiquement les leads dont la durée de conservation
 * a été dépassée (36 mois par défaut pour les OF).
 * 
 * Conformité :
 *   - RGPD Art. 5 (1)(e) : Limitation de la conservation
 *   - RGPD Art. 17 : Droit à l'effacement
 *   - RGPD Art. 20 : Droit à la portabilité
 *   - Délibération CNIL n° 2019-131 : recommandation de purge
 * 
 * Usage :
 *   - Cron job quotidien via /api/cron/data-retention
 *   - Ou manuellement via la CLI admin
 */

import { prisma as defaultPrisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Instance injectable (pour les tests)
let prismaInstance: any = null;

export function setPrismaInstance(instance: any): void {
    prismaInstance = instance;
}

function getPrisma(): any {
    return prismaInstance || defaultPrisma;
}

// ─── Configuration ────────────────────────────────────────────

/**
 * Durée de conservation des données personnelles des leads (en mois).
 * Par défaut 36 mois (3 ans), conformément aux recommandations CNIL
 * pour les données de prospection commerciale.
 */
const DEFAULT_RETENTION_MONTHS = 36;

/**
 * Données remplacées lors de l'anonymisation.
 * Les champs sont vidés ou remplacés par des valeurs génériques
 * pour respecter l'effacement tout en conservant les statistiques.
 */
const ANONYMIZED_VALUES = {
    email: 'anonymized@deleted.local',
    nom: 'ANONYMISÉ',
    prenom: 'ANONYMISÉ',
    telephone: null,
    adresse: null,
    codePostal: null, // conservé pour les stats géographiques? Non, supprimé par précaution
    ville: null,
    message: null,
    metadata: Prisma.DbNull,
    notes: null,
} as const;

// ─── Types ────────────────────────────────────────────────────

export interface RetentionResult {
    totalProcessed: number;
    leadsAnonymized: number;
    consentsUpdated: number;
    errors: string[];
    durationMs: number;
}

export interface LeadExportData {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    adresse: string | null;
    codePostal: string | null;
    ville: string | null;
    formationSouhaitee: string | null;
    source: string;
    status: string;
    score: number | null;
    createdAt: Date;
    consent?: {
        consentGiven: boolean;
        consentText: string;
        consentMethod: string;
        legalBasis: string;
        createdAt: Date;
    } | null;
}

// ─── Anonymisation automatique ────────────────────────────────

/**
 * Anonymise tous les leads dont la date de création dépasse
 * la durée de conservation configurée.
 * 
 * @param retentionMonths Durée de conservation en mois (défaut: 36)
 * @param dryRun Si true, ne modifie rien et renvoie les stats (simulation)
 */
export async function anonymizeExpiredLeads(
    retentionMonths: number = DEFAULT_RETENTION_MONTHS,
    dryRun: boolean = false,
): Promise<RetentionResult> {
    const start = Date.now();
    const errors: string[] = [];

    // Calculer la date limite
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    console.log(`[DataRetention] 🔍 Recherche des leads antérieurs au ${cutoffDate.toISOString()} (${retentionMonths} mois)${dryRun ? ' [DRY RUN]' : ''}`);

    // Trouver les leads éligibles à l'anonymisation
    // On exclut ceux déjà anonymisés (email = anonymized@deleted.local)
    const expiredLeads = await getPrisma().lead.findMany({
        where: {
            createdAt: { lt: cutoffDate },
            email: { not: ANONYMIZED_VALUES.email },
        },
        select: {
            id: true,
            email: true,
            leadConsent: { select: { id: true, anonymizedAt: true } },
        },
    });

    const totalProcessed = expiredLeads.length;
    let leadsAnonymized = 0;
    let consentsUpdated = 0;

    if (totalProcessed === 0) {
        console.log('[DataRetention] ✅ Aucun lead à anonymiser');
        return { totalProcessed: 0, leadsAnonymized: 0, consentsUpdated: 0, errors, durationMs: Date.now() - start };
    }

    console.log(`[DataRetention] 📋 ${totalProcessed} lead(s) éligible(s) à l'anonymisation`);

    if (dryRun) {
        return { totalProcessed, leadsAnonymized: totalProcessed, consentsUpdated: totalProcessed, errors, durationMs: Date.now() - start };
    }

    // Anonymisation par batch de 50
    const batchSize = 50;
    for (let i = 0; i < expiredLeads.length; i += batchSize) {
        const batch = expiredLeads.slice(i, i + batchSize);

        try {
            await getPrisma().$transaction(async (tx) => {
                for (const lead of batch) {
                    // Anonymiser le lead
                    await tx.lead.update({
                        where: { id: lead.id },
                        data: ANONYMIZED_VALUES,
                    });
                    leadsAnonymized++;

                    // Anonymiser le consentement associé
                    if (lead.leadConsent && !lead.leadConsent.anonymizedAt) {
                        await tx.leadConsent.update({
                            where: { id: lead.leadConsent.id },
                            data: {
                                consentText: '[ANONYMISÉ - Conservation expirée]',
                                anonymizedAt: new Date(),
                                ipAddress: null,
                                userAgent: null,
                            },
                        });
                        consentsUpdated++;
                    }
                }
            });
        } catch (err) {
            const msg = `Erreur batch ${i}-${i + batchSize}: ${err instanceof Error ? err.message : String(err)}`;
            errors.push(msg);
            console.error(`[DataRetention] ❌ ${msg}`);
        }
    }

    console.log(`[DataRetention] ✅ Terminé : ${leadsAnonymized} leads anonymisés, ${consentsUpdated} consentements mis à jour`);

    return {
        totalProcessed,
        leadsAnonymized,
        consentsUpdated,
        errors,
        durationMs: Date.now() - start,
    };
}

// ─── Exercice du droit à l'effacement (Art. 17) ──────────────

/**
 * Anonymise un lead spécifique sur demande de la personne concernée.
 * Le lead n'est pas supprimé (conservation des stats) mais toutes
 * les données personnelles sont effacées.
 * 
 * @param leadId ID du lead à anonymiser
 * @param reason Motif de la demande (traçabilité)
 */
export async function anonymizeLead(
    leadId: string,
    reason: string = 'Demande d\'effacement (RGPD Art. 17)',
): Promise<{ success: boolean; error?: string }> {
    try {
        const lead = await getPrisma().lead.findUnique({
            where: { id: leadId },
            include: { leadConsent: true },
        });

        if (!lead) {
            return { success: false, error: 'Lead non trouvé' };
        }

        if (lead.email === ANONYMIZED_VALUES.email) {
            return { success: false, error: 'Lead déjà anonymisé' };
        }

        await getPrisma().$transaction(async (tx) => {
            await tx.lead.update({
                where: { id: leadId },
                data: ANONYMIZED_VALUES,
            });

            if (lead.leadConsent) {
                await tx.leadConsent.update({
                    where: { id: lead.leadConsent.id },
                    data: {
                        consentGiven: false,
                        consentText: `[EFFACÉ - ${reason}]`,
                        withdrawnAt: new Date(),
                        anonymizedAt: new Date(),
                        ipAddress: null,
                        userAgent: null,
                    },
                });
            }
        });

        console.log(`[DataRetention] 🗑️ Lead ${leadId} anonymisé — Motif: ${reason}`);
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[DataRetention] ❌ Erreur anonymisation lead ${leadId}: ${msg}`);
        return { success: false, error: msg };
    }
}

// ─── Retrait de consentement (Art. 7.3) ──────────────────────

/**
 * Enregistre le retrait de consentement d'un lead.
 * Les données ne sont PAS supprimées automatiquement mais le
 * retrait est tracé et bloque tout traitement ultérieur.
 */
export async function withdrawConsent(
    leadId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const consent = await getPrisma().leadConsent.findUnique({
            where: { leadId },
        });

        if (!consent) {
            return { success: false, error: 'Consentement non trouvé pour ce lead' };
        }

        if (consent.withdrawnAt) {
            return { success: false, error: 'Consentement déjà retiré' };
        }

        await getPrisma().leadConsent.update({
            where: { id: consent.id },
            data: {
                consentGiven: false,
                withdrawnAt: new Date(),
            },
        });

        console.log(`[DataRetention] ⛔ Consentement retiré pour lead ${leadId}`);
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[DataRetention] ❌ Erreur retrait consentement: ${msg}`);
        return { success: false, error: msg };
    }
}

// ─── Portabilité des données (Art. 20) ───────────────────────

/**
 * Exporte les données personnelles d'un lead dans un format
 * structuré et lisible par machine (JSON).
 */
export async function exportLeadData(leadId: string): Promise<LeadExportData | null> {
    const lead = await getPrisma().lead.findUnique({
        where: { id: leadId },
        include: { leadConsent: true },
    });

    if (!lead) return null;

    return {
        id: lead.id,
        nom: lead.nom,
        prenom: lead.prenom,
        email: lead.email,
        telephone: lead.telephone,
        adresse: lead.adresse,
        codePostal: lead.codePostal,
        ville: lead.ville,
        formationSouhaitee: lead.formationSouhaitee,
        source: lead.source,
        status: lead.status,
        score: lead.score,
        createdAt: lead.createdAt,
        consent: lead.leadConsent ? {
            consentGiven: lead.leadConsent.consentGiven,
            consentText: lead.leadConsent.consentText,
            consentMethod: lead.leadConsent.consentMethod,
            legalBasis: lead.leadConsent.legalBasis,
            createdAt: lead.leadConsent.createdAt,
        } : null,
    };
}

// ─── Stats de conservation ───────────────────────────────────

/**
 * Retourne des statistiques sur les données en base :
 * nombre de leads par tranche d'âge, nombre déjà anonymisés, etc.
 */
export async function getRetentionStats(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};
    const now = new Date();

    const [total, anonymized, older12m, older24m, older36m] = await Promise.all([
        getPrisma().lead.count({ where }),
        getPrisma().lead.count({ where: { ...where, email: ANONYMIZED_VALUES.email } }),
        getPrisma().lead.count({
            where: { ...where, createdAt: { lt: new Date(now.getFullYear(), now.getMonth() - 12, 1) } },
        }),
        getPrisma().lead.count({
            where: { ...where, createdAt: { lt: new Date(now.getFullYear(), now.getMonth() - 24, 1) } },
        }),
        getPrisma().lead.count({
            where: { ...where, createdAt: { lt: new Date(now.getFullYear(), now.getMonth() - 36, 1) } },
        }),
    ]);

    return {
        total,
        anonymized,
        active: total - anonymized,
        olderThan12Months: older12m,
        olderThan24Months: older24m,
        olderThan36Months: older36m,
        retentionPolicyMonths: DEFAULT_RETENTION_MONTHS,
        nextPurgeEligible: older36m - anonymized,
    };
}

'use server';

import { prisma } from '@/lib/prisma';
import { LeadStatus, LeadActivityType, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { refreshLeadScore } from '@/lib/prospection/lead-scoring';

// ─────────────────────────────────────────────────────────
// Constantes métier
// ─────────────────────────────────────────────────────────

/** Nombre max de relances avant passage automatique en PERDU_HORS_LIGNE */
const MAX_RELANCES = 3;

/** Raisons de perte prédéfinies (motifs standardisés) */
const LOST_REASONS = {
    NON_INTERESSE: 'Non intéressé après discussion',
    HORS_LIGNE: 'Injoignable après 3 relances',
    NUMERO_INVALIDE: 'Numéro invalide ou inexistant',
    ABANDON_PROSPECT: 'Abandon volontaire du prospect',
} as const;

/** Résultats d'appel prédéfinis pour handle_rdv_non_honore */
const CALL_RESULTS = ['rdv_refixe', 'interesse', 'hors_ligne', 'pas_interesse', 'numero_invalide'] as const;

// ─────────────────────────────────────────────────────────
// Schémas de validation Zod
// ─────────────────────────────────────────────────────────

const QualifyRdvSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    honored: z.boolean(),
    absenceReason: z.string().optional(),
    intent: z.enum(['poursuivre', 'reporter', 'abandon']).optional(),
    notes: z.string().optional(),
    performedBy: z.string().min(1, 'performedBy requis'),
}).refine(
    (data) => {
        // Si non honoré, absenceReason est obligatoire
        if (!data.honored && (!data.absenceReason || data.absenceReason.trim() === '')) {
            return false;
        }
        return true;
    },
    { message: 'La raison d\'absence est obligatoire si le RDV n\'a pas été honoré', path: ['absenceReason'] }
).refine(
    (data) => {
        // Si honoré, intent est obligatoire
        if (data.honored && !data.intent) {
            return false;
        }
        return true;
    },
    { message: 'L\'intention est obligatoire si le RDV a été honoré', path: ['intent'] }
);

const HandleRdvNonHonoreSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    action: z.enum(['call', 'relance']),
    callResult: z.enum(CALL_RESULTS).optional(),
    dateRdv: z.string().datetime().optional(),
    notes: z.string().min(1, 'Notes obligatoires'),
    performedBy: z.string().min(1, 'performedBy requis'),
}).refine(
    (data) => {
        // Si action='call', callResult est obligatoire
        if (data.action === 'call' && !data.callResult) {
            return false;
        }
        return true;
    },
    { message: 'Le résultat de l\'appel est obligatoire', path: ['callResult'] }
).refine(
    (data) => {
        // Si callResult='rdv_refixe', dateRdv est obligatoire
        if (data.callResult === 'rdv_refixe' && !data.dateRdv) {
            return false;
        }
        return true;
    },
    { message: 'La date du nouveau RDV est obligatoire', path: ['dateRdv'] }
);

// ─────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────

/** Horodatage français lisible pour les notes */
function timestamp(): string {
    return new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Ajoute une note horodatée au lead (préfixée en haut) */
async function appendNote(leadId: string, entry: string): Promise<string> {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { notes: true },
    });
    const newEntry = `[${timestamp()}] ${entry}`;
    return lead?.notes ? newEntry + '\n' + lead.notes : newEntry;
}

/** Crée une entrée LeadActivity */
async function logActivity(
    leadId: string,
    type: LeadActivityType,
    description: string,
    performedBy: string,
    metadata?: Record<string, unknown>,
) {
    await prisma.leadActivity.create({
        data: {
            leadId,
            type,
            description,
            performedBy,
            metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
        },
    });
}

// ─────────────────────────────────────────────────────────
// ACTION 1 — qualifyRdv
// ─────────────────────────────────────────────────────────

/**
 * Qualifie le résultat d'un RDV planifié.
 *
 * Cas 1 — RDV non honoré (honored=false) :
 *   • absenceReason obligatoire
 *   • statut → RDV_NON_HONORE
 *   • loggué dans LeadActivity
 *
 * Cas 2 — RDV honoré (honored=true) :
 *   • intent obligatoire : 'poursuivre' | 'reporter' | 'abandon'
 *   • 'reporter'   → statut DECISION_EN_ATTENTE
 *   • 'abandon'    → statut PERDU + lostReason
 *   • 'poursuivre' → retourne signal { nextStep: 'CHOIX_FINANCEMENT' }
 */
export async function qualifyRdv(input: z.input<typeof QualifyRdvSchema>) {
    const result = QualifyRdvSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.issues[0]?.message || 'Validation échouée' };
    }

    const { leadId, honored, absenceReason, intent, notes, performedBy } = result.data;

    // Vérifier que le lead existe et est bien en RDV_PLANIFIE
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true, nom: true, prenom: true, organizationId: true },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    if (lead.status !== LeadStatus.RDV_PLANIFIE) {
        return {
            success: false,
            error: `Le lead doit être en statut RDV_PLANIFIE pour être qualifié (statut actuel : ${lead.status})`,
        };
    }

    try {
        // ═══════════════════════════════════════
        // CAS 1 : RDV NON HONORÉ
        // ═══════════════════════════════════════
        if (!honored) {
            const noteText = `❌ RDV non honoré — Motif : ${absenceReason}${notes ? ' — ' + notes : ''}`;
            const concatenatedNotes = await appendNote(leadId, noteText);

            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    status: LeadStatus.RDV_NON_HONORE,
                    notes: concatenatedNotes,
                },
            });

            await logActivity(leadId, LeadActivityType.RDV_NO_SHOW, noteText, performedBy, {
                absenceReason,
                previousStatus: 'RDV_PLANIFIE',
                newStatus: 'RDV_NON_HONORE',
            });

            revalidatePath('/crm');
            refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

            return {
                success: true,
                newStatus: 'RDV_NON_HONORE',
                message: `Lead ${lead.nom} ${lead.prenom} marqué RDV non honoré. Choisissez l'action de suivi.`,
                nextStep: 'HANDLE_NON_HONORE', // Signal pour le frontend
            };
        }

        // ═══════════════════════════════════════
        // CAS 2 : RDV HONORÉ — Qualification par intent
        // ═══════════════════════════════════════

        switch (intent) {
            // ── Reporter la décision ──
            case 'reporter': {
                const noteText = `⏳ RDV honoré — Décision reportée${notes ? ' — ' + notes : ''}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.DECISION_EN_ATTENTE,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.RDV_COMPLETED, noteText, performedBy, {
                    intent: 'reporter',
                    previousStatus: 'RDV_PLANIFIE',
                    newStatus: 'DECISION_EN_ATTENTE',
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'DECISION_EN_ATTENTE',
                    message: `Lead ${lead.nom} ${lead.prenom} — décision en attente.`,
                    nextStep: null,
                };
            }

            // ── Abandon / Pas intéressé ──
            case 'abandon': {
                const noteText = `🚫 RDV honoré — Prospect non intéressé${notes ? ' — ' + notes : ''}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.PERDU,
                        lostReason: LOST_REASONS.NON_INTERESSE,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.STATUS_CHANGE, noteText, performedBy, {
                    intent: 'abandon',
                    previousStatus: 'RDV_PLANIFIE',
                    newStatus: 'PERDU',
                    lostReason: LOST_REASONS.NON_INTERESSE,
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'PERDU',
                    message: `Lead ${lead.nom} ${lead.prenom} marqué comme perdu (non intéressé).`,
                    nextStep: null,
                };
            }

            // ── Poursuivre → Signal vers choix financement ──
            case 'poursuivre': {
                const noteText = `✅ RDV honoré — Prospect intéressé, passage au choix de financement${notes ? ' — ' + notes : ''}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        // On reste en RDV_PLANIFIE pour l'instant — le statut changera
                        // quand le financement sera choisi (prochaine étape du workflow)
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.RDV_COMPLETED, noteText, performedBy, {
                    intent: 'poursuivre',
                    previousStatus: 'RDV_PLANIFIE',
                    rdvOutcome: 'POSITIVE',
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'RDV_PLANIFIE', // Pas de changement, transition vers financement
                    message: `Lead ${lead.nom} ${lead.prenom} qualifié positivement. Passage au choix de financement.`,
                    nextStep: 'CHOIX_FINANCEMENT', // Signal pour le frontend
                };
            }

            default:
                return { success: false, error: `Intent inconnu : ${intent}` };
        }
    } catch (error) {
        console.error('[qualifyRdv] Error:', error);
        return { success: false, error: 'Erreur lors de la qualification du RDV' };
    }
}


// ─────────────────────────────────────────────────────────
// ACTION 2 — handleRdvNonHonoreAction
// ─────────────────────────────────────────────────────────

/**
 * Gère les actions de suivi après un RDV non honoré.
 *
 * action='call' :
 *   • callResult obligatoire
 *   • 'rdv_refixe'      → Statut RDV_PLANIFIE (nouveau RDV)
 *   • 'interesse'        → Statut DECISION_EN_ATTENTE (à relancer plus tard)
 *   • 'hors_ligne'       → relanceCount++ ; si ≥ MAX_RELANCES → PERDU (hors ligne)
 *   • 'pas_interesse'    → PERDU + raison
 *   • 'numero_invalide'  → PERDU + raison
 *
 * action='relance' :
 *   • relanceCount++ + note de relance
 *   • Si relanceCount ≥ MAX_RELANCES → PERDU (hors ligne)
 */
export async function handleRdvNonHonoreAction(input: z.input<typeof HandleRdvNonHonoreSchema>) {
    const result = HandleRdvNonHonoreSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.issues[0]?.message || 'Validation échouée' };
    }

    const { leadId, action, callResult, dateRdv, notes, performedBy } = result.data;

    // Vérifier que le lead existe et est en RDV_NON_HONORE
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
            id: true,
            status: true,
            nom: true,
            prenom: true,
            relanceCount: true,
            organizationId: true,
        },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    if (lead.status !== LeadStatus.RDV_NON_HONORE) {
        return {
            success: false,
            error: `Le lead doit être en statut RDV_NON_HONORE (statut actuel : ${lead.status})`,
        };
    }

    try {
        // ═══════════════════════════════════════
        // ACTION : RELANCE (simple)
        // ═══════════════════════════════════════
        if (action === 'relance') {
            const newRelanceCount = lead.relanceCount + 1;

            // Vérifier si on atteint le max de relances
            if (newRelanceCount >= MAX_RELANCES) {
                const noteText = `📵 Relance #${newRelanceCount} — Max atteint (${MAX_RELANCES}) → Passage en PERDU (hors ligne) — ${notes}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.PERDU,
                        lostReason: LOST_REASONS.HORS_LIGNE,
                        relanceCount: newRelanceCount,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.RELANCE, noteText, performedBy, {
                    relanceCount: newRelanceCount,
                    maxReached: true,
                    previousStatus: 'RDV_NON_HONORE',
                    newStatus: 'PERDU',
                    lostReason: LOST_REASONS.HORS_LIGNE,
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'PERDU',
                    relanceCount: newRelanceCount,
                    message: `Lead ${lead.nom} ${lead.prenom} — ${MAX_RELANCES} relances max atteintes. Marqué comme perdu (hors ligne).`,
                };
            }

            // Relance normale (pas encore au max)
            const noteText = `🔄 Relance #${newRelanceCount}/${MAX_RELANCES} — ${notes}`;
            const concatenatedNotes = await appendNote(leadId, noteText);

            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    relanceCount: newRelanceCount,
                    notes: concatenatedNotes,
                },
            });

            await logActivity(leadId, LeadActivityType.RELANCE, noteText, performedBy, {
                relanceCount: newRelanceCount,
                maxRelances: MAX_RELANCES,
            });

            revalidatePath('/crm');

            return {
                success: true,
                newStatus: 'RDV_NON_HONORE', // Reste au même statut
                relanceCount: newRelanceCount,
                message: `Relance #${newRelanceCount}/${MAX_RELANCES} enregistrée pour ${lead.nom} ${lead.prenom}.`,
            };
        }

        // ═══════════════════════════════════════
        // ACTION : CALL (appel avec résultat)
        // ═══════════════════════════════════════
        switch (callResult) {

            // ── RDV re-fixé ──
            case 'rdv_refixe': {
                const noteText = `📅 Appel → Nouveau RDV fixé au ${new Date(dateRdv!).toLocaleDateString('fr-FR')} — ${notes}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.RDV_PLANIFIE,
                        dateRdv: new Date(dateRdv!),
                        relanceCount: 0, // Reset du compteur
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.RDV_BOOKED, noteText, performedBy, {
                    previousStatus: 'RDV_NON_HONORE',
                    newStatus: 'RDV_PLANIFIE',
                    newDateRdv: dateRdv,
                    relanceCountReset: true,
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'RDV_PLANIFIE',
                    message: `Nouveau RDV planifié pour ${lead.nom} ${lead.prenom}.`,
                };
            }

            // ── Intéressé mais pas de RDV immédiat ──
            case 'interesse': {
                const newRelanceCount = lead.relanceCount + 1;
                const noteText = `📞 Appel → Intéressé, décision en attente (relance #${newRelanceCount}) — ${notes}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.DECISION_EN_ATTENTE,
                        relanceCount: newRelanceCount,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.CALL_OUTBOUND, noteText, performedBy, {
                    callResult: 'interesse',
                    previousStatus: 'RDV_NON_HONORE',
                    newStatus: 'DECISION_EN_ATTENTE',
                    relanceCount: newRelanceCount,
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'DECISION_EN_ATTENTE',
                    relanceCount: newRelanceCount,
                    message: `${lead.nom} ${lead.prenom} intéressé — en attente de décision.`,
                };
            }

            // ── Hors ligne / Ne répond pas ──
            case 'hors_ligne': {
                const newRelanceCount = lead.relanceCount + 1;

                // Si on atteint le max → PERDU automatiquement
                if (newRelanceCount >= MAX_RELANCES) {
                    const noteText = `📵 Appel #${newRelanceCount} → Hors ligne — Max relances atteint (${MAX_RELANCES}) → PERDU — ${notes}`;
                    const concatenatedNotes = await appendNote(leadId, noteText);

                    await prisma.lead.update({
                        where: { id: leadId },
                        data: {
                            status: LeadStatus.PERDU,
                            lostReason: LOST_REASONS.HORS_LIGNE,
                            relanceCount: newRelanceCount,
                            notes: concatenatedNotes,
                        },
                    });

                    await logActivity(leadId, LeadActivityType.CALL_NO_ANSWER, noteText, performedBy, {
                        callResult: 'hors_ligne',
                        relanceCount: newRelanceCount,
                        maxReached: true,
                        previousStatus: 'RDV_NON_HONORE',
                        newStatus: 'PERDU',
                        lostReason: LOST_REASONS.HORS_LIGNE,
                    });

                    revalidatePath('/crm');
                    refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                    return {
                        success: true,
                        newStatus: 'PERDU',
                        relanceCount: newRelanceCount,
                        message: `${lead.nom} ${lead.prenom} — ${MAX_RELANCES} tentatives d'appel, passage en PERDU (hors ligne).`,
                    };
                }

                // Pas encore au max → incrémente et reste en RDV_NON_HONORE
                const noteText = `📞 Appel #${newRelanceCount}/${MAX_RELANCES} → Hors ligne — ${notes}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        relanceCount: newRelanceCount,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.CALL_NO_ANSWER, noteText, performedBy, {
                    callResult: 'hors_ligne',
                    relanceCount: newRelanceCount,
                    maxRelances: MAX_RELANCES,
                    remainingAttempts: MAX_RELANCES - newRelanceCount,
                });

                revalidatePath('/crm');

                return {
                    success: true,
                    newStatus: 'RDV_NON_HONORE',
                    relanceCount: newRelanceCount,
                    remainingAttempts: MAX_RELANCES - newRelanceCount,
                    message: `Appel hors ligne #${newRelanceCount}/${MAX_RELANCES}. ${MAX_RELANCES - newRelanceCount} tentative(s) restante(s).`,
                };
            }

            // ── Pas intéressé ──
            case 'pas_interesse': {
                const noteText = `🚫 Appel → Pas intéressé — ${notes}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.PERDU,
                        lostReason: LOST_REASONS.NON_INTERESSE,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.CALL_OUTBOUND, noteText, performedBy, {
                    callResult: 'pas_interesse',
                    previousStatus: 'RDV_NON_HONORE',
                    newStatus: 'PERDU',
                    lostReason: LOST_REASONS.NON_INTERESSE,
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'PERDU',
                    message: `${lead.nom} ${lead.prenom} marqué comme perdu (non intéressé).`,
                };
            }

            // ── Numéro invalide ──
            case 'numero_invalide': {
                const noteText = `⚠️ Appel → Numéro invalide — ${notes}`;
                const concatenatedNotes = await appendNote(leadId, noteText);

                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        status: LeadStatus.PERDU,
                        lostReason: LOST_REASONS.NUMERO_INVALIDE,
                        notes: concatenatedNotes,
                    },
                });

                await logActivity(leadId, LeadActivityType.CALL_OUTBOUND, noteText, performedBy, {
                    callResult: 'numero_invalide',
                    previousStatus: 'RDV_NON_HONORE',
                    newStatus: 'PERDU',
                    lostReason: LOST_REASONS.NUMERO_INVALIDE,
                });

                revalidatePath('/crm');
                refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

                return {
                    success: true,
                    newStatus: 'PERDU',
                    message: `${lead.nom} ${lead.prenom} marqué comme perdu (numéro invalide).`,
                };
            }

            default:
                return { success: false, error: `Résultat d'appel inconnu : ${callResult}` };
        }
    } catch (error) {
        console.error('[handleRdvNonHonoreAction] Error:', error);
        return { success: false, error: 'Erreur lors du traitement de l\'action post-RDV' };
    }
}

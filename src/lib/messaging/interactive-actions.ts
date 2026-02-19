/**
 * INTERACTIVE ACTIONS — Dossier update engine
 * =============================================
 * Handles interactive reply IDs prefixed with "dossier_*" and
 * automatically updates the corresponding Dossier, Emargement, or Evaluation.
 */

import { prisma } from '@/lib/prisma';

// ─── Action Types ────────────────────────────────────────────

export type DossierActionType =
    | 'CONFIRM_PRESENCE'
    | 'RESCHEDULE'
    | 'SELECT_SLOT'
    | 'SELECT_DOCUMENT'
    | 'SURVEY_RESPONSE';

// ─── Dossier Reply ID Patterns ───────────────────────────────
// Format: dossier_{action}_{dossierId}_{extra?}

export function isDossierReply(replyId: string): boolean {
    return replyId.startsWith('dossier_');
}

export function parseDossierReply(replyId: string): {
    action: string;
    dossierId: string;
    extra?: string;
} | null {
    const parts = replyId.split('_');
    if (parts.length < 3) return null;
    // dossier_confirm_DOSSIERID or dossier_survey_DOSSIERID_3
    return {
        action: parts[1],
        dossierId: parts[2],
        extra: parts.slice(3).join('_') || undefined,
    };
}

// ─── Handle Dossier Action ───────────────────────────────────

export async function handleDossierAction(
    organizationId: string,
    phone: string,
    replyId: string,
    text: string
): Promise<{ success: boolean; message: string }> {
    const parsed = parseDossierReply(replyId);
    if (!parsed) return { success: false, message: 'Invalid dossier reply ID' };

    const { action, dossierId, extra } = parsed;

    // Find dossier
    const dossier = await (prisma as any).dossier.findFirst({
        where: { id: dossierId, organizationId },
        include: { session: true },
    });

    if (!dossier) {
        return { success: false, message: 'Dossier introuvable' };
    }

    try {
        switch (action) {
            case 'confirm': {
                return await confirmPresence(organizationId, phone, dossier);
            }
            case 'reschedule': {
                return await requestReschedule(organizationId, phone, dossier);
            }
            case 'slot': {
                // extra = slot index (0-based)
                return await selectSlot(organizationId, phone, dossier, extra);
            }
            case 'doc': {
                // extra = document type (id, domicile, cv, photo, secu)
                return await markDocumentReceived(organizationId, phone, dossier, extra);
            }
            case 'survey': {
                // extra = rating (1-5)
                return await recordSurveyResponse(organizationId, phone, dossier, extra);
            }
            default:
                return { success: false, message: `Action inconnue: ${action}` };
        }
    } catch (err: any) {
        console.error('[InteractiveAction] Error:', err);

        // Log failed action
        await (prisma as any).interactiveAction.create({
            data: {
                organizationId,
                phone,
                dossierId,
                actionType: action.toUpperCase(),
                replyId,
                status: 'FAILED',
                errorMessage: err.message,
            },
        });

        return { success: false, message: err.message };
    }
}

// ─── Confirm Presence ────────────────────────────────────────

async function confirmPresence(
    organizationId: string,
    phone: string,
    dossier: any
): Promise<{ success: boolean; message: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create or update emargement for today
    const demiJournee = new Date().getHours() < 12 ? 'MATIN' : 'APRES_MIDI';

    await (prisma as any).emargement.upsert({
        where: {
            sessionId_dossierId_dateEmargement_demiJournee: {
                sessionId: dossier.sessionId,
                dossierId: dossier.id,
                dateEmargement: today,
                demiJournee,
            },
        },
        create: {
            sessionId: dossier.sessionId,
            dossierId: dossier.id,
            dateEmargement: today,
            demiJournee,
            estPresent: true,
        },
        update: {
            estPresent: true,
        },
    });

    // Log action
    await (prisma as any).interactiveAction.create({
        data: {
            organizationId,
            phone,
            dossierId: dossier.id,
            actionType: 'CONFIRM_PRESENCE',
            replyId: `dossier_confirm_${dossier.id}`,
            actionData: { date: today.toISOString(), demiJournee },
            status: 'APPLIED',
            appliedAt: new Date(),
        },
    });

    return {
        success: true,
        message: `✅ Présence confirmée pour ${demiJournee === 'MATIN' ? 'ce matin' : 'cet après-midi'}.\n\nMerci ${dossier.stagiairePrenom} ! Bonne formation. 📚`,
    };
}

// ─── Request Reschedule ──────────────────────────────────────

async function requestReschedule(
    organizationId: string,
    phone: string,
    dossier: any
): Promise<{ success: boolean; message: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mark absence for today
    const demiJournee = new Date().getHours() < 12 ? 'MATIN' : 'APRES_MIDI';

    await (prisma as any).emargement.upsert({
        where: {
            sessionId_dossierId_dateEmargement_demiJournee: {
                sessionId: dossier.sessionId,
                dossierId: dossier.id,
                dateEmargement: today,
                demiJournee,
            },
        },
        create: {
            sessionId: dossier.sessionId,
            dossierId: dossier.id,
            dateEmargement: today,
            demiJournee,
            estPresent: false,
            motifAbsence: 'Report demandé via WhatsApp',
        },
        update: {
            estPresent: false,
            motifAbsence: 'Report demandé via WhatsApp',
        },
    });

    // Log action
    await (prisma as any).interactiveAction.create({
        data: {
            organizationId,
            phone,
            dossierId: dossier.id,
            actionType: 'RESCHEDULE',
            replyId: `dossier_reschedule_${dossier.id}`,
            actionData: { date: today.toISOString(), source: 'whatsapp' },
            status: 'APPLIED',
            appliedAt: new Date(),
        },
    });

    return {
        success: true,
        message: `📅 Demande de report enregistrée.\n\nUn conseiller vous recontactera pour trouver un nouveau créneau.\n\n⚠️ N'oubliez pas : toute absence doit être signalée 48h à l'avance.`,
    };
}

// ─── Select Slot ─────────────────────────────────────────────

async function selectSlot(
    organizationId: string,
    phone: string,
    dossier: any,
    slotIndex?: string
): Promise<{ success: boolean; message: string }> {
    if (!slotIndex) return { success: false, message: 'Créneau non spécifié' };

    const idx = parseInt(slotIndex, 10);
    if (isNaN(idx)) return { success: false, message: 'Index créneau invalide' };

    // Get session dates to find the slot
    const session = await (prisma as any).session.findUnique({
        where: { id: dossier.sessionId },
    });

    if (!session) return { success: false, message: 'Session introuvable' };

    // Calculate the slot date (session start + idx days)
    const slotDate = new Date(session.dateDebut);
    slotDate.setDate(slotDate.getDate() + idx);

    // Update dossier effective start date
    await (prisma as any).dossier.update({
        where: { id: dossier.id },
        data: { dateDebutEffectif: slotDate },
    });

    // Log action
    await (prisma as any).interactiveAction.create({
        data: {
            organizationId,
            phone,
            dossierId: dossier.id,
            actionType: 'SELECT_SLOT',
            replyId: `dossier_slot_${dossier.id}_${slotIndex}`,
            actionData: { slotIndex: idx, slotDate: slotDate.toISOString() },
            status: 'APPLIED',
            appliedAt: new Date(),
        },
    });

    const formatted = slotDate.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

    return {
        success: true,
        message: `📅 Créneau sélectionné : *${formatted}*\n\nVotre date de début est enregistrée. À bientôt ! 🎓`,
    };
}

// ─── Mark Document Received ──────────────────────────────────

const DOCUMENT_LABELS: Record<string, string> = {
    id: "Pièce d'identité",
    domicile: 'Justificatif de domicile',
    cv: 'CV à jour',
    photo: "Photo d'identité",
    secu: 'Attestation sécurité sociale',
};

async function markDocumentReceived(
    organizationId: string,
    phone: string,
    dossier: any,
    docType?: string
): Promise<{ success: boolean; message: string }> {
    if (!docType) return { success: false, message: 'Type de document non spécifié' };

    const label = DOCUMENT_LABELS[docType] || docType;

    // Create an evaluation record to track the document status
    await (prisma as any).evaluation.create({
        data: {
            dossierId: dossier.id,
            type: 'DOCUMENT_CHECKLIST',
            reponses: { documentType: docType, label, receivedVia: 'whatsapp', receivedAt: new Date().toISOString() },
            saisiPar: 'chatbot',
        },
    });

    // Log action
    await (prisma as any).interactiveAction.create({
        data: {
            organizationId,
            phone,
            dossierId: dossier.id,
            actionType: 'SELECT_DOCUMENT',
            replyId: `dossier_doc_${dossier.id}_${docType}`,
            actionData: { documentType: docType, label },
            status: 'APPLIED',
            appliedAt: new Date(),
        },
    });

    return {
        success: true,
        message: `📄 *${label}* — noté comme à fournir !\n\nVous pouvez envoyer ce document en pièce jointe dans cette conversation ou l'apporter le jour de votre inscription.`,
    };
}

// ─── Record Survey Response ──────────────────────────────────

async function recordSurveyResponse(
    organizationId: string,
    phone: string,
    dossier: any,
    rating?: string
): Promise<{ success: boolean; message: string }> {
    if (!rating) return { success: false, message: 'Note non spécifiée' };

    const score = parseInt(rating, 10);
    if (isNaN(score) || score < 1 || score > 5) {
        return { success: false, message: 'Note invalide (1-5)' };
    }

    // Create satisfaction evaluation
    await (prisma as any).evaluation.create({
        data: {
            dossierId: dossier.id,
            type: 'SATISFACTION_POST',
            score,
            reponses: { source: 'whatsapp', rating: score, submittedAt: new Date().toISOString() },
            saisiPar: 'chatbot',
        },
    });

    // Log action
    await (prisma as any).interactiveAction.create({
        data: {
            organizationId,
            phone,
            dossierId: dossier.id,
            actionType: 'SURVEY_RESPONSE',
            replyId: `dossier_survey_${dossier.id}_${rating}`,
            actionData: { score, maxScore: 5 },
            status: 'APPLIED',
            appliedAt: new Date(),
        },
    });

    const stars = '⭐'.repeat(score) + '☆'.repeat(5 - score);

    return {
        success: true,
        message: `Merci pour votre retour !\n\n${stars} (${score}/5)\n\n${score >= 4 ? '😊 Ravi que la formation vous ait plu !' : score >= 3 ? '🙏 Merci, nous prendrons vos remarques en compte.' : '😔 Nous sommes désolés. Un responsable prendra contact avec vous.'}`,
    };
}

// ─── Build Interactive Messages for Dossiers ─────────────────

/**
 * Build a presence confirmation interactive message for a dossier
 */
export function buildPresenceMessage(dossier: any) {
    const today = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

    return {
        type: 'button' as const,
        body: {
            text: `📋 *Confirmation de présence*\n\nBonjour ${dossier.stagiairePrenom} !\n\n📅 ${today}\n📚 ${dossier.session?.programme?.titre || 'Votre formation'}\n\nÊtes-vous présent(e) aujourd'hui ?`,
        },
        footer: { text: 'Répondez avant le début du cours' },
        action: {
            buttons: [
                { type: 'reply' as const, reply: { id: `dossier_confirm_${dossier.id}`, title: '✅ Confirmer' } },
                { type: 'reply' as const, reply: { id: `dossier_reschedule_${dossier.id}`, title: '📅 Reporter' } },
            ],
        },
    };
}

/**
 * Build a slot selection interactive message for a dossier
 */
export function buildSlotSelectionMessage(dossier: any, slots: Array<{ date: Date; label: string }>) {
    return {
        type: 'list' as const,
        body: {
            text: `📅 *Choix de créneau*\n\nBonjour ${dossier.stagiairePrenom} !\n\nVeuillez sélectionner votre créneau préféré pour "${dossier.session?.programme?.titre || 'votre formation'}" :`,
        },
        footer: { text: 'Sélectionnez un créneau ci-dessous' },
        action: {
            button: '📅 Voir les créneaux',
            sections: [
                {
                    title: 'Créneaux disponibles',
                    rows: slots.map((slot, i) => ({
                        id: `dossier_slot_${dossier.id}_${i}`,
                        title: slot.label,
                        description: slot.date.toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long',
                        }),
                    })),
                },
            ],
        },
    };
}

/**
 * Build a document checklist interactive message for a dossier
 */
export function buildDocumentChecklistMessage(dossier: any) {
    return {
        type: 'list' as const,
        body: {
            text: `📄 *Documents à fournir*\n\nBonjour ${dossier.stagiairePrenom} !\n\nVeuillez nous indiquer quels documents vous pouvez fournir :`,
        },
        footer: { text: 'Sélectionnez un document' },
        action: {
            button: '📄 Voir les documents',
            sections: [
                {
                    title: 'Documents requis',
                    rows: Object.entries(DOCUMENT_LABELS).map(([key, label]) => ({
                        id: `dossier_doc_${dossier.id}_${key}`,
                        title: label,
                        description: 'Cliquez pour signaler ce document',
                    })),
                },
            ],
        },
    };
}

/**
 * Build a satisfaction survey interactive message for a dossier
 */
export function buildSatisfactionSurveyMessage(dossier: any) {
    return {
        type: 'button' as const,
        body: {
            text: `📊 *Sondage de satisfaction*\n\nBonjour ${dossier.stagiairePrenom} !\n\nComment évaluez-vous votre formation "${dossier.session?.programme?.titre || ''}" ?\n\nDonnez une note de 1 à 5 :`,
        },
        footer: { text: '1 = Pas satisfait · 5 = Très satisfait' },
        action: {
            buttons: [
                { type: 'reply' as const, reply: { id: `dossier_survey_${dossier.id}_5`, title: '⭐⭐⭐⭐⭐ (5)' } },
                { type: 'reply' as const, reply: { id: `dossier_survey_${dossier.id}_3`, title: '⭐⭐⭐ (3)' } },
                { type: 'reply' as const, reply: { id: `dossier_survey_${dossier.id}_1`, title: '⭐ (1)' } },
            ],
        },
    };
}

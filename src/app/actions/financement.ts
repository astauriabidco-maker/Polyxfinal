'use server';

import { prisma } from '@/lib/prisma';
import { LeadStatus, LeadActivityType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────
// Constantes métier
// ─────────────────────────────────────────────────────────

const FINANCEMENT_TYPES = ['PERSONNEL', 'CPF'] as const;
const DEFAULT_SEUIL_MINIMUM_PERCENT = 30;

/** Relance paiement: J+3, J+7, archivage J+14 */
const RELANCE_PAIEMENT_JOURS = {
    RELANCE_1: 3,
    RELANCE_2: 7,
    ARCHIVE: 14,
};

// ─────────────────────────────────────────────────────────
// Helpers internes (dupliqués de rdv-qualification pour autonomie)
// ─────────────────────────────────────────────────────────

function timestamp(): string {
    return new Date().toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
    });
}

async function appendNote(leadId: string, entry: string): Promise<string> {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { notes: true },
    });
    const ts = timestamp();
    const newNote = `[${ts}] ${entry}`;
    return lead?.notes ? `${newNote}\n${lead.notes}` : newNote;
}

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
            metadata: metadata ? (metadata as any) : undefined,
        },
    });
}

// ─────────────────────────────────────────────────────────
// Schémas de validation Zod
// ─────────────────────────────────────────────────────────

const ChooseFinancementSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    type: z.enum(FINANCEMENT_TYPES),
    chosenBy: z.string().min(1, 'chosenBy requis'),
});

const SubmitTestResultSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    volume: z.number().int().positive('Le volume horaire doit être > 0'),
    tarif: z.number().positive('Le tarif doit être > 0'),
    isManual: z.boolean().default(false),
    submittedBy: z.string().min(1, 'submittedBy requis'),
});

const ValidateFactureSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    validatedBy: z.string().min(1, 'validatedBy requis'),
});

const RecordPaiementSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    montant: z.number().positive('Le montant doit être > 0'),
    seuilMinimumPercent: z.number().int().min(1).max(100).default(DEFAULT_SEUIL_MINIMUM_PERCENT),
    recordedBy: z.string().min(1, 'recordedBy requis'),
});

const RelancePaiementSchema = z.object({
    leadId: z.string().min(1, 'leadId requis'),
    performedBy: z.string().min(1, 'performedBy requis'),
    notes: z.string().optional(),
});


// ─────────────────────────────────────────────────────────
// ACTION 1 — chooseFinancement
// ─────────────────────────────────────────────────────────

/**
 * Sélection du mode de financement.
 *
 * - 'PERSONNEL' → statut TEST_EN_COURS_PERSO
 * - 'CPF'       → statut CPF_COMPTE_A_DEMANDER
 */
export async function chooseFinancement(input: z.input<typeof ChooseFinancementSchema>) {
    const parsed = ChooseFinancementSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const { leadId, type, chosenBy } = parsed.data;

    // Vérifier que le lead existe et est dans un statut éligible
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true, nom: true, prenom: true },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    // Statuts éligibles pour le choix du financement
    const eligibleStatuses: LeadStatus[] = [
        LeadStatus.RDV_PLANIFIE,
        LeadStatus.DECISION_EN_ATTENTE,
    ];

    if (!eligibleStatuses.includes(lead.status)) {
        return {
            success: false,
            error: `Le lead est en statut "${lead.status}" — le choix de financement n'est pas disponible dans cet état.`,
        };
    }

    let newStatus: LeadStatus;
    let message: string;

    switch (type) {
        case 'PERSONNEL':
            newStatus = LeadStatus.TEST_EN_COURS_PERSO;
            message = `Financement personnel sélectionné — passage au test/devis.`;
            break;
        case 'CPF':
            newStatus = LeadStatus.CPF_COMPTE_A_DEMANDER;
            message = `Financement CPF sélectionné — le prospect doit créer/activer son compte CPF.`;
            break;
        default:
            return { success: false, error: `Type de financement inconnu : ${type}` };
    }

    const updatedNotes = await appendNote(leadId, `💰 Financement choisi : ${type}`);

    await prisma.lead.update({
        where: { id: leadId },
        data: {
            status: newStatus,
            financementType: type,
            notes: updatedNotes,
        },
    });

    await logActivity(
        leadId,
        LeadActivityType.FINANCEMENT_CHOISI,
        `Type de financement sélectionné : ${type}`,
        chosenBy,
        { financementType: type, previousStatus: lead.status, newStatus },
    );

    revalidatePath('/crm');

    return {
        success: true,
        newStatus: newStatus as string,
        financementType: type,
        message,
        // Si CPF → le frontend peut afficher un écran d'info
        nextStep: type === 'CPF' ? 'CPF_INFO_SCREEN' : 'SUBMIT_TEST',
    };
}


// ─────────────────────────────────────────────────────────
// ACTION 2 — submitTestResultOrManual
// ─────────────────────────────────────────────────────────

/**
 * Soumet le résultat du test / saisie manuelle.
 * Stocke volume, tarif, montant total calculé.
 * Le statut reste TEST_EN_COURS_PERSO (en attente de validation facture).
 */
export async function submitTestResultOrManual(input: z.input<typeof SubmitTestResultSchema>) {
    const parsed = SubmitTestResultSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const { leadId, volume, tarif, isManual, submittedBy } = parsed.data;

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    if (lead.status !== LeadStatus.TEST_EN_COURS_PERSO) {
        return {
            success: false,
            error: `Le lead doit être en statut "TEST_EN_COURS_PERSO" pour soumettre un test/devis. Statut actuel : ${lead.status}`,
        };
    }

    const montantTotal = volume * tarif;
    const noteEntry = isManual
        ? `📝 Devis manuel saisi : ${volume}h × ${tarif}€ = ${montantTotal.toFixed(2)}€`
        : `✅ Résultat test soumis : ${volume}h × ${tarif}€ = ${montantTotal.toFixed(2)}€`;

    const updatedNotes = await appendNote(leadId, noteEntry);

    await prisma.lead.update({
        where: { id: leadId },
        data: {
            testVolume: volume,
            testTarif: tarif,
            montantTotal,
            notes: updatedNotes,
            // Si saisie manuelle → besoin de validation
            // Si test auto → peut être auto-validé selon la config
            factureManuelleValidee: !isManual, // auto-validé si pas manuel
        },
    });

    await logActivity(
        leadId,
        LeadActivityType.TEST_SUBMITTED,
        noteEntry,
        submittedBy,
        { volume, tarif, montantTotal, isManual },
    );

    revalidatePath('/crm');

    return {
        success: true,
        montantTotal,
        volume,
        tarif,
        isManual,
        message: isManual
            ? `Devis manuel enregistré (${montantTotal.toFixed(2)}€). Validation requise avant facturation.`
            : `Test validé (${montantTotal.toFixed(2)}€). Prêt pour la facturation.`,
        nextStep: isManual ? 'VALIDATE_FACTURE' : 'GENERATE_FACTURE',
    };
}


// ─────────────────────────────────────────────────────────
// ACTION 3 — validateFactureManuelle
// ─────────────────────────────────────────────────────────

/**
 * Valide la facture manuelle (obligatoire avant génération de facture).
 * Passe le statut à EN_ATTENTE_PAIEMENT.
 */
export async function validateFactureManuelle(input: z.input<typeof ValidateFactureSchema>) {
    const parsed = ValidateFactureSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const { leadId, validatedBy } = parsed.data;

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true, montantTotal: true, factureManuelleValidee: true, testVolume: true, testTarif: true },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    if (lead.status !== LeadStatus.TEST_EN_COURS_PERSO) {
        return {
            success: false,
            error: `Validation uniquement possible depuis "TEST_EN_COURS_PERSO". Statut actuel : ${lead.status}`,
        };
    }

    if (!lead.montantTotal || !lead.testVolume || !lead.testTarif) {
        return {
            success: false,
            error: 'Le test/devis doit être soumis avant la validation de la facture.',
        };
    }

    if (lead.factureManuelleValidee) {
        return {
            success: false,
            error: 'La facture a déjà été validée.',
        };
    }

    const updatedNotes = await appendNote(
        leadId,
        `✅ Facture manuelle validée (${lead.montantTotal.toFixed(2)}€) — en attente de paiement`,
    );

    await prisma.lead.update({
        where: { id: leadId },
        data: {
            factureManuelleValidee: true,
            dateFacture: new Date(),
            status: LeadStatus.EN_ATTENTE_PAIEMENT,
            notes: updatedNotes,
        },
    });

    await logActivity(
        leadId,
        LeadActivityType.FACTURE_VALIDEE,
        `Facture manuelle validée : ${lead.montantTotal.toFixed(2)}€ (${lead.testVolume}h × ${lead.testTarif}€/h)`,
        validatedBy,
        {
            montantTotal: lead.montantTotal,
            volume: lead.testVolume,
            tarif: lead.testTarif,
            newStatus: 'EN_ATTENTE_PAIEMENT',
        },
    );

    revalidatePath('/crm');

    return {
        success: true,
        newStatus: 'EN_ATTENTE_PAIEMENT',
        montantTotal: lead.montantTotal,
        message: `Facture validée (${lead.montantTotal.toFixed(2)}€). En attente de paiement.`,
    };
}


// ─────────────────────────────────────────────────────────
// ACTION 4 — recordPaiement
// ─────────────────────────────────────────────────────────

/**
 * Enregistre un paiement.
 *
 * - Si montant >= (montantTotal × seuil / 100) → statut INSCRIT_PERSO
 * - Sinon → reste EN_ATTENTE_PAIEMENT (paiement partiel)
 */
export async function recordPaiement(input: z.input<typeof RecordPaiementSchema>) {
    const parsed = RecordPaiementSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const { leadId, montant, seuilMinimumPercent, recordedBy } = parsed.data;

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true, montantTotal: true, montantPaye: true, nom: true, prenom: true },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    if (lead.status !== LeadStatus.EN_ATTENTE_PAIEMENT) {
        return {
            success: false,
            error: `Paiement uniquement possible en "EN_ATTENTE_PAIEMENT". Statut actuel : ${lead.status}`,
        };
    }

    if (!lead.montantTotal || lead.montantTotal <= 0) {
        return {
            success: false,
            error: 'Le montant total n\'est pas défini. Veuillez d\'abord soumettre le test/devis.',
        };
    }

    const nouveauMontantPaye = (lead.montantPaye || 0) + montant;
    const seuilMinimum = lead.montantTotal * seuilMinimumPercent / 100;
    const seuilAtteint = nouveauMontantPaye >= seuilMinimum;
    const totalAtteint = nouveauMontantPaye >= lead.montantTotal;

    let newStatus: LeadStatus;
    let message: string;

    if (seuilAtteint) {
        newStatus = LeadStatus.INSCRIT_PERSO;
        if (totalAtteint) {
            message = `💳 Paiement total reçu (${nouveauMontantPaye.toFixed(2)}€ / ${lead.montantTotal.toFixed(2)}€). Lead INSCRIT !`;
        } else {
            message = `💳 Paiement partiel reçu (${nouveauMontantPaye.toFixed(2)}€ / ${lead.montantTotal.toFixed(2)}€) — seuil de ${seuilMinimumPercent}% atteint. Lead INSCRIT !`;
        }
    } else {
        newStatus = LeadStatus.EN_ATTENTE_PAIEMENT;
        const pourcentagePaye = ((nouveauMontantPaye / lead.montantTotal) * 100).toFixed(1);
        message = `💳 Paiement partiel reçu (${nouveauMontantPaye.toFixed(2)}€ / ${lead.montantTotal.toFixed(2)}€ = ${pourcentagePaye}%). Seuil minimum de ${seuilMinimumPercent}% non atteint.`;
    }

    const noteEntry = `💳 Paiement de ${montant.toFixed(2)}€ reçu → Total payé : ${nouveauMontantPaye.toFixed(2)}€ / ${lead.montantTotal.toFixed(2)}€`;
    const updatedNotes = await appendNote(leadId, noteEntry);

    await prisma.lead.update({
        where: { id: leadId },
        data: {
            montantPaye: nouveauMontantPaye,
            datePaiement: new Date(),
            status: newStatus,
            notes: updatedNotes,
            // Reset relance count si paiement reçu
            relancePaiementCount: 0,
            dateRelancePaiement: null,
        },
    });

    await logActivity(
        leadId,
        LeadActivityType.PAIEMENT_RECU,
        noteEntry,
        recordedBy,
        {
            montantPaye: montant,
            totalPaye: nouveauMontantPaye,
            montantTotal: lead.montantTotal,
            seuilMinimumPercent,
            seuilAtteint,
            newStatus: newStatus as string,
        },
    );

    revalidatePath('/crm');

    return {
        success: true,
        newStatus: newStatus as string,
        montantPaye: nouveauMontantPaye,
        montantTotal: lead.montantTotal,
        seuilAtteint,
        message,
    };
}


// ─────────────────────────────────────────────────────────
// ACTION 5 — relancePaiement
// ─────────────────────────────────────────────────────────

/**
 * Gère les relances de paiement manuelles.
 *
 * Logique de relance :
 * - Relance 1 = J+3 après dateFacture
 * - Relance 2 = J+7 après dateFacture
 * - Archivage = J+14 si 0€ → statut PERDU
 */
export async function relancePaiement(input: z.input<typeof RelancePaiementSchema>) {
    const parsed = RelancePaiementSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const { leadId, performedBy, notes: inputNotes } = parsed.data;

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
            id: true,
            status: true,
            montantTotal: true,
            montantPaye: true,
            dateFacture: true,
            relancePaiementCount: true,
        },
    });

    if (!lead) {
        return { success: false, error: 'Lead introuvable' };
    }

    if (lead.status !== LeadStatus.EN_ATTENTE_PAIEMENT) {
        return {
            success: false,
            error: `Relance uniquement possible en "EN_ATTENTE_PAIEMENT". Statut actuel : ${lead.status}`,
        };
    }

    const newRelanceCount = lead.relancePaiementCount + 1;
    const now = new Date();

    // Vérifier si J+14 et 0€ → archivage automatique
    const daysSinceFacture = lead.dateFacture
        ? Math.floor((now.getTime() - lead.dateFacture.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const montantPaye = lead.montantPaye || 0;
    const isArchivable = daysSinceFacture >= RELANCE_PAIEMENT_JOURS.ARCHIVE && montantPaye === 0;

    if (isArchivable) {
        // Archivage pour non-paiement
        const archiveNote = `🗄️ Archivé pour non-paiement (J+${daysSinceFacture}, 0€ reçu après ${newRelanceCount} relances)`;
        const updatedNotes = await appendNote(leadId, archiveNote);

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: LeadStatus.PERDU,
                lostReason: 'Non-paiement (aucun versement après 14 jours)',
                relancePaiementCount: newRelanceCount,
                dateRelancePaiement: now,
                notes: updatedNotes,
            },
        });

        await logActivity(
            leadId,
            LeadActivityType.ARCHIVE_NON_PAIEMENT,
            archiveNote,
            performedBy,
            {
                daysSinceFacture,
                relanceCount: newRelanceCount,
                montantPaye: 0,
                newStatus: 'PERDU',
            },
        );

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: 'PERDU',
            archived: true,
            relanceCount: newRelanceCount,
            message: `Lead archivé — aucun paiement reçu après ${daysSinceFacture} jours et ${newRelanceCount} relances.`,
        };
    }

    // Relance normale
    let relanceType: string;
    if (newRelanceCount === 1) {
        relanceType = `Relance 1 (J+${RELANCE_PAIEMENT_JOURS.RELANCE_1})`;
    } else if (newRelanceCount === 2) {
        relanceType = `Relance 2 (J+${RELANCE_PAIEMENT_JOURS.RELANCE_2})`;
    } else {
        relanceType = `Relance #${newRelanceCount}`;
    }

    const relanceNote = `🔔 ${relanceType} — paiement en attente${inputNotes ? ` | ${inputNotes}` : ''}`;
    const updatedNotes = await appendNote(leadId, relanceNote);

    await prisma.lead.update({
        where: { id: leadId },
        data: {
            relancePaiementCount: newRelanceCount,
            dateRelancePaiement: now,
            notes: updatedNotes,
        },
    });

    await logActivity(
        leadId,
        LeadActivityType.RELANCE_PAIEMENT,
        relanceNote,
        performedBy,
        {
            relanceCount: newRelanceCount,
            daysSinceFacture,
            montantPaye,
            montantTotal: lead.montantTotal,
        },
    );

    revalidatePath('/crm');

    // Avertissement si proche de l'archivage
    const isCloseToArchive = daysSinceFacture >= RELANCE_PAIEMENT_JOURS.RELANCE_2 && montantPaye === 0;

    return {
        success: true,
        newStatus: 'EN_ATTENTE_PAIEMENT',
        relanceCount: newRelanceCount,
        daysSinceFacture,
        isCloseToArchive,
        message: isCloseToArchive
            ? `⚠️ ${relanceType} envoyée. Attention : archivage automatique dans ${RELANCE_PAIEMENT_JOURS.ARCHIVE - daysSinceFacture} jours si aucun paiement.`
            : `✅ ${relanceType} envoyée. ${daysSinceFacture > 0 ? `(J+${daysSinceFacture} depuis la facture)` : ''}`,
    };
}

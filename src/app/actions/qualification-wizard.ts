'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { LeadStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// Server Actions pour le QualificationWizard
// ─────────────────────────────────────────────────────────

// ── A1 : Planifier Relance (RDV non honoré) ──

const PlanifierRelanceSchema = z.object({
    leadId: z.string().min(1),
    dateRelance: z.string().min(1, 'Date de relance requise'),
    notes: z.string().optional(),
    performedBy: z.string().min(1),
});

export async function planifierRelance(input: z.input<typeof PlanifierRelanceSchema>) {
    const result = PlanifierRelanceSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, dateRelance, notes, performedBy } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const relanceDate = new Date(dateRelance).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        const noteEntry = `[${timestamp}] ❌ RDV non honoré — Relance planifiée le ${relanceDate}${notes ? ' — ' + notes : ''}`;
        const concatenatedNotes = lead.notes ? noteEntry + '\n' + lead.notes : noteEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'RDV_NON_HONORE',
                dateRdv: new Date(dateRelance),
                notes: concatenatedNotes,
            },
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: 'RDV_NON_HONORE',
            message: `Relance planifiée le ${relanceDate}`,
        };
    } catch (error) {
        console.error('[planifierRelance] Error:', error);
        return { success: false, error: 'Erreur lors de la planification' };
    }
}

// ── A1 bis : Marquer comme non honoré (sans relance) ──

const MarquerNonHonoreSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
});

export async function marquerNonHonore(input: z.input<typeof MarquerNonHonoreSchema>) {
    const result = MarquerNonHonoreSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Données invalides' };
    }

    const { leadId, performedBy } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const noteEntry = `[${timestamp}] ❌ RDV non honoré — En attente d'action (appel)`;
        const concatenatedNotes = lead.notes ? noteEntry + '\n' + lead.notes : noteEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'RDV_NON_HONORE',
                notes: concatenatedNotes,
            },
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: 'RDV_NON_HONORE',
            message: 'Lead marqué comme RDV non honoré. Action suivante : Appeler le lead.',
        };
    } catch (error) {
        console.error('[marquerNonHonore] Error:', error);
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

// ─────────────────────────────────────────────────────────
// A2 : Enregistrer le résultat d'un appel
// ─────────────────────────────────────────────────────────

const CALL_RESULTS = [
    'REPONDU_INTERESSE',
    'REPONDU_NON_INTERESSE',
    'REPONDU_RAPPELER',
    'PAS_REPONSE_MESSAGE',
    'PAS_REPONSE_HORS_LIGNE',
    'NUMERO_INCORRECT',
] as const;

const EnregistrerAppelSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
    resultat: z.enum(CALL_RESULTS),
    dateRelance: z.string().optional(),
    notes: z.string().optional(),
    lostReason: z.string().optional(),
});

export async function enregistrerResultatAppel(input: z.input<typeof EnregistrerAppelSchema>) {
    const result = EnregistrerAppelSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, performedBy, resultat, dateRelance, notes, lostReason } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const relanceCount = (lead.relanceCount || 0) + 1;

        // Déterminer le statut et la note selon le résultat
        let newStatus: string;
        let noteLabel: string;
        let message: string;
        const updateData: Record<string, unknown> = { relanceCount };

        switch (resultat) {
            case 'REPONDU_INTERESSE': {
                newStatus = 'RDV_PLANIFIE';
                noteLabel = '✅ Répondu — Intéressé → Nouveau RDV fixé';
                message = 'Lead intéressé ! Nouveau RDV planifié.';
                if (dateRelance) {
                    updateData.dateRdv = new Date(dateRelance);
                    const rdvDate = new Date(dateRelance).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long',
                        hour: '2-digit', minute: '2-digit',
                    });
                    noteLabel += ` le ${rdvDate}`;
                    message = `Lead intéressé ! RDV fixé le ${rdvDate}`;
                }
                break;
            }
            case 'REPONDU_NON_INTERESSE': {
                newStatus = 'PERDU';
                noteLabel = '❌ Répondu — Non intéressé';
                message = 'Lead marqué comme perdu (non intéressé).';
                updateData.lostReason = lostReason || 'Non intéressé suite à appel';
                break;
            }
            case 'REPONDU_RAPPELER': {
                newStatus = 'RDV_NON_HONORE';
                noteLabel = '🔄 Répondu — Rappeler plus tard';
                message = 'Relance planifiée (rappeler plus tard).';
                if (dateRelance) {
                    updateData.dateRdv = new Date(dateRelance);
                    const relDate = new Date(dateRelance).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long',
                        hour: '2-digit', minute: '2-digit',
                    });
                    noteLabel += ` → Relance le ${relDate}`;
                    message = `Relance planifiée le ${relDate}`;
                }
                break;
            }
            case 'PAS_REPONSE_MESSAGE': {
                newStatus = 'RDV_NON_HONORE';
                noteLabel = '📞 Pas de réponse — Message laissé';
                message = 'Message laissé. Relance planifiée.';
                if (dateRelance) {
                    updateData.dateRdv = new Date(dateRelance);
                    const relDate = new Date(dateRelance).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long',
                        hour: '2-digit', minute: '2-digit',
                    });
                    noteLabel += ` → Relance le ${relDate}`;
                }
                break;
            }
            case 'PAS_REPONSE_HORS_LIGNE': {
                // Si déjà relancé 3+ fois → PERDU
                if (relanceCount >= 3) {
                    newStatus = 'PERDU';
                    noteLabel = `📵 Hors ligne (${relanceCount}e tentative) → Marqué comme PERDU`;
                    message = `Après ${relanceCount} tentatives sans réponse, le lead est marqué comme perdu.`;
                    updateData.lostReason = `Hors ligne après ${relanceCount} tentatives`;
                } else {
                    newStatus = 'RDV_NON_HONORE';
                    noteLabel = `📵 Hors ligne (${relanceCount}e tentative)`;
                    message = `Tentative ${relanceCount}/3 — Relance planifiée.`;
                    if (dateRelance) {
                        updateData.dateRdv = new Date(dateRelance);
                        const relDate = new Date(dateRelance).toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long',
                            hour: '2-digit', minute: '2-digit',
                        });
                        noteLabel += ` → Relance le ${relDate}`;
                    }
                }
                break;
            }
            case 'NUMERO_INCORRECT': {
                newStatus = 'PERDU';
                noteLabel = '⚠️ Numéro incorrect → Marqué comme PERDU + Email à envoyer';
                message = 'Numéro incorrect. Lead marqué comme perdu. Pensez à envoyer un email.';
                updateData.lostReason = lostReason || 'Numéro de téléphone incorrect';
                break;
            }
            default:
                return { success: false, error: 'Résultat d\'appel invalide' };
        }

        // Construire la note
        const fullNote = `[${timestamp}] 📞 Appel (tentative ${relanceCount}) — ${noteLabel}${notes ? ' — ' + notes : ''}`;
        const concatenatedNotes = lead.notes ? fullNote + '\n' + lead.notes : fullNote;

        updateData.status = newStatus;
        updateData.notes = concatenatedNotes;

        await prisma.lead.update({
            where: { id: leadId },
            data: updateData,
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus,
            message,
            relanceCount,
        };
    } catch (error) {
        console.error('[enregistrerResultatAppel] Error:', error);
        return { success: false, error: 'Erreur lors de l\'enregistrement de l\'appel' };
    }
}

// ─────────────────────────────────────────────────────────
// B : Choix du financement (RDV honoré)
// ─────────────────────────────────────────────────────────

const FINANCEMENT_TYPES = ['CPF', 'PERSONNEL', 'POLE_EMPLOI', 'OPCO'] as const;

const ChoisirFinancementSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
    financementType: z.enum(FINANCEMENT_TYPES),
    notes: z.string().optional(),
});

export async function choisirFinancement(input: z.input<typeof ChoisirFinancementSchema>) {
    const result = ChoisirFinancementSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, performedBy, financementType, notes } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

        // Déterminer le statut et le message selon le type de financement
        let newStatus: string;
        let noteLabel: string;
        let message: string;

        const LABELS: Record<string, string> = {
            CPF: 'CPF (Compte Personnel de Formation)',
            PERSONNEL: 'Fonds Personnel',
            POLE_EMPLOI: 'Pôle Emploi (AIF)',
            OPCO: 'OPCO (Plan de formation)',
        };

        const typeLabel = LABELS[financementType] || financementType;

        switch (financementType) {
            case 'CPF': {
                newStatus = 'CPF_COMPTE_A_DEMANDER';
                noteLabel = `💳 Financement choisi : ${typeLabel} → Vérification du compte CPF`;
                message = `Financement CPF sélectionné. Prochaine étape : vérifier le compte CPF du lead.`;
                break;
            }
            case 'PERSONNEL': {
                newStatus = 'TEST_EN_COURS_PERSO';
                noteLabel = `💰 Financement choisi : ${typeLabel} → Test / Devis en cours`;
                message = `Financement personnel sélectionné. Prochaine étape : test et envoi du devis.`;
                break;
            }
            case 'POLE_EMPLOI': {
                newStatus = 'NEGOCIATION';
                noteLabel = `🏛️ Financement choisi : ${typeLabel} → Demande AIF en cours`;
                message = `Financement Pôle Emploi sélectionné. Prochaine étape : constituer le dossier AIF.`;
                break;
            }
            case 'OPCO': {
                newStatus = 'NEGOCIATION';
                noteLabel = `🏢 Financement choisi : ${typeLabel} → Demande OPCO en cours`;
                message = `Financement OPCO sélectionné. Prochaine étape : constituer le dossier de prise en charge.`;
                break;
            }
            default:
                return { success: false, error: 'Type de financement invalide' };
        }

        const fullNote = `[${timestamp}] ✅ RDV honoré — ${noteLabel}${notes ? ' — ' + notes : ''}`;
        const concatenatedNotes = lead.notes ? fullNote + '\n' + lead.notes : fullNote;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: newStatus as LeadStatus,
                financementType: financementType as string,
                notes: concatenatedNotes,
            } as Record<string, unknown>,
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus,
            financementType,
            message,
        };
    } catch (error) {
        console.error('[choisirFinancement] Error:', error);
        return { success: false, error: 'Erreur lors du choix de financement' };
    }
}

// ─────────────────────────────────────────────────────────
// C : Test de positionnement
// ─────────────────────────────────────────────────────────

const GenererLienTestSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
});

export async function genererLienTest(input: z.input<typeof GenererLienTestSchema>) {
    const result = GenererLienTestSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Données invalides' };
    }

    const { leadId, performedBy } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

        // Générer un token unique pour le lien de test
        const testToken = `TEST-${leadId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
        const testLink = `/test-positionnement/${testToken}`;

        const noteEntry = `[${timestamp}] 📝 Lien de test de positionnement généré et envoyé`;
        const concatenatedNotes = lead.notes ? noteEntry + '\n' + lead.notes : noteEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'TEST_EN_COURS_PERSO' as LeadStatus,
                notes: concatenatedNotes,
            },
        });

        revalidatePath('/crm');

        return {
            success: true,
            testLink,
            testToken,
            newStatus: 'TEST_EN_COURS_PERSO',
            message: `Lien de test généré : ${testLink}`,
        };
    } catch (error) {
        console.error('[genererLienTest] Error:', error);
        return { success: false, error: 'Erreur lors de la génération du lien' };
    }
}

// ─────────────────────────────────────────────────────────
// D : Actions CPF — Vérification de compte, identité, etc.
// ─────────────────────────────────────────────────────────

const UpdateLeadCPFSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
    action: z.string().min(1),
    newStatus: z.string().optional(),
    noteText: z.string().min(1),
    problemDescription: z.string().optional(),
});

export async function updateLeadCPFAction(input: z.input<typeof UpdateLeadCPFSchema>) {
    const result = UpdateLeadCPFSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, performedBy, action, newStatus, noteText, problemDescription } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const fullNote = `[${timestamp}] ${noteText}${problemDescription ? ' — Détail : ' + problemDescription : ''}`;
        const concatenatedNotes = lead.notes ? fullNote + '\n' + lead.notes : fullNote;

        const updateData: Record<string, unknown> = {
            notes: concatenatedNotes,
        };

        if (newStatus) {
            updateData.status = newStatus as LeadStatus;
        }

        await prisma.lead.update({
            where: { id: leadId },
            data: updateData,
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: newStatus || lead.status,
            action,
            message: `Action "${action}" enregistrée avec succès.`,
        };
    } catch (error) {
        console.error('[updateLeadCPFAction] Error:', error);
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

// ─────────────────────────────────────────────────────────
// E : Envoi de courrier (pour ouverture compte CPF)
// ─────────────────────────────────────────────────────────

const EnvoyerCourrierSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
    dateEnvoi: z.string().min(1, 'Date d\'envoi requise'),
    notes: z.string().optional(),
});

export async function envoyerCourrier(input: z.input<typeof EnvoyerCourrierSchema>) {
    const result = EnvoyerCourrierSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, performedBy, dateEnvoi, notes } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const envoiDate = new Date(dateEnvoi).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const noteEntry = `[${timestamp}] 📬 Courrier envoyé le ${envoiDate} — Ouverture de compte CPF${notes ? ' — ' + notes : ''}`;
        const concatenatedNotes = lead.notes ? noteEntry + '\n' + lead.notes : noteEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'COURRIERS_ENVOYES' as LeadStatus,
                notes: concatenatedNotes,
            },
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: 'COURRIERS_ENVOYES',
            message: `Courrier envoyé le ${envoiDate}. En attente de réception.`,
        };
    } catch (error) {
        console.error('[envoyerCourrier] Error:', error);
        return { success: false, error: 'Erreur lors de l\'envoi du courrier' };
    }
}

// ─────────────────────────────────────────────────────────
// F : Réception de courrier
// ─────────────────────────────────────────────────────────

const ReceptionCourrierSchema = z.object({
    leadId: z.string().min(1),
    performedBy: z.string().min(1),
    dateReception: z.string().min(1, 'Date de réception requise'),
    notes: z.string().optional(),
});

export async function receptionCourrier(input: z.input<typeof ReceptionCourrierSchema>) {
    const result = ReceptionCourrierSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, performedBy, dateReception, notes } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const recDate = new Date(dateReception).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const noteEntry = `[${timestamp}] 📨 Courrier reçu le ${recDate}${notes ? ' — ' + notes : ''}`;
        const concatenatedNotes = lead.notes ? noteEntry + '\n' + lead.notes : noteEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'COURRIERS_RECUS' as LeadStatus,
                notes: concatenatedNotes,
            },
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: 'COURRIERS_RECUS',
            message: `Courrier reçu le ${recDate}. Prochaine étape : Inscription.`,
        };
    } catch (error) {
        console.error('[receptionCourrier] Error:', error);
        return { success: false, error: 'Erreur lors de la réception du courrier' };
    }
}

// ─────────────────────────────────────────────────────────
// G : Planification du prochain RDV (après réception courrier CPF)
// ─────────────────────────────────────────────────────────

const PlanifierRdvCpfSchema = z.object({
    leadId: z.string().min(1),
    dateRdv: z.string().min(1, 'Date de rendez-vous requise'),
    notes: z.string().optional(),
    performedBy: z.string().min(1),
});

export async function planifierProchainRdvCpf(input: z.input<typeof PlanifierRdvCpfSchema>) {
    const result = PlanifierRdvCpfSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: result.error.errors[0]?.message || 'Données invalides' };
    }

    const { leadId, dateRdv, notes, performedBy } = result.data;

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { success: false, error: 'Lead introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const rdvDateStr = new Date(dateRdv).toLocaleString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        const noteEntry = `[${timestamp}] 📅 Prochain RDV CPF fixé le ${rdvDateStr}${notes ? ' — ' + notes : ''}`;
        const concatenatedNotes = lead.notes ? noteEntry + '\n' + lead.notes : noteEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                dateRdv: new Date(dateRdv),
                notes: concatenatedNotes,
            },
        });

        revalidatePath('/crm');

        return {
            success: true,
            newStatus: lead.status, // We do not change status, remains COURRIERS_RECUS for now
            message: `Prochain RDV fixé le ${rdvDateStr}`,
        };
    } catch (error) {
        console.error('[planifierProchainRdvCpf] Error:', error);
        return { success: false, error: 'Erreur lors de la planification du RDV' };
    }
}

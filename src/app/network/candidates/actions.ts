'use server';

/**
 * ACTIONS — Franchise Candidates
 * ================================
 * Server Actions pour la gestion CRUD des candidats franchise.
 * Support: Personnes morales (société + représentant), type OF/CFA.
 * Toutes les actions respectent l'isolation tenant (organizationId).
 */

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { resolveOrganizationId } from '@/lib/network/resolveOrg';
import { logCandidateActivity } from '@/lib/network/activities';
import { auth } from '@/auth';
import { convertCandidateToFranchise } from '@/lib/network/conversion';
import { NetworkType, Role } from '@prisma/client';

// ─── Validation ───────────────────────────────────────────────

const candidateSchema = z.object({
    franchiseType: z.enum(['OF', 'CFA'], { required_error: 'Type de franchise requis' }),
    companyName: z.string().min(2, 'Raison sociale requise (min 2 caractères)'),
    siret: z.string().optional(),
    email: z.string().email('Email invalide'),
    phone: z.string().optional(),
    representantNom: z.string().min(2, 'Nom du représentant requis'),
    representantPrenom: z.string().min(2, 'Prénom du représentant requis'),
    representantFonction: z.string().optional(),
    targetZone: z.string().optional(),
    targetZipCodes: z.string().optional(),
    investmentBudget: z.string().optional(),
    notes: z.string().optional(),
});

const updateStatusSchema = z.object({
    candidateId: z.string().min(1),
    newStatus: z.enum(['NEW', 'CONTACTED', 'DIP_SENT', 'DIP_SIGNED', 'CONTRACT_SENT', 'SIGNED', 'REJECTED', 'WITHDRAWN']),
});

// ─── CREATE ───────────────────────────────────────────────────

export async function createCandidate(formData: FormData) {
    const session = await auth();
    const resolved = await resolveOrganizationId();
    if (resolved.error) {
        return { error: resolved.error };
    }
    const orgId = resolved.organizationId!;
    const userId = session?.user?.id;

    const raw = {
        franchiseType: formData.get('franchiseType') as string,
        companyName: formData.get('companyName') as string,
        siret: formData.get('siret') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        representantNom: formData.get('representantNom') as string,
        representantPrenom: formData.get('representantPrenom') as string,
        representantFonction: formData.get('representantFonction') as string,
        targetZone: formData.get('targetZone') as string,
        targetZipCodes: formData.get('targetZipCodes') as string,
        investmentBudget: formData.get('investmentBudget') as string,
        notes: formData.get('notes') as string,
    };

    const parsed = candidateSchema.safeParse(raw);
    if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const firstError = Object.values(errors).flat()[0];
        return { error: firstError || 'Validation échouée' };
    }

    try {
        // Vérifier doublon email dans cette org
        const existing = await prisma.franchiseCandidate.findFirst({
            where: {
                organizationId: orgId,
                email: parsed.data.email,
                status: { notIn: ['REJECTED', 'WITHDRAWN'] },
            },
        });

        if (existing) {
            return { error: 'Un candidat avec cet email existe déjà dans le pipeline' };
        }

        const zipCodes = parsed.data.targetZipCodes
            ? parsed.data.targetZipCodes.split(',').map(z => z.trim()).filter(Boolean)
            : [];

        const candidate = await prisma.franchiseCandidate.create({
            data: {
                organizationId: orgId,
                franchiseType: parsed.data.franchiseType,
                companyName: parsed.data.companyName,
                siret: parsed.data.siret || null,
                email: parsed.data.email,
                phone: parsed.data.phone || null,
                representantNom: parsed.data.representantNom,
                representantPrenom: parsed.data.representantPrenom,
                representantFonction: parsed.data.representantFonction || null,
                targetZone: parsed.data.targetZone || null,
                targetZipCodes: zipCodes,
                investmentBudget: parsed.data.investmentBudget
                    ? parseFloat(parsed.data.investmentBudget)
                    : null,
                notes: parsed.data.notes || null,
                status: 'NEW',
                motivationIndex: 50, // Point de départ
                leadSource: 'MANUAL',
            },
        });

        // Log activité
        await logCandidateActivity({
            candidateId: candidate.id,
            type: 'STATUS_CHANGE',
            description: `Création du candidat (${candidate.franchiseType}) par saisie manuelle. Statut initial: NOUVEAU.`,
            metadata: { source: 'MANUAL', status: 'NEW' },
            performedBy: userId,
        });

        revalidatePath('/network/candidates');
        return { success: true };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[CandidateAction] Erreur création:', msg);
        return { error: `Erreur: ${msg}` };
    }
}

// ─── UPDATE CANDIDATE ────────────────────────────────────────

export async function updateCandidate(formData: FormData) {
    const session = await auth();
    const resolved = await resolveOrganizationId();
    if (resolved.error) {
        return { error: resolved.error };
    }
    const orgId = resolved.organizationId!;
    const userId = session?.user?.id;
    const candidateId = formData.get('candidateId') as string;

    if (!candidateId) {
        return { error: 'ID candidat manquant' };
    }

    const raw = {
        franchiseType: formData.get('franchiseType') as string,
        companyName: formData.get('companyName') as string,
        siret: formData.get('siret') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        representantNom: formData.get('representantNom') as string,
        representantPrenom: formData.get('representantPrenom') as string,
        representantFonction: formData.get('representantFonction') as string,
        targetZone: formData.get('targetZone') as string,
        targetZipCodes: formData.get('targetZipCodes') as string,
        investmentBudget: formData.get('investmentBudget') as string,
        notes: formData.get('notes') as string,
    };

    const parsed = candidateSchema.safeParse(raw);
    if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const firstError = Object.values(errors).flat()[0];
        return { error: firstError || 'Validation échouée' };
    }

    try {
        // Vérifier ownership
        const candidate = await prisma.franchiseCandidate.findFirst({
            where: { id: candidateId, organizationId: orgId },
        });

        if (!candidate) {
            return { error: 'Candidat introuvable' };
        }

        // Vérifier doublon email (ignorer le candidat édité)
        if (parsed.data.email !== candidate.email) {
            const emailConflict = await prisma.franchiseCandidate.findFirst({
                where: {
                    organizationId: orgId,
                    email: parsed.data.email,
                    id: { not: candidateId },
                    status: { notIn: ['REJECTED', 'WITHDRAWN'] },
                },
            });
            if (emailConflict) {
                return { error: 'Un autre candidat utilise déjà cet email' };
            }
        }

        const zipCodes = parsed.data.targetZipCodes
            ? parsed.data.targetZipCodes.split(',').map(z => z.trim()).filter(Boolean)
            : [];

        await prisma.franchiseCandidate.update({
            where: { id: candidateId },
            data: {
                franchiseType: parsed.data.franchiseType,
                companyName: parsed.data.companyName,
                siret: parsed.data.siret || null,
                email: parsed.data.email,
                phone: parsed.data.phone || null,
                representantNom: parsed.data.representantNom,
                representantPrenom: parsed.data.representantPrenom,
                representantFonction: parsed.data.representantFonction || null,
                targetZone: parsed.data.targetZone || null,
                targetZipCodes: zipCodes,
                investmentBudget: parsed.data.investmentBudget
                    ? parseFloat(parsed.data.investmentBudget)
                    : null,
                notes: parsed.data.notes || null,
            },
        });

        // Log activité
        await logCandidateActivity({
            candidateId,
            type: 'DOSSIER_UPDATE',
            description: 'Mise à jour des informations du dossier candidat.',
            performedBy: userId,
        });

        revalidatePath('/network/candidates');
        return { success: true };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[CandidateAction] Erreur update candidat:', msg);
        return { error: `Erreur: ${msg}` };
    }
}

// ─── UPDATE STATUS ────────────────────────────────────────────

export async function updateCandidateStatus(formData: FormData) {
    const session = await auth();
    const resolved = await resolveOrganizationId();
    if (resolved.error) {
        return { error: resolved.error };
    }
    const orgId = resolved.organizationId!;
    const userId = session?.user?.id;

    const raw = {
        candidateId: formData.get('candidateId') as string,
        newStatus: formData.get('newStatus') as string,
    };

    const parsed = updateStatusSchema.safeParse(raw);
    if (!parsed.success) {
        return { error: 'Statut invalide' };
    }

    try {
        const candidate = await prisma.franchiseCandidate.findFirst({
            where: { id: parsed.data.candidateId, organizationId: orgId },
        });

        if (!candidate) {
            return { error: 'Candidat introuvable' };
        }

        // Calcul motivation (simplifié pour Phase 1)
        let newMotivation = candidate.motivationIndex || 50;
        const progressSteps = ['NEW', 'CONTACTED', 'DIP_SENT', 'DIP_SIGNED', 'CONTRACT_SENT', 'SIGNED'];
        const oldStepIndex = progressSteps.indexOf(candidate.status);
        const newStepIndex = progressSteps.indexOf(parsed.data.newStatus as string);

        if (newStepIndex > oldStepIndex) {
            // Progression : +10 points par palier
            newMotivation = Math.min(100, newMotivation + (newStepIndex - oldStepIndex) * 10);
        } else if (parsed.data.newStatus === 'REJECTED' || parsed.data.newStatus === 'WITHDRAWN') {
            newMotivation = 0;
        }

        // --- Loi Doubin Verification (délai configurable) ---
        if (parsed.data.newStatus === 'SIGNED') {
            const dipDate = candidate.dipSentAt || candidate.dipSignedAt;
            if (!dipDate) {
                return { error: 'Loi Doubin : Le DIP doit être envoyé avant de signer le contrat.' };
            }

            // Charger le délai configurable depuis NetworkSettings
            const networkSettings = await prisma.networkSettings.findFirst({
                where: { organizationId: orgId },
                select: { doubinDelayDays: true },
            });
            const doubinDelay = networkSettings?.doubinDelayDays ?? 20;

            const now = new Date();
            const daysSinceDIP = Math.floor((now.getTime() - dipDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceDIP < doubinDelay) {
                return { error: `Loi Doubin : Le délai légal de ${doubinDelay} jours n'est pas encore révolu (${daysSinceDIP}/${doubinDelay} jours).` };
            }
        }

        const updateData: any = { status: parsed.data.newStatus, motivationIndex: newMotivation };
        if (parsed.data.newStatus === 'DIP_SENT' && !candidate.dipSentAt) {
            updateData.dipSentAt = new Date();
        }
        if (parsed.data.newStatus === 'DIP_SIGNED' && !candidate.dipSignedAt) {
            updateData.dipSignedAt = new Date();
        }
        if (parsed.data.newStatus === 'SIGNED' && !candidate.contractSignedAt) {
            updateData.contractSignedAt = new Date();
        }

        await prisma.franchiseCandidate.update({
            where: { id: parsed.data.candidateId },
            data: updateData,
        });

        // Log activité
        const statusLabel = {
            NEW: 'Nouveau',
            CONTACTED: 'Contacté',
            DIP_SENT: 'DIP Envoyé',
            DIP_SIGNED: 'DIP Signé',
            CONTRACT_SENT: 'Contrat Envoyé',
            SIGNED: 'Signé',
            REJECTED: 'Rejeté',
            WITHDRAWN: 'Retiré'
        }[parsed.data.newStatus as string] || parsed.data.newStatus;

        await logCandidateActivity({
            candidateId: parsed.data.candidateId,
            type: 'STATUS_CHANGE',
            description: `Changement de statut vers : ${statusLabel}. Motivation actuelle : ${newMotivation}%.`,
            metadata: {
                oldStatus: candidate.status,
                newStatus: parsed.data.newStatus,
                motivation: newMotivation
            },
            performedBy: userId,
        });

        revalidatePath('/network/candidates');
        return { success: true };
    } catch (error) {
        console.error('[CandidateAction] Erreur update status:', error);
        return { error: 'Erreur lors de la mise à jour' };
    }
}

/**
 * Action finale d'onboarding : Convertit le candidat en Organisation
 */
export async function finalizeFranchiseOnboarding(candidateId: string) {
    const session = await auth();
    if (!session || session.user.role.code !== 'ADMIN') {
        return { error: 'Action réservée aux administrateurs.' };
    }

    try {
        const result = await convertCandidateToFranchise(candidateId);

        revalidatePath('/network/candidates');
        revalidatePath('/network/organizations');

        return { success: true, orgId: result.orgId };
    } catch (error: any) {
        console.error('[finalizeFranchiseOnboarding] Error:', error);
        return { error: error.message || 'Erreur lors de la conversion du candidat.' };
    }
}

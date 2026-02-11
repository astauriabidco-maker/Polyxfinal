'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { calculateCandidateScores, type QualificationAnswers } from '@/lib/network/qualification';
import { logCandidateActivity } from '@/lib/network/activities';
import { LeadSource } from '@prisma/client';

const publicApplySchema = z.object({
    // Identité
    franchiseType: z.enum(['OF', 'CFA']),
    companyName: z.string().min(2, 'Le nom de la société est requis'),
    siret: z.string().optional(),
    email: z.string().email('Email invalide'),
    phone: z.string().min(10, 'Numéro de téléphone invalide'),
    representantNom: z.string().min(2, 'Le nom est requis'),
    representantPrenom: z.string().min(2, 'Le prénom est requis'),
    representantFonction: z.string().optional(),

    // Questionnaire
    investmentCapacity: z.enum(['LESS_20K', '20K_50K', '50K_100K', 'OVER_100K']),
    totalBudget: z.string().optional(),
    hasPedagogicalExp: z.boolean(),
    hasManagementExp: z.boolean(),
    hasEntrepreneurialExp: z.boolean(),
    targetZone: z.string().optional(),
    hasLocal: z.boolean(),
    timing: z.enum(['URGENT', 'MEDIUM', 'LONG_TERM']),
    motivationChoice: z.string().min(10, 'Merci de détailler votre motivation (min 10 caractères)'),

    // UTM & Tracking
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    leadSource: z.nativeEnum(LeadSource).default(LeadSource.WEBSITE_FORM),
});

export async function submitPublicApplication(data: unknown) {
    console.log('[submitPublicApplication] Data received:', data);

    const parsed = publicApplySchema.safeParse(data);
    if (!parsed.success) {
        console.error('[submitPublicApplication] Validation error detail:', JSON.stringify(parsed.error.format(), null, 2));
        return {
            error: 'Données invalides.',
            details: parsed.error.format()
        };
    }

    try {
        const {
            investmentCapacity, totalBudget, hasPedagogicalExp, hasManagementExp,
            hasEntrepreneurialExp, targetZone, hasLocal, timing, motivationChoice,
            ...baseInfo
        } = parsed.data;

        // Préparation des réponses pour le scoring
        const answers: QualificationAnswers = {
            investmentCapacity,
            totalBudget: totalBudget ? parseFloat(totalBudget) : 0,
            hasPedagogicalExp,
            hasManagementExp,
            hasEntrepreneurialExp,
            targetZone: targetZone || '',
            hasLocal,
            timing,
            motivationChoice
        };

        // Calcul des scores
        const scores = calculateCandidateScores(answers);

        // Déterminer l'organisation "Siège" (Propriétaire du pipeline)
        // Note: Dans une version multi-franchiseur, on passerait un orgId ciblé.
        // Ici on prend la première organisation de type SIÈGE ou la première tout court par défaut.
        const masterOrg = await prisma.organization.findFirst({
            where: { networkType: 'HEAD_OFFICE' }
        });

        if (!masterOrg) {
            return { error: 'Configuration système incomplète (Master Org manquante).' };
        }

        // Création du candidat
        const candidate = await prisma.franchiseCandidate.create({
            data: {
                organizationId: masterOrg.id,
                franchiseType: baseInfo.franchiseType,
                companyName: baseInfo.companyName,
                siret: baseInfo.siret,
                email: baseInfo.email,
                phone: baseInfo.phone,
                representantNom: baseInfo.representantNom,
                representantPrenom: baseInfo.representantPrenom,
                representantFonction: baseInfo.representantFonction,
                targetZone: targetZone,
                investmentBudget: totalBudget ? parseFloat(totalBudget) : null,

                // Source & Tracking
                leadSource: baseInfo.leadSource,
                utmSource: baseInfo.utmSource,
                utmMedium: baseInfo.utmMedium,
                utmCampaign: baseInfo.utmCampaign,

                // Scoring
                qualificationScore: scores.global,
                financialScore: scores.financial,
                experienceScore: scores.experience,
                geoScore: scores.geo,
                timingScore: scores.timing,
                motivationIndex: scores.motivation, // Motivation initiale basée sur le questionnaire

                // Réponses structurées
                qualificationAnswers: answers as any,

                // Statut initial
                status: 'NEW',
            }
        });

        // Log activité initiale
        await logCandidateActivity({
            candidateId: candidate.id,
            type: 'STATUS_CHANGE',
            description: `Candidature publique reçue (${baseInfo.leadSource}). Score de qualification: ${scores.global}%. Statut: ${candidate.status === 'NEW' ? 'NOUVEAU' : 'LEAD (A Revérifier)'}.`,
            metadata: {
                scores,
                source: baseInfo.leadSource,
                utm: {
                    source: baseInfo.utmSource,
                    medium: baseInfo.utmMedium,
                    campaign: baseInfo.utmCampaign
                }
            }
        });

        return { success: true, candidateId: candidate.id };
    } catch (error) {
        console.error('[submitPublicApplication] Error:', error);
        return { error: 'Une erreur est survenue lors de l\'envoi de votre candidature.' };
    }
}

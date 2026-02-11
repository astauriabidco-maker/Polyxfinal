import { prisma } from '@/lib/prisma';
import { CandidateActivityType } from '@prisma/client';

/**
 * UTILS — Activités Candidats Franchise
 * =====================================
 * Centralise l'enregistrement des actions dans la timeline.
 */

interface LogActivityParams {
    candidateId: string;
    type: CandidateActivityType;
    description: string;
    metadata?: Record<string, any>;
    performedBy?: string; // userId
}

/**
 * Enregistre une activité dans le journal d'audit du candidat.
 */
export async function logCandidateActivity({
    candidateId,
    type,
    description,
    metadata = {},
    performedBy,
}: LogActivityParams) {
    try {
        await prisma.candidateActivity.create({
            data: {
                candidateId,
                type,
                description,
                metadata,
                performedBy,
            },
        });
    } catch (error) {
        console.error('[logCandidateActivity] Erreur:', error);
        // Note: On ne bloque pas le flux principal si le log échoue
    }
}

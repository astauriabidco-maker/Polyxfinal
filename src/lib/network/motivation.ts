import { prisma } from '@/lib/prisma';

/**
 * Script de maintenance pour dégrader la motivation des candidats inactifs.
 * Un candidat est considéré inactif s'il n'a eu aucune activité (ou mise à jour)
 * depuis plus de 7 jours, et s'il n'est pas déjà dans un statut final.
 */
export async function processMotivationDecay() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Trouver les candidats inactifs
    // Statuts exclus : SIGNED (converti), REJECTED (abandonné), WITHDRAWN (désistement)
    const inactiveCandidates = await prisma.franchiseCandidate.findMany({
        where: {
            status: {
                notIn: ['SIGNED', 'REJECTED', 'WITHDRAWN']
            },
            updatedAt: {
                lt: sevenDaysAgo
            },
            motivationIndex: {
                gt: 0 // Inutile de baisser si déjà à 0
            }
        },
        select: {
            id: true,
            companyName: true,
            motivationIndex: true,
            updatedAt: true
        }
    });

    console.log(`[Motivation Decay] Recherche de candidats inactifs... Trouvés : ${inactiveCandidates.length}`);

    const results = [];

    for (const candidate of inactiveCandidates) {
        const currentMotivation = candidate.motivationIndex || 0;
        const newMotivation = Math.max(0, currentMotivation - 10);

        // 2. Mettre à jour le candidat
        await prisma.franchiseCandidate.update({
            where: { id: candidate.id },
            data: {
                motivationIndex: newMotivation,
                // On ne touche pas à updatedAt ici pour éviter de reset le timer de 7 jours
                // Mais Prisma le mettra à jour par défaut. 
                // Pour éviter ça, on pourrait utiliser un raw query ou accepter ce comportement 
                // (le candidat aura 7 jours de répit après chaque dégradation).
            }
        });

        // 3. Logger l'action dans le journal d'activité
        await prisma.candidateActivity.create({
            data: {
                candidateId: candidate.id,
                type: 'SYSTEM_ALERT',
                description: `📉 Motivation Decay : -10 points pour inactivité (> 7 jours). Nouveau score : ${newMotivation}%`,
                metadata: {
                    oldMotivation: currentMotivation,
                    newMotivation: newMotivation,
                    reason: 'INACTIVITY_TIMEOUT'
                }
            }
        });

        results.push({
            id: candidate.id,
            company: candidate.companyName,
            old: currentMotivation,
            new: newMotivation
        });
    }

    return {
        processed: inactiveCandidates.length,
        details: results
    };
}

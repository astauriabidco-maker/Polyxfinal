/**
 * DISPATCH LEAD — Hub & Spoke Engine
 * ====================================
 * Distribue automatiquement les dossiers (leads) du Siège
 * vers les franchisés selon leur zone géographique.
 * 
 * Algorithme:
 * 1. Le dossier arrive au HEAD_OFFICE
 * 2. On scanne les Territory des enfants
 * 3. Si match CP → transfert au franchisé
 * 4. Sinon → reste au siège (PENDING_ASSIGNMENT)
 */

import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────

interface DispatchResult {
    matched: boolean;
    dossierId: string;
    /** Org de destination (franchisé ou siège si pas de match) */
    targetOrgId: string;
    targetOrgName: string;
    /** Territoire trouvé (null si pas de match) */
    territoryId?: string;
    territoryName?: string;
}

// ─── Fonction Principale ──────────────────────────────────────

/**
 * Dispatche un dossier du siège vers le franchisé approprié
 * basé sur le code postal du stagiaire.
 */
export async function dispatchLead(
    dossierId: string,
    studentZipCode: string
): Promise<DispatchResult> {
    // 1. Charger le dossier avec son organisation
    const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    networkType: true,
                },
            },
        },
    });

    if (!dossier) {
        throw new Error(`Dossier introuvable: ${dossierId}`);
    }

    // 2. Vérifier que le dossier est au HEAD_OFFICE
    if (dossier.organization.networkType !== 'HEAD_OFFICE') {
        throw new Error(
            `Le dispatching ne peut s'appliquer que depuis un HEAD_OFFICE (actuel: ${dossier.organization.networkType})`
        );
    }

    const headOfficeId = dossier.organization.id;

    // 3. Chercher les territoires des enfants (franchisés) qui couvrent ce CP
    const matchingTerritories = await prisma.territory.findMany({
        where: {
            isActive: true,
            zipCodes: { has: studentZipCode },
            organization: {
                parentId: headOfficeId,
                isActive: true,
                networkType: { in: ['FRANCHISE', 'SUCCURSALE'] },
            },
        },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    networkType: true,
                },
            },
        },
        // Prendre le premier match (priorité au premier territoire trouvé)
        take: 1,
    });

    // 4. Si match trouvé → transférer
    if (matchingTerritories.length > 0) {
        const territory = matchingTerritories[0];
        const targetOrg = territory.organization;

        await prisma.$transaction(async (tx) => {
            // Transférer le dossier
            await tx.dossier.update({
                where: { id: dossierId },
                data: {
                    organizationId: targetOrg.id,
                    source: 'NETWORK_DISPATCH',
                    dispatchedAt: new Date(),
                    dispatchedFromId: headOfficeId,
                    stagiaireCp: studentZipCode,
                    originalLeadDate: dossier.createdAt,
                },
            });

            // Audit Log
            await tx.auditLog.create({
                data: {
                    organizationId: headOfficeId,
                    userId: dossier.createdById,
                    userRole: 'ADMIN',
                    action: 'DISPATCH_LEAD',
                    niveauAction: 'EDITION',
                    entityType: 'Dossier',
                    entityId: dossierId,
                    newState: {
                        from: headOfficeId,
                        to: targetOrg.id,
                        toName: targetOrg.name,
                        zipCode: studentZipCode,
                        territoryId: territory.id,
                        territoryName: territory.name,
                    },
                },
            });
        });

        console.log(
            `[Dispatch] ✅ Dossier ${dossierId} transféré: ${dossier.organization.name} → ${targetOrg.name} (CP: ${studentZipCode})`
        );

        return {
            matched: true,
            dossierId,
            targetOrgId: targetOrg.id,
            targetOrgName: targetOrg.name,
            territoryId: territory.id,
            territoryName: territory.name,
        };
    }

    // 5. Pas de match → reste au siège, marquer comme PENDING
    await prisma.dossier.update({
        where: { id: dossierId },
        data: {
            stagiaireCp: studentZipCode,
            originalLeadDate: dossier.createdAt,
        },
    });

    console.log(
        `[Dispatch] ⚠️ Dossier ${dossierId} sans match territorial (CP: ${studentZipCode}) — reste au siège`
    );

    return {
        matched: false,
        dossierId,
        targetOrgId: headOfficeId,
        targetOrgName: dossier.organization.name,
    };
}

// ─── Dispatch en masse ────────────────────────────────────────

/**
 * Dispatche tous les dossiers non-assignés d'un HEAD_OFFICE
 * qui ont un stagiaireCp renseigné.
 */
export async function dispatchAllPendingLeads(
    headOfficeId: string
): Promise<DispatchResult[]> {
    const pendingDossiers = await prisma.dossier.findMany({
        where: {
            organizationId: headOfficeId,
            source: 'ORGANIC',
            dispatchedAt: null,
            stagiaireCp: { not: null },
            organization: {
                networkType: 'HEAD_OFFICE',
            },
        },
        select: {
            id: true,
            stagiaireCp: true,
        },
    });

    const results: DispatchResult[] = [];

    for (const dossier of pendingDossiers) {
        if (dossier.stagiaireCp) {
            const result = await dispatchLead(dossier.id, dossier.stagiaireCp);
            results.push(result);
        }
    }

    console.log(
        `[Dispatch] Batch terminé: ${results.filter((r) => r.matched).length}/${results.length} matchés`
    );

    return results;
}

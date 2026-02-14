/**
 * DISPATCH LEAD — Hub & Spoke Engine
 * ====================================
 * Distribue automatiquement les dossiers (leads) du Siège
 * vers les franchisés selon leur zone géographique.
 * 
 * RÈGLE NDA :
 *   Le dossier RESTE rattaché au HEAD_OFFICE (organizationId inchangé)
 *   car c'est lui qui porte le NDA. Le dispatch ne change que le `siteId`
 *   pour pointer vers le site de l'agence franchisée.
 * 
 * Algorithme:
 * 1. Le dossier arrive au HEAD_OFFICE
 * 2. On scanne les Territory des enfants (franchisés)
 * 3. Si match CP → assigne le siteId du franchisé
 * 4. Sinon → reste au siège (PENDING_ASSIGNMENT)
 */

import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────

interface DispatchResult {
    matched: boolean;
    dossierId: string;
    /** Org HEAD_OFFICE (inchangée — porteur du NDA) */
    headOfficeId: string;
    headOfficeName: string;
    /** Franchise de destination (null si pas de match) */
    targetFranchiseId?: string;
    targetFranchiseName?: string;
    /** Site assigné dans la franchise */
    targetSiteId?: string;
    targetSiteName?: string;
    /** Territoire trouvé (null si pas de match) */
    territoryId?: string;
    territoryName?: string;
}

// ─── Fonction Principale ──────────────────────────────────────

/**
 * Dispatche un dossier du siège vers le franchisé approprié
 * basé sur le code postal du stagiaire.
 * 
 * IMPORTANT : Le dossier reste rattaché au HEAD_OFFICE (organizationId).
 * Seul le siteId est changé vers un site de la franchise.
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
    const headOfficeName = dossier.organization.name;

    // 3. Chercher les territoires des enfants (franchisés) qui couvrent ce CP
    //    + charger les sites de la franchise pour le siteId
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
                    sites: {
                        where: { isActive: true },
                        orderBy: { isHeadquarters: 'desc' },
                        take: 1,
                        select: { id: true, name: true },
                    },
                },
            },
        },
        take: 1,
    });

    // 4. Si match trouvé → assigner le site de la franchise
    if (matchingTerritories.length > 0) {
        const territory = matchingTerritories[0];
        const targetOrg = territory.organization;
        const targetSite = targetOrg.sites[0];

        if (!targetSite) {
            console.warn(
                `[Dispatch] ⚠️ Franchise "${targetOrg.name}" n'a pas de site actif — dossier reste au siège`
            );
            return {
                matched: false,
                dossierId,
                headOfficeId,
                headOfficeName,
            };
        }

        await prisma.$transaction(async (tx) => {
            // Dispatch : changer le siteId (PAS l'organizationId !)
            // Le dossier reste sous le HEAD_OFFICE qui porte le NDA
            await tx.dossier.update({
                where: { id: dossierId },
                data: {
                    siteId: targetSite.id,
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
                        headOfficeId,
                        franchiseId: targetOrg.id,
                        franchiseName: targetOrg.name,
                        siteId: targetSite.id,
                        siteName: targetSite.name,
                        zipCode: studentZipCode,
                        territoryId: territory.id,
                        territoryName: territory.name,
                    },
                },
            });
        });

        console.log(
            `[Dispatch] ✅ Dossier ${dossierId} dispatché: site "${targetSite.name}" (${targetOrg.name}) — CP: ${studentZipCode} — Org reste: ${headOfficeName}`
        );

        return {
            matched: true,
            dossierId,
            headOfficeId,
            headOfficeName,
            targetFranchiseId: targetOrg.id,
            targetFranchiseName: targetOrg.name,
            targetSiteId: targetSite.id,
            targetSiteName: targetSite.name,
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
        headOfficeId,
        headOfficeName,
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

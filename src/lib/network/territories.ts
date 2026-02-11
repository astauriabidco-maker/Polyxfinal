import { prisma } from '@/lib/prisma';

export interface TerritoryConflict {
    organizationId: string;
    organizationName: string;
    overlappingZipCodes: string[];
}

/**
 * Vérifie si les codes postaux donnés chevauchent des territoires déjà attribués.
 */
export async function checkTerritoryConflicts(zipCodes: string[]): Promise<TerritoryConflict[]> {
    if (!zipCodes || zipCodes.length === 0) return [];

    // 1. Récupérer tous les territoires actifs avec leurs organisations
    const existingTerritories = await prisma.territory.findMany({
        where: { isActive: true },
        include: { organization: { select: { name: true } } }
    });

    const conflicts: TerritoryConflict[] = [];

    // 2. Chercher les intersections
    for (const territory of existingTerritories) {
        const intersection = territory.zipCodes.filter(cp => zipCodes.includes(cp));

        if (intersection.length > 0) {
            conflicts.push({
                organizationId: territory.organizationId,
                organizationName: territory.organization.name,
                overlappingZipCodes: intersection
            });
        }
    }

    return conflicts;
}

/**
 * Vérifie si une zone (un ou plusieurs codes postaux) est disponible.
 */
export async function isZoneAvailable(zipCodes: string[]): Promise<boolean> {
    const conflicts = await checkTerritoryConflicts(zipCodes);
    return conflicts.length === 0;
}

/**
 * PORTFOLIO SERVICE - Agrégation Multi-Org
 * =========================================
 * Service pour la Vue "Tour de Contrôle" Portfolio.
 * Agrège les métriques de toutes les organisations d'un utilisateur.
 */

import { prisma } from '@/lib/prisma';
import { MembershipScope, Role, PhaseStatus } from '@prisma/client';

export interface PortfolioItem {
    organizationId: string;
    organizationName: string;
    organizationType: string;
    role: Role;
    scope: MembershipScope;
    dossiersEnCours: number;
    dossiersTotal: number;
    alertesBloquantes: number;
    lastAccessedAt: Date;
}

/**
 * Récupère les statistiques Portfolio pour un utilisateur multi-org.
 * Pour chaque organisation, calcule les dossiers en cours et alertes bloquantes.
 */
export async function getUserPortfolioStats(userId: string): Promise<PortfolioItem[]> {
    // 1. Récupérer tous les memberships actifs avec relations
    const memberships = await prisma.membership.findMany({
        where: {
            userId,
            isActive: true,
            organization: { isActive: true },
        },
        include: {
            organization: true,
            siteAccess: {
                select: { siteId: true },
            },
        },
        orderBy: { lastAccessedAt: 'desc' },
    });

    // 2. Pour chaque membership, calculer les métriques
    const portfolioItems: PortfolioItem[] = await Promise.all(
        memberships.map(async (membership) => {
            const orgId = membership.organizationId;

            // Construire la clause WHERE selon le scope
            const siteIds = membership.siteAccess.map((sa) => sa.siteId);
            const siteFilter =
                membership.scope === MembershipScope.RESTRICTED && siteIds.length > 0
                    ? { siteId: { in: siteIds } }
                    : {};

            // Requêtes parallèles pour les métriques
            const [dossiersEnCours, dossiersTotal, alertesBloquantes] = await Promise.all([
                // Dossiers EN_COURS
                prisma.dossier.count({
                    where: {
                        organizationId: orgId,
                        status: PhaseStatus.ACTIF,
                        ...siteFilter,
                    },
                }),
                // Dossiers Total (tous statuts)
                prisma.dossier.count({
                    where: {
                        organizationId: orgId,
                        ...siteFilter,
                    },
                }),
                // Alertes bloquantes non résolues
                prisma.complianceAlert.count({
                    where: {
                        dossier: {
                            organizationId: orgId,
                            ...siteFilter,
                        },
                        severity: 'BLOCKING',
                        isResolved: false,
                    },
                }),
            ]);

            return {
                organizationId: orgId,
                organizationName: membership.organization.name,
                organizationType: membership.organization.type,
                role: membership.role,
                scope: membership.scope,
                dossiersEnCours,
                dossiersTotal,
                alertesBloquantes,
                lastAccessedAt: membership.lastAccessedAt,
            };
        })
    );

    return portfolioItems;
}

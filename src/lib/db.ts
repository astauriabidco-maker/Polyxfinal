/**
 * TENANT GUARD - Isolation des données SaaS
 * ==========================================
 * Utilités pour requêtes Prisma scopées par organisation.
 * Empêche les fuites de données entre tenants.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { OrganizationType } from '@prisma/client';

/**
 * Récupère l'ID de l'organisation de l'utilisateur connecté
 * @throws Error si pas de session ou pas d'organisation
 */
export async function getCurrentOrgId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.organizationId) {
        throw new Error('No organization context - user must be authenticated');
    }
    return session.user.organizationId;
}

/**
 * Récupère le type de l'organisation (OF_STANDARD, CFA, BILAN, VAE)
 */
export async function getCurrentOrgType(): Promise<OrganizationType> {
    const session = await auth();
    if (!session?.user?.organizationType) {
        throw new Error('No organization type in session');
    }
    return session.user.organizationType;
}

/**
 * Récupère les informations complètes de l'organisation
 */
export async function getCurrentOrg() {
    const orgId = await getCurrentOrgId();
    return prisma.organization.findUnique({
        where: { id: orgId },
    });
}

/**
 * Helper pour exécuter une requête avec le contexte tenant
 * @example
 * const dossiers = await withTenant((orgId) => 
 *   prisma.dossier.findMany({ where: { organizationId: orgId } })
 * );
 */
export async function withTenant<T>(
    query: (organizationId: string) => Promise<T>
): Promise<T> {
    const orgId = await getCurrentOrgId();
    return query(orgId);
}

/**
 * Vérifie qu'une entité appartient bien au tenant courant
 * @throws Error si l'entité n'appartient pas au tenant
 */
export async function assertTenantOwnership(
    entityOrgId: string,
    entityType: string = 'entity'
): Promise<void> {
    const currentOrgId = await getCurrentOrgId();
    if (entityOrgId !== currentOrgId) {
        console.error(`[TenantGuard] Access denied: ${entityType} belongs to org ${entityOrgId}, user is in org ${currentOrgId}`);
        throw new Error('Access denied: resource belongs to another organization');
    }
}

// Export prisma for convenience
export { prisma };

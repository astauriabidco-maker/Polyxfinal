/**
 * ACCESS HELPER - Granular Site Access Control
 * =============================================
 * Provides utility functions for site-based access filtering.
 */

import { prisma } from '@/lib/prisma';
import { MembershipScope } from '@prisma/client';

/**
 * Get the list of site IDs a user can access within an organization.
 * 
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @returns null if GLOBAL (no filtering needed), or array of site IDs if RESTRICTED
 */
export async function getUserSiteIds(
    userId: string,
    orgId: string
): Promise<string[] | null> {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId: orgId,
            },
        },
        select: {
            scope: true,
            siteAccess: {
                select: {
                    siteId: true,
                },
            },
        },
    });

    if (!membership) {
        console.warn(`[Access] No membership found for user ${userId} in org ${orgId}`);
        return []; // No membership = no access
    }

    // GLOBAL scope = access to all sites (no filtering)
    if (membership.scope === MembershipScope.GLOBAL) {
        return null;
    }

    // RESTRICTED scope = only specific sites
    return membership.siteAccess.map((sa) => sa.siteId);
}

/**
 * Build a Prisma where clause with site filtering.
 * 
 * @param organizationId - Required org filter
 * @param allowedSiteIds - null for GLOBAL, array for RESTRICTED
 * @returns Where clause object
 */
export function buildSiteFilteredWhereClause(
    organizationId: string,
    allowedSiteIds: string[] | null
): { organizationId: string; siteId?: { in: string[] } } {
    return {
        organizationId,
        ...(allowedSiteIds !== null ? { siteId: { in: allowedSiteIds } } : {}),
    };
}

/**
 * Check if a user has access to a specific site.
 * 
 * @param userId - The user's ID
 * @param orgId - The organization's ID
 * @param siteId - The site to check access for
 * @returns true if access is granted
 */
export async function canAccessSite(
    userId: string,
    orgId: string,
    siteId: string
): Promise<boolean> {
    const allowedSites = await getUserSiteIds(userId, orgId);

    // GLOBAL = all access
    if (allowedSites === null) {
        return true;
    }

    // RESTRICTED = check if site is in list
    return allowedSites.includes(siteId);
}

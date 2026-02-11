'use server';

/**
 * UTILS — Franchise Network Session Helper
 * =========================================
 * Resolves a valid organizationId from the session,
 * handling stale JWT tokens after DB reseed.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

type OrgResult =
    | { organizationId: string; error: null }
    | { organizationId: null; error: string };

export async function resolveOrganizationId(): Promise<OrgResult> {
    const session = await auth();
    if (!session?.user?.organizationId) {
        return { organizationId: null, error: 'Non authentifié' };
    }

    // Fast path: session org exists
    const orgExists = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { id: true },
    });

    if (orgExists) {
        return { organizationId: session.user.organizationId, error: null };
    }

    // Fallback 1: membership by user ID
    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
        orderBy: { createdAt: 'asc' },
    });

    if (membership) {
        return { organizationId: membership.organizationId, error: null };
    }

    // Fallback 2: lookup user by email (handles post-reseed stale JWT)
    if (session.user.email) {
        const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { memberships: { select: { organizationId: true }, take: 1 } },
        });
        if (dbUser?.memberships?.[0]) {
            return { organizationId: dbUser.memberships[0].organizationId, error: null };
        }
    }

    return { organizationId: null, error: 'Aucune organisation associée. Reconnectez-vous.' };
}

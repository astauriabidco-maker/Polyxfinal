'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Server Action pour changer d'organisation (Tenant Switching)
 * Met à jour le lastAccessedAt du membership sélectionné
 */
export async function switchOrganization(targetOrgId: string) {
    const session = await auth();

    if (!session?.user?.id) {
        return { success: false, error: 'Non authentifié' };
    }

    const userId = session.user.id;

    try {
        // Vérifier que l'utilisateur a un membership actif vers cette org
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: targetOrgId,
                },
            },
            include: {
                organization: true,
            },
        });

        if (!membership || !membership.isActive) {
            return { success: false, error: 'Membership non trouvé ou inactif' };
        }

        if (!membership.organization.isActive) {
            return { success: false, error: 'Organisation inactive' };
        }

        // Mettre à jour lastAccessedAt pour ce membership
        await prisma.membership.update({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: targetOrgId,
                },
            },
            data: {
                lastAccessedAt: new Date(),
            },
        });

        console.log(`[Auth] Organization switched: ${session.user.email} -> ${membership.organization.name}`);

        // Revalider les pages pour forcer un refresh
        revalidatePath('/dashboard');
        revalidatePath('/');

        return {
            success: true,
            organizationId: targetOrgId,
            organizationName: membership.organization.name,
        };
    } catch (error) {
        console.error('[Auth] Error switching organization:', error);
        return { success: false, error: 'Erreur lors du changement d\'organisation' };
    }
}

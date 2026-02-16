/**
 * RBAC Utilities — Permission-based access control
 * ==================================================
 * Utilitaires pour vérifier les permissions réelles d'un utilisateur
 * via les RolePermission en base, au-delà du simple check role.code.
 */

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Vérifie si un utilisateur a une permission spécifique dans une organisation.
 * 
 * @param userId - ID de l'utilisateur
 * @param organizationId - ID de l'organisation
 * @param permissionCode - Code de la permission (ex: "dossier:create", "org:read")
 * @returns true si l'utilisateur a cette permission
 * 
 * @example
 * const canCreate = await hasPermission(userId, orgId, 'dossier:create');
 */
export async function hasPermission(
    userId: string,
    organizationId: string,
    permissionCode: string
): Promise<boolean> {
    const count = await prisma.rolePermission.count({
        where: {
            permission: { code: permissionCode },
            role: {
                memberships: {
                    some: { userId, organizationId },
                },
            },
        },
    });
    return count > 0;
}

/**
 * Vérifie une permission et retourne une Response 403 si non autorisé.
 * Utilitaire pour les route handlers.
 * 
 * @returns null si OK, NextResponse 403 si non autorisé
 * 
 * @example
 * const denied = await requirePermission(userId, orgId, 'site:create');
 * if (denied) return denied;
 */
export async function requirePermission(
    userId: string,
    organizationId: string,
    permissionCode: string
): Promise<NextResponse | null> {
    const allowed = await hasPermission(userId, organizationId, permissionCode);
    if (!allowed) {
        return NextResponse.json(
            { error: `Permission requise: ${permissionCode}` },
            { status: 403 }
        );
    }
    return null;
}

/**
 * Vérifie si un utilisateur est ADMIN d'une organisation.
 * Combine le check par code de rôle (existant) ET par permission.
 * 
 * Un utilisateur est considéré admin si :
 * - Son rôle a le code 'ADMIN', OU
 * - Son rôle a la permission explicite 'org:admin'
 * 
 * @returns true si l'utilisateur est admin
 */
export async function isOrgAdmin(
    userId: string,
    organizationId: string
): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: { userId, organizationId },
        },
        include: { role: true },
    });

    if (!membership) return false;

    // Check par code de rôle (backward compat)
    if (membership.role.code === 'ADMIN') return true;

    // Check par permission explicite
    return hasPermission(userId, organizationId, 'org:admin');
}

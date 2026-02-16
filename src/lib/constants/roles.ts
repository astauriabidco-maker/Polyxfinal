/**
 * ROLE UTILITIES — Dynamic role ID resolution
 * =============================================
 * Remplace les ROLE_IDS hardcodés par un lookup DB dynamique.
 */

import { prisma } from '@/lib/prisma';

// Cache in-memory pour éviter des requêtes répétitives (reset au restart)
const roleIdCache = new Map<string, string>();

/**
 * Résout l'ID d'un rôle système par son code.
 * Utilise un cache in-memory pour éviter les requêtes répétitives.
 */
export async function getSystemRoleId(code: string): Promise<string> {
    // Vérifier le cache
    const cached = roleIdCache.get(code);
    if (cached) return cached;

    const role = await prisma.role.findFirst({
        where: { code, isSystem: true },
        select: { id: true },
    });

    if (!role) {
        throw new Error(`[RBAC] Rôle système "${code}" introuvable en base. Vérifiez le seed.`);
    }

    roleIdCache.set(code, role.id);
    return role.id;
}

/**
 * Constantes de codes de rôles — pour usage typesafe sans IDs.
 */
export const ROLE_CODES = {
    ADMIN: 'ADMIN',
    RESP_PEDAGO: 'RESP_PEDAGO',
    RESP_ADMIN: 'RESP_ADMIN',
    REF_QUALITE: 'REF_QUALITE',
    FORMAT: 'FORMAT',
} as const;

export type SystemRoleCode = keyof typeof ROLE_CODES;

/**
 * @deprecated Utilisez getSystemRoleId() dans le runtime.
 * Conservé uniquement pour le seed et les scripts utilitaires.
 */
export const ROLE_IDS = {
    ADMIN: 'cm6e5bx4s0002v6u0q0j3k8p9',
    RESP_PEDAGO: 'cm6e5bx4s0003v6u0r1k4l9q0',
    RESP_ADMIN: 'cm6e5bx4s0004v6u0s2l5m0r1',
    REF_QUALITE: 'cm6e5bx4s0005v6u0t3m6n1s2',
    FORMAT: 'cm6e5bx4s0006v6u0u4n7o2t3',
} as const;

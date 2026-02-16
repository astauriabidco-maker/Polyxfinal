/**
 * AUTH TYPES - Extension des types NextAuth
 * ==========================================
 * Multi-Tenant + Multi-Membership + Granular Access Architecture.
 * Un utilisateur peut appartenir à plusieurs organisations avec accès à plusieurs sites.
 */

import { OrganizationType, MembershipScope } from '@prisma/client';
import { SystemRoleCode } from '@/lib/constants/roles';

// Type pour un site accessible
export interface AccessibleSite {
    id: string;
    name: string;
}

/**
 * Shape réelle du rôle tel qu'il arrive depuis le JOIN Prisma
 * (membership → role relation). Remplace l'ancien `Role` enum.
 */
export interface RoleInfo {
    id: string;
    code: string;
    name: string;
}

// Type pour un membership dans la session
export interface MembershipInfo {
    organizationId: string;
    organizationName: string;
    organizationType: OrganizationType;
    role: RoleInfo;
    scope: MembershipScope;
    siteName?: string | null;
    accessibleSites: AccessibleSite[];
}

// Extension du module next-auth
declare module 'next-auth' {
    interface User {
        id: string;
        nom: string;
        prenom: string;
        // Current membership context
        currentMembershipId: string;
        role: RoleInfo;
        organizationId: string;
        organizationType: OrganizationType;
        organizationName: string;
        scope: MembershipScope;
        siteName?: string | null;
        // All memberships for switcher
        memberships: MembershipInfo[];
        // Force password change
        mustChangePassword?: boolean;
    }

    interface Session {
        user: {
            id: string;
            email: string;
            nom: string;
            prenom: string;
            // Current membership context
            currentMembershipId: string;
            role: RoleInfo;
            organizationId: string;
            organizationType: OrganizationType;
            organizationName: string;
            scope: MembershipScope;
            siteName?: string | null;
            // All memberships for switcher
            memberships: MembershipInfo[];
            // Force password change
            mustChangePassword?: boolean;
        };
    }
}

declare module '@auth/core/jwt' {
    interface JWT {
        id: string;
        nom: string;
        prenom: string;
        // Current membership context
        currentMembershipId: string;
        role: RoleInfo;
        organizationId: string;
        organizationType: OrganizationType;
        organizationName: string;
        scope: MembershipScope;
        siteName?: string | null;
        // All memberships for switcher
        memberships: MembershipInfo[];
        // Force password change
        mustChangePassword?: boolean;
    }
}

// Types RBAC pour le middleware
export type RBACLevel = 'LECTURE' | 'EDITION' | 'VALIDATION' | 'FORCAGE';

export interface RBACPermission {
    roles: SystemRoleCode[];
    level: RBACLevel;
}

// Mapping des transitions vers les rôles autorisés (basé sur rbac_matrix.md)
export const TRANSITION_PERMISSIONS: Record<string, SystemRoleCode[]> = {
    // PHASE 2: ADMISSION
    'TO_ADMIS': ['RESP_PEDAGO', 'ADMIN'], // Valider admission
    'FORCE_ADMISSION': ['RESP_PEDAGO', 'ADMIN'], // Forcer admission

    // PHASE 3: CONTRACTUALISATION
    'TO_CONTRACTUALISE': ['RESP_ADMIN', 'ADMIN'], // Valider financement
    'GENERATE_CONTRAT': ['RESP_ADMIN', 'ADMIN'], // Générer contrat

    // PHASE 4: DÉROULEMENT
    'SAISIR_ASSIDUITE': ['FORMAT', 'RESP_ADMIN', 'ADMIN'], // Saisir assiduité
    'SIGNALER_DECROCHAGE': ['FORMAT'], // Signaler décrochage
    'VALIDER_ABANDON': ['RESP_PEDAGO', 'RESP_ADMIN', 'ADMIN'], // Valider abandon

    // PHASE 5: CLÔTURE
    'TO_CLOTURE': ['RESP_PEDAGO', 'ADMIN'], // Valider certificat
    'DEBLOQUER_FACTURATION': ['RESP_ADMIN', 'ADMIN'], // Débloquer facturation

    // ACTIONS GÉNÉRIQUES
    'VIEW': ['ADMIN', 'RESP_PEDAGO', 'RESP_ADMIN', 'REF_QUALITE', 'FORMAT'],
    'EDIT': ['ADMIN', 'RESP_PEDAGO', 'RESP_ADMIN'],
};

/**
 * Vérifie si un rôle peut effectuer une action
 */
export function canPerformAction(role: RoleInfo, action: string): boolean {
    const allowedRoles = TRANSITION_PERMISSIONS[action];
    if (!allowedRoles) {
        // Action non définie = Admin only
        return role.code === 'ADMIN';
    }
    // Check if role.code is in allowedRoles (casted to string for safety)
    return allowedRoles.includes(role.code as SystemRoleCode);
}

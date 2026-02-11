/**
 * WORKFLOW SERVER ACTIONS
 * =======================
 * Actions sécurisées pour les transitions d'état des dossiers.
 * 
 * Chaque transition est :
 * 1. Authentifiée via NextAuth v5 session
 * 2. Autorisée selon RBAC (rbac_matrix.md)
 * 3. Validée par le moteur de conformité
 * 4. Auditée dans la table AuditLog (WORM)
 */
'use server';

import { revalidatePath } from 'next/cache';
import { PhaseStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { validateStateChange } from '@/lib/compliance/engine';
import { auth } from '@/auth';
import { canPerformAction } from '@/lib/auth/types';

// Mapping des transitions valides
const NEXT_STATUS_MAP: Record<string, PhaseStatus> = {
    'BROUILLON': 'EN_ATTENTE_VALIDATION',
    'EN_ATTENTE_VALIDATION': 'ACTIF',
    'ACTIF': 'CLOTURE',
    'SUSPENDU': 'ACTIF',
    'CLOTURE': 'CLOTURE', // État final
};

// Mapping des transitions vers les actions RBAC
const TRANSITION_ACTION_MAP: Record<string, string> = {
    'ADMIS': 'TO_ADMIS',
    'CONTRACTUALISE': 'TO_CONTRACTUALISE',
    'ACTIF': 'VIEW', // Action générique
    'CLOTURE': 'TO_CLOTURE',
    'ABANDONNE': 'VALIDER_ABANDON',
};

interface PromoteResult {
    success: boolean;
    error?: string;
    newStatus?: string;
}

/**
 * Promouvoir un dossier vers l'étape suivante
 * 
 * @param dossierId - ID du dossier à promouvoir
 * @param targetStatus - Statut cible (optionnel, auto-déterminé si non fourni)
 * @returns Résultat de l'opération
 */
export async function promoteDossier(
    dossierId: string,
    targetStatus?: string
): Promise<PromoteResult> {
    // ========================================
    // 1. AUTHENTIFICATION (NextAuth v5)
    // ========================================
    const session = await auth();

    if (!session?.user) {
        throw new Error('Non authentifié. Veuillez vous connecter.');
    }

    const { id: userId, role: userRole, nom, prenom } = session.user;
    const now = new Date();

    // ========================================
    // 2. RÉCUPÉRER LE DOSSIER
    // ========================================
    const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        select: { id: true, organizationId: true, status: true, stagiaireNom: true, stagiairePrenom: true },
    });

    if (!dossier) {
        throw new Error(`Dossier introuvable: ${dossierId}`);
    }

    const currentStatus = dossier.status;
    const nextStatus = (targetStatus as PhaseStatus) || NEXT_STATUS_MAP[currentStatus];

    if (!nextStatus) {
        throw new Error(`Aucune transition définie depuis ${currentStatus}`);
    }

    // ========================================
    // 3. VÉRIFICATION RBAC (CRITIQUE!)
    // ========================================
    const requiredAction = TRANSITION_ACTION_MAP[nextStatus] || 'VIEW';

    if (!canPerformAction(userRole as Role, requiredAction)) {
        console.log(`[RBAC] ACCÈS REFUSÉ: ${userRole} ne peut pas effectuer ${requiredAction}`);
        throw new Error(
            `Accès refusé. Le rôle ${userRole} n'est pas autorisé à effectuer cette action.`
        );
    }

    // ========================================
    // 4. VALIDATION CONFORMITÉ (OBLIGATOIRE)
    // ========================================
    const validation = await validateStateChange(dossierId, nextStatus);

    if (validation.errors.length > 0) {
        // Transaction bloquée par le moteur de règles
        throw new Error(
            `Transition bloquée: ${validation.errors.join(', ')}`
        );
    }

    // ========================================
    // 5. MISE À JOUR DU STATUT
    // ========================================
    await prisma.dossier.update({
        where: { id: dossierId },
        data: {
            status: nextStatus,
            updatedAt: now,
        },
    });

    // ========================================
    // 6. CRÉATION ENTRÉE AUDITLOG (WORM)
    // ========================================
    await prisma.auditLog.create({
        data: {
            organizationId: dossier.organizationId,
            entityType: 'Dossier',
            entityId: dossierId,
            action: 'STATUS_CHANGE',
            userId: userId,
            userRole: userRole as Role,
            niveauAction: 'VALIDATION',
            newState: {
                from: currentStatus,
                to: nextStatus,
                stagiaire: `${dossier.stagiairePrenom} ${dossier.stagiaireNom}`,
                validationWarnings: validation.warnings,
                performedBy: `${prenom} ${nom}`,
            },
            ipAddress: '127.0.0.1',
        },
    });

    console.log(`[Audit] ${prenom} ${nom} (${userRole}): Dossier ${dossierId} ${currentStatus} → ${nextStatus}`);

    // ========================================
    // 7. REVALIDATION DU CACHE
    // ========================================
    revalidatePath('/dashboard');

    return {
        success: true,
        newStatus: nextStatus,
    };
}

/**
 * Obtenir le prochain statut possible pour un dossier
 */
export async function getNextStatus(currentStatus: string): Promise<string | null> {
    return NEXT_STATUS_MAP[currentStatus] || null;
}


/**
 * ONBOARD FRANCHISEE — Server Action
 * ====================================
 * Transforme un candidat franchise signé en tenant opérationnel.
 * 
 * Flow:
 * 1. Valide le candidat (status = SIGNED)
 * 2. Crée l'Organization (FRANCHISE, liée au parent)
 * 3. Crée un Site siège pour le franchisé
 * 4. Crée l'admin User + Membership
 * 5. Crée le Territory à partir des zipCodes
 * 6. Met à jour le candidat (createdOrgId)
 * 7. Log dans AuditLog
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import type { Organization } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────

interface OnboardResult {
    success: boolean;
    organization?: Organization;
    error?: string;
}

interface OnboardInput {
    candidateId: string;
    /** Mot de passe initial de l'admin franchisé */
    adminPassword: string;
    /** SIRET du nouvel organisme */
    siret: string;
    /** Ville du siège */
    city: string;
    /** Code postal du siège */
    zipCode: string;
    /** Adresse du siège */
    address?: string;
}

// ─── Action Principale ───────────────────────────────────────

export async function onboardFranchisee(input: OnboardInput): Promise<OnboardResult> {
    const { candidateId, adminPassword, siret, city, zipCode, address } = input;

    try {
        // 1. Charger et valider le candidat
        const candidate = await prisma.franchiseCandidate.findUnique({
            where: { id: candidateId },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        royaltyRate: true,
                        leadFeeRate: true,
                    },
                },
            },
        });

        if (!candidate) {
            return { success: false, error: 'Candidat introuvable' };
        }

        if (candidate.status !== 'SIGNED') {
            return { success: false, error: `Le candidat doit être en statut SIGNED (actuellement: ${candidate.status})` };
        }

        if (candidate.createdOrgId) {
            return { success: false, error: 'Ce candidat a déjà été onboardé' };
        }

        const parentOrg = candidate.organization;

        // 2. Transaction atomique : tout ou rien
        const result = await prisma.$transaction(async (tx) => {
            // 2a. Créer la nouvelle Organisation (FRANCHISE)
            const newOrg = await tx.organization.create({
                data: {
                    name: `Franchise ${candidate.name}`,
                    siret,
                    type: parentOrg.type,
                    networkType: 'FRANCHISE',
                    parentId: parentOrg.id,
                    royaltyRate: parentOrg.royaltyRate ?? 5.0,
                    leadFeeRate: parentOrg.leadFeeRate ?? 15.0,
                    isActive: true,
                },
            });

            // 2b. Créer le site siège du franchisé
            await tx.site.create({
                data: {
                    organizationId: newOrg.id,
                    name: `Siège ${candidate.name}`,
                    city,
                    zipCode,
                    address,
                    isHeadquarters: true,
                },
            });

            // 2c. Créer l'admin du franchisé
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const adminUser = await tx.user.create({
                data: {
                    email: candidate.email,
                    nom: candidate.name || candidate.representantNom,
                    prenom: candidate.representantPrenom || 'Admin',
                    passwordHash: hashedPassword,
                    isActive: true,
                },
            });

            // 2d. Créer le Membership ADMIN GLOBAL
            await tx.membership.create({
                data: {
                    userId: adminUser.id,
                    organizationId: newOrg.id,
                    role: 'ADMIN',
                    scope: 'GLOBAL',
                    isActive: true,
                },
            });

            // 2e. Créer le Territory si zipCodes définis
            if (candidate.targetZipCodes.length > 0) {
                await tx.territory.create({
                    data: {
                        organizationId: newOrg.id,
                        name: candidate.targetZone ?? `Zone ${candidate.name}`,
                        zipCodes: candidate.targetZipCodes,
                        isExclusive: true,
                    },
                });
            }

            // 2f. Mettre à jour le candidat
            await tx.franchiseCandidate.update({
                where: { id: candidateId },
                data: {
                    createdOrgId: newOrg.id,
                    contractSignedAt: new Date(),
                },
            });

            // 2g. Audit Log
            await tx.auditLog.create({
                data: {
                    organizationId: parentOrg.id,
                    userId: adminUser.id,
                    userRole: 'ADMIN',
                    action: 'ONBOARD_FRANCHISEE',
                    niveauAction: 'VALIDATION',
                    entityType: 'Organization',
                    entityId: newOrg.id,
                    newState: {
                        candidateId,
                        franchiseOrgId: newOrg.id,
                        franchiseName: newOrg.name,
                        territory: candidate.targetZipCodes,
                    },
                },
            });

            return newOrg;
        });

        return { success: true, organization: result };
    } catch (error) {
        console.error('[Onboard] Error:', error);
        const message = error instanceof Error ? error.message : 'Erreur interne';
        return { success: false, error: message };
    }
}

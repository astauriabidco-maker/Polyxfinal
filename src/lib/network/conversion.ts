import { prisma } from '@/lib/prisma';
import { NetworkType, MembershipScope, OrganizationType } from '@prisma/client';
import { getSystemRoleId } from '@/lib/constants/roles';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Convertit un candidat signé en une organisation (franchise) opérationnelle.
 * Crée également le site principal et le compte admin du franchisé.
 * Génère un mot de passe temporaire que l'admin devra changer à la première connexion.
 */
export async function convertCandidateToFranchise(candidateId: string) {
    return await prisma.$transaction(async (tx) => {
        // 1. Récupérer le candidat
        const candidate = await tx.franchiseCandidate.findUnique({
            where: { id: candidateId },
            include: { organization: true },
        });

        if (!candidate) throw new Error('Candidat introuvable');
        if (candidate.status !== 'SIGNED') throw new Error('Le candidat doit être au statut SIGNED pour être converti.');
        if (candidate.createdOrgId) throw new Error('Ce candidat a déjà été converti en organisation.');

        // 2. Créer l'Organisation (Franchise)
        const newOrg = await tx.organization.create({
            data: {
                name: candidate.companyName,
                siret: candidate.siret || '00000000000000', // SIRET fictif si non renseigné
                type: candidate.franchiseType === 'OF' ? OrganizationType.OF_STANDARD : OrganizationType.CFA,
                networkType: NetworkType.FRANCHISE,
                parentId: candidate.organizationId,
                responsableName: `${candidate.representantPrenom} ${candidate.representantNom}`,
                isActive: true,
            },
        });

        // 3. Créer le Site principal (Headquarters)
        const hqSite = await tx.site.create({
            data: {
                organizationId: newOrg.id,
                name: 'Siège principal',
                isHeadquarters: true,
                address: candidate.targetZone || 'France',
                city: 'À définir',
                zipCode: '00000',
            },
        });

        // 4. Gérer l'Utilisateur Franchisé
        let user = await tx.user.findUnique({
            where: { email: candidate.email },
        });

        let tempPassword: string | null = null;

        if (!user) {
            // Générer un mot de passe temporaire sécurisé
            tempPassword = crypto.randomBytes(6).toString('base64url'); // ~8 chars
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            user = await tx.user.create({
                data: {
                    email: candidate.email,
                    nom: candidate.representantNom,
                    prenom: candidate.representantPrenom,
                    passwordHash: hashedPassword,
                    mustChangePassword: true,
                    isActive: true,
                },
            });
        }

        // 5. Créer le Membership ADMIN sur la nouvelle org
        const adminRoleId = await getSystemRoleId('ADMIN');
        await tx.membership.create({
            data: {
                user: { connect: { id: user.id } },
                organization: { connect: { id: newOrg.id } },
                role: { connect: { id: adminRoleId } },
                scope: MembershipScope.GLOBAL,
                isActive: true,
            },
        });

        // 5-bis. Lier l'admin au site siège
        await tx.membershipSiteAccess.create({
            data: {
                membershipUserId: user.id,
                membershipOrgId: newOrg.id,
                siteId: hqSite.id,
            },
        });

        // 6. Lier l'org au candidat
        await tx.franchiseCandidate.update({
            where: { id: candidateId },
            data: { createdOrgId: newOrg.id },
        });

        // 7. Logger l'activité
        await tx.candidateActivity.create({
            data: {
                candidateId: candidate.id,
                type: 'OTHER',
                description: `Candidat converti en franchise : ${newOrg.name} (Org ID: ${newOrg.id})`,
                metadata: {
                    orgId: newOrg.id,
                    userId: user.id,
                    action: 'CONVERSION_TO_FRANCHISE',
                },
            },
        });

        return {
            success: true,
            orgId: newOrg.id,
            userId: user.id,
            tempPassword, // null si l'utilisateur existait déjà
        };
    });
}


import { prisma } from '@/lib/prisma';
import { NetworkType, Role, MembershipScope, OrganizationType } from '@prisma/client';

/**
 * Convertit un candidat signé en une organisation (franchise) opérationnelle.
 * Crée également le site principal et le compte admin du franchisé.
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
        await tx.site.create({
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
        // On cherche par email. S'il n'existe pas, on le crée.
        let user = await tx.user.findUnique({
            where: { email: candidate.email },
        });

        if (!user) {
            user = await tx.user.create({
                data: {
                    email: candidate.email,
                    nom: candidate.representantNom,
                    prenom: candidate.representantPrenom,
                },
            });
        }

        // 5. Créer le Membership ADMIN sur la nouvelle org
        await tx.membership.create({
            data: {
                userId: user.id,
                organizationId: newOrg.id,
                role: Role.ADMIN,
                scope: MembershipScope.GLOBAL,
                isActive: true,
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
        };
    });
}

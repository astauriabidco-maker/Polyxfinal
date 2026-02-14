import { PrismaClient, CandidateStatus, OrganizationType, NetworkType, MembershipScope } from '@prisma/client';
import { ROLE_IDS } from '../src/lib/constants/roles';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testConversion() {
    console.log('🚀 Démarrage du test de conversion...');

    // 1. Trouver le candidat Pierre Dupont
    const candidate = await prisma.franchiseCandidate.findFirst({
        where: { email: 'pierre.dupont@candidat.com' }
    });

    if (!candidate) {
        console.error('❌ Candidat Pierre Dupont introuvable');
        return;
    }

    console.log(`📍 Candidat trouvé: ${candidate.companyName} (Status: ${candidate.status})`);

    // 2. Préparer le candidat pour la conversion (Status SIGNED + 20 jours Loi Doubin)
    const twentyFiveDaysAgo = new Date();
    twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25);

    await prisma.franchiseCandidate.update({
        where: { id: candidate.id },
        data: {
            status: 'SIGNED',
            dipSentAt: twentyFiveDaysAgo,
            dipSignedAt: twentyFiveDaysAgo,
            contractSignedAt: new Date(),
            companyName: 'Franchise Marseille Nord',
            siret: '11122233300044',
            representantNom: 'Dupont',
            representantPrenom: 'Pierre',
        }
    });

    console.log('✅ Candidat mis à jour au statut SIGNED (Loi Doubin respectée)');

    // 3. Exécuter la conversion (Onboarding)
    // On va simuler l'appel à onboardFranchisee
    const adminPassword = 'password123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
        // Créer l'organisation
        const newOrg = await tx.organization.create({
            data: {
                name: 'Franchise Marseille Nord',
                siret: '11122233300044',
                type: OrganizationType.OF_STANDARD,
                networkType: NetworkType.FRANCHISE,
                parentId: candidate.organizationId,
                royaltyRate: 5.0,
                leadFeeRate: 15.0,
                isActive: true,
            },
        });

        // Créer le site
        await tx.site.create({
            data: {
                organizationId: newOrg.id,
                name: 'Siège Marseille Nord',
                city: 'Marseille',
                zipCode: '13001',
                address: '123 Avenue de la République',
                isHeadquarters: true,
            },
        });

        // Créer l'utilisateur (ou récupérer)
        let user = await tx.user.findUnique({ where: { email: candidate.email } });
        if (!user) {
            user = await tx.user.create({
                data: {
                    email: candidate.email,
                    nom: 'Dupont',
                    prenom: 'Pierre',
                    passwordHash: hashedPassword,
                    isActive: true,
                }
            });
        }

        // Créer le membership du franchisé
        await tx.membership.create({
            data: {
                userId: user.id,
                organizationId: newOrg.id,
                role: { connect: { id: ROLE_IDS.ADMIN } },
                scope: MembershipScope.GLOBAL,
                isActive: true,
            }
        });

        // --- CRITIQUE POUR LE TEST: Ajouter le Super Admin au portefeuille ---
        const superUser = await tx.user.findUnique({ where: { email: 'super.consultant@test.com' } });
        if (superUser) {
            await tx.membership.create({
                data: {
                    userId: superUser.id,
                    organizationId: newOrg.id,
                    role: { connect: { id: ROLE_IDS.ADMIN } },
                    scope: MembershipScope.GLOBAL,
                    isActive: true,
                }
            });
            console.log('🔗 Super Admin ajouté au membership de la nouvelle franchise');
        }

        // Créer le territoire
        await tx.territory.create({
            data: {
                organizationId: newOrg.id,
                name: 'Zone Marseille Nord',
                zipCodes: ['13001', '13002', '13003'],
                isExclusive: true,
            }
        });

        // Lier au candidat
        await tx.franchiseCandidate.update({
            where: { id: candidate.id },
            data: { createdOrgId: newOrg.id }
        });

        return newOrg;
    });

    console.log(`🎉 Conversion réussie ! Nouvelle Org ID: ${result.id}`);
    console.log(`📊 Vérification: L'organisation "${result.name}" devrait maintenant apparaître dans le Portefeuille du Super Admin.`);
}

testConversion()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

import { PrismaClient, LeadSource, LeadStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Adding Test Leads for OF vs CFA testing...');

    // Get an OF 
    const ofOrg = await prisma.organization.findFirst({
        where: { type: 'OF_STANDARD', isActive: true },
        include: { sites: true }
    });

    // Get a CFA
    const cfaOrg = await prisma.organization.findFirst({
        where: { type: 'CFA', isActive: true },
        include: { sites: true }
    });

    if (!ofOrg || !cfaOrg) {
        console.error('❌ Missing OF or CFA organization in the database. Please run the main seed first.');
        return;
    }

    console.log(`🏢 Found OF: ${ofOrg.name} (ID: ${ofOrg.id})`);
    console.log(`🏢 Found CFA: ${cfaOrg.name} (ID: ${cfaOrg.id})`);

    // Create Leads for OF
    await prisma.lead.createMany({
        data: [
            {
                organizationId: ofOrg.id,
                siteId: ofOrg.sites[0]?.id || null,
                source: LeadSource.WEBSITE_FORM,
                email: 'lead1.of@test.com',
                nom: 'Martin',
                prenom: 'Alain',
                telephone: '0600000001',
                status: LeadStatus.NEW,
                formationSouhaitee: 'Management d\'équipe',
                message: 'Je souhaite me former au management.',
                origin: 'Site Web OF',
            },
            {
                organizationId: ofOrg.id,
                siteId: ofOrg.sites[0]?.id || null,
                source: LeadSource.MANUAL,
                email: 'lead2.of@test.com',
                nom: 'Dubois',
                prenom: 'Marie',
                telephone: '0600000002',
                status: LeadStatus.A_RAPPELER,
                formationSouhaitee: 'Excel Avancé',
                message: 'Demande de devis pour 3 personnes.',
                origin: 'Contact Direct',
            }
        ]
    });
    console.log('✅ Leads created for OF.');

    // Create Leads for CFA
    await prisma.lead.createMany({
        data: [
            {
                organizationId: cfaOrg.id,
                siteId: cfaOrg.sites[0]?.id || null,
                source: LeadSource.EVENT,
                email: 'lead1.cfa@test.com',
                nom: 'Leroux',
                prenom: 'Lucas',
                telephone: '0600000010',
                status: LeadStatus.NEW,
                formationSouhaitee: 'BTS MCO Apprentissage',
                message: 'Je cherche une alternance pour la rentrée prochaine.',
                origin: 'Salon de l\'Etudiant',
            },
            {
                organizationId: cfaOrg.id,
                siteId: cfaOrg.sites[0]?.id || null,
                source: LeadSource.PARTNER_API,
                email: 'lead2.cfa@test.com',
                nom: 'Petit',
                prenom: 'Sophie',
                telephone: '0600000011',
                status: LeadStatus.DISPATCHED,
                formationSouhaitee: 'Titre Pro Dev Web',
                message: 'Profil validé sur notre plateforme partenaire, recherche CFA.',
                origin: 'Plateforme Alternance',
            }
        ]
    });
    console.log('✅ Leads created for CFA.');

    console.log('🎉 Done adding test leads!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

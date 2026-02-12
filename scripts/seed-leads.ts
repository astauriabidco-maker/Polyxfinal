
import { PrismaClient, LeadStatus, LeadSource, OrganizationType } from '@prisma/client';

const prisma = new PrismaClient();

const FIRST_NAMES = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Lucas', 'Emma', 'Thomas', 'Léa', 'Nicolas', 'Julie'];
const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau'];
const CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'];

async function main() {
    console.log('🌱 Seeding leads...');

    // 1. Get ALL Organizations
    let orgs = await prisma.organization.findMany();

    if (orgs.length === 0) {
        console.log('No organization found. Creating "Polyx Demo"...');
        const newOrg = await prisma.organization.create({
            data: {
                name: 'Polyx Demo',
                type: OrganizationType.OF_STANDARD,
                siret: '12345678900012',
            }
        });
        orgs = [newOrg];
    }

    console.log(`Found ${orgs.length} organizations.`);

    for (const org of orgs) {
        console.log(`Creating leads for organization: ${org.name} (${org.id})...`);

        // 2. Create 10 Leads per organization
        const leadsData = Array.from({ length: 10 }).map((_, i) => {
            const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
            const city = CITIES[Math.floor(Math.random() * CITIES.length)];

            return {
                organizationId: org.id,
                email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i + 1}_${org.id.slice(-4)}@example.com`,
                nom: ln,
                prenom: fn,
                telephone: `06${Math.floor(Math.random() * 89999999 + 10000000)}`,
                ville: city,
                codePostal: '75000',
                formationSouhaitee: i % 2 === 0 ? 'BTS MCO' : 'Bachelor Marketing',
                source: i % 3 === 0 ? LeadSource.WEBSITE_FORM : (i % 3 === 1 ? LeadSource.FACEBOOK_ADS : LeadSource.GOOGLE_ADS),
                status: LeadStatus.NEW,
                message: "Je souhaiterais avoir des informations sur la prochaine rentrée.",
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        });

        const result = await prisma.lead.createMany({
            data: leadsData,
        });
        console.log(`✅ Created ${result.count} leads for ${org.name}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

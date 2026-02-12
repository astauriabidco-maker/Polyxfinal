
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const org = await prisma.organization.findFirst({
        include: { sites: true }
    });

    if (!org) {
        console.log('No organization found.');
        return;
    }

    console.log(`Organization: ${org.name} has ${org.sites.length} sites.`);

    if (org.sites.length === 0) {
        console.log('Seeding sites...');
        await prisma.site.createMany({
            data: [
                { name: 'Agence Paris', city: 'Paris', zipCode: '75000', organizationId: org.id },
                { name: 'Agence Lyon', city: 'Lyon', zipCode: '69000', organizationId: org.id },
                { name: 'Campus Bordeaux', city: 'Bordeaux', zipCode: '33000', organizationId: org.id },
            ]
        });
        console.log('✅ Created 3 sites: Paris, Lyon, Bordeaux');
    } else {
        console.log('Sites already exist.');
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

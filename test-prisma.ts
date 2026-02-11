import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const orgCount = await prisma.organization.count();
        console.log('Organization count:', orgCount);

        const settings = await prisma.networkSettings.findFirst();
        console.log('NetworkSettings found:', !!settings);

        if (orgCount > 0) {
            const firstOrg = await prisma.organization.findFirst();
            console.log('First Org ID:', firstOrg?.id);
        }
    } catch (error) {
        console.error('Prisma test error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

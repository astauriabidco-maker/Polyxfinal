import { PrismaClient, NetworkType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Seeding Test Territory ---');

    // 1. Trouver une organisation de type FRANCHISE
    const franchise = await prisma.organization.findFirst({
        where: { networkType: NetworkType.FRANCHISE }
    });

    if (!franchise) {
        console.error('Aucune organisation de type FRANCHISE trouvée. Veuillez d\'abord onboarder un franchisé.');
        return;
    }

    console.log(`Utilisation de la franchise : ${franchise.name} (${franchise.id})`);

    // 2. Nettoyer les anciens territoires de test pour cette franchise
    await prisma.territory.deleteMany({
        where: { organizationId: franchise.id }
    });

    const zipCodes = ['75001', '75002', '75003', '75004'];

    const territory = await prisma.territory.create({
        data: {
            organizationId: franchise.id,
            name: `Secteur Paris Centre - ${franchise.name}`,
            zipCodes,
            isActive: true,
            isExclusive: true
        }
    });

    console.log(`Territoire créé : ${territory.name} avec les codes : ${zipCodes.join(', ')}`);
    console.log('--- Fin du seeding ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

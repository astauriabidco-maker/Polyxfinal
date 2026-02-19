import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Prequal Scripts...');
    const orgs = await prisma.organization.findMany();

    if (orgs.length === 0) {
        console.log('⚠️ No organizations found. Run main seed first.');
        return;
    }

    for (const org of orgs) {
        console.log(`Processing org: ${org.name}`);
        const questions = [
            "Quel est votre niveau d'études actuel ?",
            "Avez-vous un compte CPF actif ?",
            "Êtes-vous disponible immédiatement ?",
            "Avez-vous un ordinateur fiable ?",
            "Quel est votre objectif professionnel ?"
        ];

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await prisma.prequalScript.upsert({
                where: { organizationId_ordre: { organizationId: org.id, ordre: i + 1 } },
                update: { question: q, isActive: true },
                create: {
                    organizationId: org.id,
                    question: q,
                    ordre: i + 1,
                    isActive: true
                }
            });
        }
    }
    console.log('✅ Prequal Scripts seeded!');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

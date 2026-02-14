const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const roles = await prisma.role.findMany(); // Using the new model name
        console.log('Roles found:', roles);

        // Check specifically for FORMAT
        const formatRole = roles.find(r => r.code === 'FORMAT');
        if (formatRole) {
            console.log('✅ FORMAT role exists:', formatRole);
        } else {
            console.error('❌ FORMAT role MISSING');
        }
    } catch (e) {
        console.error('Error querying roles:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

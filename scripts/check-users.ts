import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Check if users exist
    const users = await prisma.user.findMany({
        include: { organization: true }
    });

    console.log(`\n📊 Found ${users.length} users:\n`);
    for (const user of users) {
        console.log(`- ${user.email} (${user.role})`);
        console.log(`  Organization: ${user.organization?.name || 'NONE'}`);
        console.log(`  Has password: ${user.passwordHash ? 'YES' : 'NO'}`);

        // Test password
        if (user.passwordHash) {
            const valid = await bcrypt.compare('password123', user.passwordHash);
            console.log(`  Password 'password123' valid: ${valid ? '✅ YES' : '❌ NO'}`);
        }
        console.log('');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

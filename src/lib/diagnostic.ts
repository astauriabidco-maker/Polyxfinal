
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("=== DIAGNOSTIC DB ===");
    const progCount = await prisma.programme.count();
    console.log(`Programmes Total: ${progCount}`);

    const progs = await prisma.programme.findMany({
        take: 2,
        select: { id: true, title: true, organizationId: true, status: true }
    });
    console.log("Sample Programmes:", JSON.stringify(progs, null, 2));

    const sessionCount = await prisma.session.count();
    console.log(`Sessions Total: ${sessionCount}`);

    const currentUserEmail = 'admin@admin.com'; // Guessing common dev email? Or verify user
    // List all users members of an org
    const memberships = await prisma.membership.findMany({ take: 5, include: { user: true, organization: true } });
    console.log("Sample Memberships:", JSON.stringify(memberships.map(m => ({ user: m.user.email, org: m.organization.name })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

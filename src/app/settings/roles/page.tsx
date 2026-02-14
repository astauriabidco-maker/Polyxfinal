/**
 * ROLES ADMIN PAGE - Gestion des rôles
 * ======================================
 * Page serveur + composant client pour CRUD des rôles.
 * Les rôles système sont en lecture seule.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RolesManager from '@/components/roles/RolesManager';

export default async function RolesPage() {
    const session = await auth();
    if (!session?.user?.organizationId) {
        redirect('/login');
    }

    const organizationId = session.user.organizationId;

    // Vérifier que l'utilisateur est ADMIN
    const roleObj = session.user.role;
    const roleCode = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code;
    const isAdmin = roleCode === 'ADMIN';

    if (!isAdmin) {
        redirect('/dashboard');
    }

    // Charger les rôles
    const roles = await prisma.role.findMany({
        where: {
            OR: [
                { organizationId: null },
                { organizationId },
            ],
        },
        include: {
            _count: {
                select: { memberships: true },
            },
        },
        orderBy: [
            { isSystem: 'desc' },
            { name: 'asc' },
        ],
    });

    const formattedRoles = roles.map((role) => ({
        id: role.id,
        name: role.name,
        code: role.code,
        description: role.description || '',
        isSystem: role.isSystem,
        usageCount: role._count.memberships,
        createdAt: role.createdAt.toISOString(),
    }));

    return (
        <DashboardLayout>
            <div className="p-6 max-w-6xl mx-auto">
                <RolesManager initialRoles={formattedRoles} />
            </div>
        </DashboardLayout>
    );
}

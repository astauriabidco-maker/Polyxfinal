/**
 * PAGE UTILISATEURS - Gestion des membres de l'organisation
 * ==========================================================
 * Liste, création et modification des utilisateurs.
 * 
 * URL: /users
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';
import UserList from '@/components/users/UserList';

export const dynamic = 'force-dynamic';

// Labels pour les rôles
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    'ADMIN': { label: 'Administrateur', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'RESP_PEDAGO': { label: 'Resp. Pédagogique', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    'RESP_ADMIN': { label: 'Resp. Admin/Finance', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'REF_QUALITE': { label: 'Réf. Qualité', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    'FORMAT': { label: 'Formateur', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

export default async function UsersPage() {
    const session = await auth();

    if (!session?.user?.organizationId) {
        redirect('/login');
    }

    const organizationId = session.user.organizationId;
    const currentUserId = session.user.id;

    // Récupérer le rôle de l'utilisateur courant
    const currentMembership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId: currentUserId,
                organizationId,
            },
        },
    });

    const isAdmin = currentMembership?.role === 'ADMIN';

    // Récupérer les membres de l'organisation
    const memberships = await prisma.membership.findMany({
        where: {
            organizationId,
            isActive: true,
        },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    telephone: true,
                    isActive: true,
                    createdAt: true,
                },
            },
            siteAccess: {
                include: {
                    site: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            lastAccessedAt: 'desc',
        },
    });

    // Récupérer les sites de l'organisation (pour le formulaire)
    const sites = await prisma.site.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });

    // Formater les données utilisateurs
    const users = memberships.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        nom: m.user.nom,
        prenom: m.user.prenom,
        telephone: m.user.telephone,
        role: m.role,
        roleLabel: ROLE_LABELS[m.role]?.label || m.role,
        roleColor: ROLE_LABELS[m.role]?.color || ROLE_LABELS['FORMAT'].color,
        scope: m.scope,
        sites: m.siteAccess.map((sa) => sa.site),
        isActive: m.user.isActive && m.isActive,
        lastAccessedAt: m.lastAccessedAt,
        createdAt: m.user.createdAt,
    }));

    // Stats
    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'ADMIN').length,
        active: users.filter(u => u.isActive).length,
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* Header */}
                <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Utilisateurs</h1>
                                    <p className="text-sm text-slate-400">Gestion des accès</p>
                                </div>
                            </div>

                            {/* Stats badges */}
                            <div className="flex gap-3">
                                <div className="px-3 py-1.5 bg-slate-800/70 rounded-lg border border-slate-700/50">
                                    <span className="text-slate-400 text-sm">Total: </span>
                                    <span className="text-white font-semibold">{stats.total}</span>
                                </div>
                                <div className="px-3 py-1.5 bg-purple-500/10 rounded-lg border border-purple-500/30">
                                    <span className="text-purple-400 text-sm">Admins: </span>
                                    <span className="text-purple-300 font-semibold">{stats.admins}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-6 py-8">
                    <UserList
                        users={users}
                        sites={sites}
                        isAdmin={isAdmin}
                        currentUserId={currentUserId}
                    />
                </main>
            </div>
        </DashboardLayout>
    );
}

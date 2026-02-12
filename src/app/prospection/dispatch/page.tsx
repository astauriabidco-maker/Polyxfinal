import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadDispatcher from '@/components/prospection/LeadDispatcher';
import { LeadStatus } from '@prisma/client';

export const metadata = {
    title: 'Dispatcher Leads - Prospection | Polyx ERP',
    description: 'Assignation des leads entrants aux agences',
};

export default async function DispatchPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');
    const organizationId = session.user.organizationId;

    // 1. Vérifier les droits (Manager/Admin)
    // Pour l'instant on laisse ouvert à tous les membres, mais idéalement limiter aux managers

    // 2. Récupérer les leads "NEW"
    const leads = await prisma.lead.findMany({
        where: {
            organizationId,
            status: LeadStatus.NEW
        },
        include: {
            campaign: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // 3. Récupérer les sites (agences)
    const sites = await prisma.site.findMany({
        where: {
            organizationId,
            isActive: true
        },
        orderBy: { name: 'asc' }
    });

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>⚡️</span> Dispatcher (Nouveaux Leads)
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Affectez les leads entrants aux agences pour traitement.
                        {leads.length > 0 && <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{leads.length} à traiter</span>}
                    </p>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <LeadDispatcher leads={leads} sites={sites} />
                </div>
            </div>
        </DashboardLayout>
    );
}

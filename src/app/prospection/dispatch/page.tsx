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

    // 1. Récupérer les leads "NEW"
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

    // 2. Récupérer les sites (agences)
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
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span>⚡️</span> Dispatcher (Nouveaux Leads)
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Affectez les leads entrants aux agences pour traitement.
                        {leads.length > 0 && <span className="ml-2 bg-red-500/20 text-red-400 text-xs font-medium px-2.5 py-0.5 rounded-full border border-red-500/30">{leads.length} à traiter</span>}
                    </p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                    <LeadDispatcher leads={leads} sites={sites} />
                </div>
            </div>
        </DashboardLayout>
    );
}

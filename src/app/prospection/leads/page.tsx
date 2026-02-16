import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadList from '@/components/prospection/LeadList';
import { LeadStatus } from '@prisma/client';

export const metadata = {
    title: 'Mes Leads - Prospection | Polyx ERP',
    description: 'Traitement et qualification des leads',
};

export default async function MyLeadsPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');
    const organizationId = session.user.organizationId;
    const userId = session.user.id;

    // Récupérer le membership pour filtrer par site si scope RESTRICTED
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId,
            },
        },
        include: {
            role: true,
            siteAccess: { select: { siteId: true } },
        },
    });

    // Filtrer par site si l'utilisateur a un scope restreint
    const userSiteIds = membership?.siteAccess?.map((sa: { siteId: string }) => sa.siteId) || [];
    const isRestricted = membership?.scope === 'RESTRICTED' && userSiteIds.length > 0;

    const leads = await prisma.lead.findMany({
        where: {
            organizationId,
            status: {
                in: [LeadStatus.DISPATCHED, LeadStatus.ATTEMPTED, LeadStatus.RDV_SCHEDULED, LeadStatus.NURTURING, LeadStatus.QUALIFIED]
            },
            ...(isRestricted && { siteId: { in: userSiteIds } }),
        },
        include: {
            campaign: { select: { name: true, id: true, source: true } },
            site: { select: { name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 200
    });

    // Récupérer les sites pour le filtre côté client
    const sites = isRestricted
        ? await prisma.site.findMany({ where: { id: { in: userSiteIds } }, orderBy: { name: 'asc' } })
        : await prisma.site.findMany({ where: { organizationId, isActive: true }, orderBy: { name: 'asc' } });

    return (
        <DashboardLayout>
            <div className="h-full flex flex-col">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>📞</span> Mes Leads
                        </h1>
                        {isRestricted && (
                            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                                🔒 Vue restreinte à {userSiteIds.length} site{userSiteIds.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <LeadList initialLeads={leads} sites={sites} />
                </div>
            </div>
        </DashboardLayout>
    );
}

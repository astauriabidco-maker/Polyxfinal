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

    // TODO: Filtrer par Site si l'utilisateur est restreint à un site via Membership
    // Pour l'instant on récupère tous les leads DISPATCHED et suivants de l'orga
    // Idéalement: where: { siteId: userSiteId }

    const leads = await prisma.lead.findMany({
        where: {
            organizationId,
            status: {
                in: [LeadStatus.DISPATCHED, LeadStatus.ATTEMPTED, LeadStatus.RDV_SCHEDULED, LeadStatus.NURTURING, LeadStatus.QUALIFIED]
            }
        },
        include: {
            campaign: { select: { name: true, id: true, source: true, budget: true, spent: true, startDate: true, endDate: true, isActive: true, organizationId: true, externalId: true, utmSource: true, utmMedium: true, utmCampaign: true, webhookSecret: true, createdAt: true, updatedAt: true } },
            site: { select: { name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 200 // Limite pour performance
    });

    return (
        <DashboardLayout>
            <div className="h-full flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 bg-white">
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span>📞</span> Mes Leads
                    </h1>
                </div>

                <div className="flex-1 overflow-hidden">
                    <LeadList initialLeads={leads} />
                </div>
            </div>
        </DashboardLayout>
    );
}

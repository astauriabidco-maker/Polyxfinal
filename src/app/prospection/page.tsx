/**
 * PAGE PROSPECTION - Dashboard principal des leads
 * ==================================================
 * Affiche le pipeline de leads avec KPIs et filtres.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadPipeline from '@/components/prospection/LeadPipeline';

export const metadata = {
    title: 'Prospection - Pipeline Leads | Polyx ERP',
    description: 'Gérez votre pipeline de leads et vos campagnes publicitaires',
};

export default async function ProspectionPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;

    // Récupérer le rôle de l'utilisateur
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId: session.user.id,
                organizationId,
            },
        },
    });

    const isAdmin = membership?.role.code === 'ADMIN';

    // Récupérer les leads
    const leads = await prisma.lead.findMany({
        where: { organizationId },
        include: {
            campaign: { select: { id: true, name: true, source: true } },
            partner: { select: { id: true, companyName: true } },
            leadConsent: { select: { consentGiven: true, legalBasis: true, anonymizedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });

    // Stats
    const statusStats = await prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
    });

    const sourceStats = await prisma.lead.groupBy({
        by: ['source'],
        where: { organizationId },
        _count: true,
    });

    // Campagnes actives
    const activeCampaigns = await prisma.campaign.count({
        where: { organizationId, isActive: true },
    });

    const activePartners = await prisma.partner.count({
        where: { organizationId, status: 'ACTIVE' },
    });

    const stats = {
        byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
        bySource: sourceStats.reduce((acc, s) => ({ ...acc, [s.source]: s._count }), {} as Record<string, number>),
    };

    const serializedLeads = leads.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        convertedAt: l.convertedAt?.toISOString() || null,
        leadConsent: l.leadConsent ? {
            ...l.leadConsent,
            anonymizedAt: l.leadConsent.anonymizedAt?.toISOString() || null,
        } : null,
    }));

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <span className="text-3xl">📢</span>
                                Prospection
                            </h1>
                            <p className="text-slate-400 mt-1">
                                Pipeline de leads • {activeCampaigns} campagne{activeCampaigns > 1 ? 's' : ''} active{activeCampaigns > 1 ? 's' : ''} • {activePartners} partenaire{activePartners > 1 ? 's' : ''} API
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <a
                                href="/prospection/partners"
                                className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors flex items-center gap-2"
                            >
                                🤝 Partenaires
                            </a>
                        </div>
                    </div>
                </div>

                {/* Pipeline */}
                <LeadPipeline
                    leads={serializedLeads as any}
                    stats={stats}
                    isAdmin={isAdmin}
                />
            </div>
        </DashboardLayout>
    );
}

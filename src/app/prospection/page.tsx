/**
 * PAGE PROSPECTION - Dashboard principal des leads
 * ==================================================
 * Affiche le pipeline de leads avec KPIs et filtres.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { LeadStatus } from '@prisma/client';

const PIPELINE_STATUSES = [
    LeadStatus.NEW,
    LeadStatus.DISPATCHED,
    LeadStatus.A_RAPPELER,
    LeadStatus.NE_REPONDS_PAS,
    LeadStatus.PAS_INTERESSE,
];
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
        include: { role: true },
    });

    const isAdmin = membership?.role?.code === 'ADMIN';

    // Récupérer les leads
    const leads = await prisma.lead.findMany({
        where: { organizationId, status: { in: PIPELINE_STATUSES } },
        include: {
            campaign: { select: { id: true, name: true, source: true } },
            partner: { select: { id: true, companyName: true } },
            site: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, nom: true, prenom: true } },
            leadConsent: { select: { consentGiven: true, legalBasis: true, anonymizedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });

    // Stats
    const statusStats = await prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId, status: { in: PIPELINE_STATUSES } },
        _count: true,
    });

    const sourceStats = await prisma.lead.groupBy({
        by: ['source'],
        where: { organizationId, status: { in: PIPELINE_STATUSES } },
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

    // Sites & commerciaux pour le formulaire de création
    const [sites, commercials, scripts] = await Promise.all([
        prisma.site.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({
            where: { memberships: { some: { organizationId } } },
            select: { id: true, nom: true, prenom: true },
            orderBy: { nom: 'asc' },
        }),
        prisma.prequalScript.findMany({
            where: { organizationId, isActive: true },
            select: { id: true, question: true, ordre: true },
            orderBy: { ordre: 'asc' },
        }),
    ]);

    const serializedLeads = leads.map(l => ({
        id: l.id,
        email: l.email,
        nom: l.nom,
        prenom: l.prenom,
        telephone: l.telephone,
        adresse: l.adresse,
        codePostal: l.codePostal,
        ville: l.ville,
        source: l.source,
        status: l.status,
        score: l.score,
        notes: l.notes,
        formationSouhaitee: l.formationSouhaitee,
        campaign: l.campaign,
        partner: l.partner,
        site: l.site,
        assignedTo: l.assignedTo,
        consent: l.leadConsent ? {
            consentGiven: l.leadConsent.consentGiven,
            legalBasis: l.leadConsent.legalBasis,
            anonymizedAt: l.leadConsent.anonymizedAt?.toISOString() || null,
        } : null,
        createdAt: l.createdAt.toISOString(),
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
                    leads={serializedLeads}
                    stats={stats}
                    isAdmin={isAdmin}
                    sites={sites}
                    commercials={commercials}
                    scripts={scripts}
                />
            </div>
        </DashboardLayout>
    );
}

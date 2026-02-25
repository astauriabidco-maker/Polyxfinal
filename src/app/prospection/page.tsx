/**
 * PAGE PROSPECTION - Dashboard principal des leads
 * ==================================================
 * Affiche le pipeline de leads avec KPIs et filtres.
 * Supporte le mode multi-org via ?scope=all
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

export default async function ProspectionPage({ searchParams }: { searchParams: { scope?: string } }) {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;
    const isAllOrgs = searchParams.scope === 'all';

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

    // En mode multi-org, récupérer toutes les org du user
    let orgIds = [organizationId];
    let orgMap: Record<string, { name: string; type: string }> = {};

    if (isAllOrgs) {
        const memberships = await prisma.membership.findMany({
            where: { userId: session.user.id, isActive: true },
            include: { organization: { select: { id: true, name: true, type: true } } },
        });
        orgIds = memberships.map(m => m.organization.id);
        orgMap = Object.fromEntries(
            memberships.map(m => [m.organization.id, { name: m.organization.name, type: m.organization.type }])
        );
    } else {
        // Récupérer au minimum les infos de l'org actuelle + compter les orgs pour afficher le toggle
        const memberships = await prisma.membership.findMany({
            where: { userId: session.user.id, isActive: true },
            include: { organization: { select: { id: true, name: true, type: true } } },
        });
        orgMap = Object.fromEntries(
            memberships.map(m => [m.organization.id, { name: m.organization.name, type: m.organization.type }])
        );
    }

    const hasMultipleOrgs = Object.keys(orgMap).length > 1;

    // Récupérer les leads (single org ou multi-org)
    const whereClause = {
        organizationId: isAllOrgs ? { in: orgIds } : organizationId,
        status: { in: PIPELINE_STATUSES },
    };

    const leads = await prisma.lead.findMany({
        where: whereClause as any,
        include: {
            campaign: { select: { id: true, name: true, source: true } },
            partner: { select: { id: true, companyName: true } },
            site: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, nom: true, prenom: true } },
            leadConsent: { select: { consentGiven: true, legalBasis: true, anonymizedAt: true } },
            organization: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });

    // Stats
    const statusStats = await prisma.lead.groupBy({
        by: ['status'],
        where: whereClause as any,
        _count: true,
    });

    const sourceStats = await prisma.lead.groupBy({
        by: ['source'],
        where: whereClause as any,
        _count: true,
    });

    // Campagnes actives
    const activeCampaigns = await prisma.campaign.count({
        where: { organizationId: isAllOrgs ? { in: orgIds } : organizationId, isActive: true } as any,
    });

    const activePartners = await prisma.partner.count({
        where: { organizationId: isAllOrgs ? { in: orgIds } : organizationId, status: 'ACTIVE' } as any,
    });

    const stats = {
        byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
        bySource: sourceStats.reduce((acc, s) => ({ ...acc, [s.source]: s._count }), {} as Record<string, number>),
    };

    // Sites & commerciaux pour le formulaire de création
    const [sites, commercials, scripts] = await Promise.all([
        prisma.site.findMany({ where: { organizationId: isAllOrgs ? { in: orgIds } : organizationId, isActive: true } as any, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({
            where: { memberships: { some: { organizationId: isAllOrgs ? { in: orgIds } : organizationId } as any } },
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
        // Multi-org info
        organization: (l as any).organization ? {
            id: (l as any).organization.id,
            name: (l as any).organization.name,
            type: (l as any).organization.type,
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
                        <div className="flex gap-3 items-center">
                            {/* Multi-Org Toggle */}
                            {hasMultipleOrgs && (
                                <div className="flex items-center bg-slate-800/60 rounded-xl border border-slate-700/50 p-1">
                                    <a
                                        href="/prospection"
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isAllOrgs
                                            ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        🏢 Org. actuelle
                                    </a>
                                    <a
                                        href="/prospection?scope=all"
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isAllOrgs
                                            ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        🌐 Toutes ({Object.keys(orgMap).length})
                                    </a>
                                </div>
                            )}
                            <a
                                href="/prospection/partners"
                                className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors flex items-center gap-2"
                            >
                                🤝 Partenaires
                            </a>
                        </div>
                    </div>

                    {/* Multi-org indicator */}
                    {isAllOrgs && (
                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                            {Object.entries(orgMap).map(([id, org]) => (
                                <span
                                    key={id}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${org.type === 'CFA'
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                        }`}
                                >
                                    {org.type === 'CFA' ? '🎓' : '🏢'} {org.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pipeline */}
                <LeadPipeline
                    leads={serializedLeads}
                    stats={stats}
                    isAdmin={isAdmin}
                    sites={sites}
                    commercials={commercials}
                    scripts={scripts}
                    multiOrg={isAllOrgs}
                />
            </div>
        </DashboardLayout>
    );
}

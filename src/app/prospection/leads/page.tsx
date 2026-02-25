import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { LeadStatus } from '@prisma/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadPipeline from '@/components/prospection/LeadPipeline';

export const metadata = {
    title: 'Mes Leads | Polyx ERP',
    description: 'Gérez vos leads assignés et qualifiez-les',
};

// Statuses for My Leads (RDV_PLANIFIE removed)
const MY_LEADS_STATUSES = [
    LeadStatus.NEW,
    LeadStatus.DISPATCHED,
    LeadStatus.A_RAPPELER,
    LeadStatus.NE_REPONDS_PAS,
    LeadStatus.PAS_INTERESSE,
];

export default async function MyLeadsPage({ searchParams }: { searchParams: { scope?: string } }) {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;
    const userId = session.user.id;
    const isAllOrgs = searchParams.scope === 'all';

    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: { userId, organizationId },
        },
        include: {
            role: true,
            siteAccess: { include: { site: true } },
            organization: { select: { type: true } }
        },
    });

    if (!membership) redirect('/login');

    const isAdmin = membership.role?.code === 'ADMIN';
    const isManager = membership.role?.code === 'MANAGER';
    const isRestricted = !isAllOrgs && !isAdmin && !isManager;

    const userSiteIds = membership.siteAccess.map(access => access.site.id);

    // Multi-org: récupérer toutes les orgs du user
    let orgIds = [organizationId];
    let orgMap: Record<string, { name: string; type: string }> = {};

    const allMemberships = await prisma.membership.findMany({
        where: { userId, isActive: true },
        include: { organization: { select: { id: true, name: true, type: true } } },
    });
    orgMap = Object.fromEntries(
        allMemberships.map(m => [m.organization.id, { name: m.organization.name, type: m.organization.type }])
    );

    if (isAllOrgs) {
        orgIds = allMemberships.map(m => m.organization.id);
    }

    const hasMultipleOrgs = Object.keys(orgMap).length > 1;

    // Common WHERE clause for leads and stats
    const whereClause = {
        organizationId: isAllOrgs ? { in: orgIds } : organizationId,
        status: { in: MY_LEADS_STATUSES },
        ...(isRestricted && { siteId: { in: userSiteIds } }),
    };

    const [leads, statusStats, sourceStats, sites, commercials, scripts, programs] = await Promise.all([
        // 1. Leads
        prisma.lead.findMany({
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
        }),
        // 2. Stats by Status
        prisma.lead.groupBy({
            by: ['status'],
            where: whereClause as any,
            _count: true,
        }),
        // 3. Stats by Source
        prisma.lead.groupBy({
            by: ['source'],
            where: whereClause as any,
            _count: true,
        }),
        // 4. Sites (for filters/forms)
        prisma.site.findMany({
            where: { organizationId: isAllOrgs ? { in: orgIds } : organizationId, isActive: true } as any,
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
        // 5. Commercials
        prisma.user.findMany({
            where: { memberships: { some: { organizationId: isAllOrgs ? { in: orgIds } : organizationId } as any } },
            select: { id: true, nom: true, prenom: true },
            orderBy: { nom: 'asc' },
        }),
        // 6. Scripts (for CallCockpit)
        prisma.prequalScript.findMany({
            where: { organizationId, isActive: true },
            select: { id: true, question: true, ordre: true },
            orderBy: { ordre: 'asc' },
        }),
        // 7. Programs
        prisma.programme.findMany({
            where: { organizationId: isAllOrgs ? { in: orgIds } : organizationId, status: 'ACTIF' } as any,
            orderBy: { createdAt: 'desc' }
        })
    ]);

    // Format stats for component
    const stats = {
        byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
        bySource: sourceStats.reduce((acc, s) => ({ ...acc, [s.source]: s._count }), {} as Record<string, number>),
    };

    const formattedPrograms = programs.map((p: any) => ({
        id: p.id,
        title: p.title || p.intitule || 'Programme sans titre',
        reference: p.reference
    }));

    // Serialize leads
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
        organization: (l as any).organization ? {
            id: (l as any).organization.id,
            name: (l as any).organization.name,
            type: (l as any).organization.type,
        } : null,
    }));

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
                <div className="mb-6 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <span>🎯</span> Mes Leads
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                {isAllOrgs
                                    ? `Vue consolidée • ${Object.keys(orgMap).length} organisations • ${leads.length} leads actifs`
                                    : `Gérez et qualifiez vos leads (${leads.length} leads actifs)`
                                }
                            </p>
                        </div>

                        {/* Multi-Org Toggle */}
                        {hasMultipleOrgs && (
                            <div className="flex items-center bg-slate-800/60 rounded-xl border border-slate-700/50 p-1">
                                <a
                                    href="/prospection/leads"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isAllOrgs
                                        ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    🏢 Org. actuelle
                                </a>
                                <a
                                    href="/prospection/leads?scope=all"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isAllOrgs
                                        ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    🌐 Toutes ({Object.keys(orgMap).length})
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Multi-org indicator */}
                    {isAllOrgs && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
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

                <div className="flex-1 min-h-0">
                    <LeadPipeline
                        leads={serializedLeads}
                        stats={stats}
                        isAdmin={isAdmin}
                        sites={sites}
                        commercials={commercials}
                        scripts={scripts}
                        programs={formattedPrograms}
                        mode="my-leads"
                        organizationType={membership.organization?.type || 'OF_STANDARD'}
                        multiOrg={isAllOrgs}
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}

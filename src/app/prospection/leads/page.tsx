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

export default async function MyLeadsPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;
    const userId = session.user.id;

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
    const isRestricted = !isAdmin && !isManager;

    const userSiteIds = membership.siteAccess.map(access => access.site.id);

    // Common WHERE clause for leads and stats
    const whereClause = {
        organizationId,
        status: { in: MY_LEADS_STATUSES },
        ...(isRestricted && { siteId: { in: userSiteIds } }),
    };

    const [leads, statusStats, sourceStats, sites, commercials, scripts, programs] = await Promise.all([
        // 1. Leads
        prisma.lead.findMany({
            where: whereClause,
            include: {
                campaign: { select: { id: true, name: true, source: true } },
                partner: { select: { id: true, companyName: true } },
                site: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, nom: true, prenom: true } },
                leadConsent: { select: { consentGiven: true, legalBasis: true, anonymizedAt: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
        // 2. Stats by Status
        prisma.lead.groupBy({
            by: ['status'],
            where: whereClause,
            _count: true,
        }),
        // 3. Stats by Source
        prisma.lead.groupBy({
            by: ['source'],
            where: whereClause,
            _count: true,
        }),
        // 4. Sites (for filters/forms)
        prisma.site.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        // 5. Commercials
        prisma.user.findMany({
            where: { memberships: { some: { organizationId } } },
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
            where: { organizationId, status: 'ACTIF' },
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
        // ... (rest is same)
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
            <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
                <div className="mb-6 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span>🎯</span> Mes Leads
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Gérez et qualifiez vos leads ({leads.length} leads actifs)
                    </p>
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
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}

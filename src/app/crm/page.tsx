/**
 * CRM — Suivi post-RDV : Kanban CRM
 * ====================================
 * /crm
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { LeadStatus } from '@prisma/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CRMKanban from '@/components/crm/CRMKanban';

const CRM_STATUSES = [
    LeadStatus.RDV_PLANIFIE,
    LeadStatus.RDV_NON_HONORE,
    LeadStatus.COURRIERS_ENVOYES,
    LeadStatus.COURRIERS_RECUS,
    LeadStatus.NEGOCIATION,
    LeadStatus.CONVERTI,
    LeadStatus.PROBLEMES_SAV,
    LeadStatus.PERDU,
];

export default async function CRMPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;
    const userId = session.user.id;

    // Récupérer le membership et le scope d'accès
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

    // Filtrer par site si scope RESTRICTED
    const userSiteIds = membership?.siteAccess?.map((sa: { siteId: string }) => sa.siteId) || [];
    const isRestricted = membership?.scope === 'RESTRICTED' && userSiteIds.length > 0;

    // Fetch CRM leads
    const leads = await prisma.lead.findMany({
        where: {
            organizationId,
            status: { in: CRM_STATUSES },
            ...(isRestricted && { siteId: { in: userSiteIds } }),
        },
        include: {
            assignedTo: { select: { id: true, nom: true, prenom: true } },
            site: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });

    // Fetch commercials for reassignment (users in same org)
    const memberships = await prisma.membership.findMany({
        where: {
            organizationId,
            isActive: true,
        },
        include: { user: { select: { id: true, nom: true, prenom: true } } },
    });

    const uniqueCommercials = Array.from(
        new Map(memberships.map(m => [m.user.id, m.user])).values()
    );

    // Serialize dates for client component
    const serializedLeads = leads.map(l => ({
        id: l.id,
        nom: l.nom,
        prenom: l.prenom,
        email: l.email,
        telephone: l.telephone,
        source: l.source,
        status: l.status,
        notes: l.notes,
        formationSouhaitee: l.formationSouhaitee,
        lostReason: l.lostReason,
        dateRdv: l.dateRdv?.toISOString() || null,
        convertedAt: l.convertedAt?.toISOString() || null,
        createdAt: l.createdAt.toISOString(),
        assignedTo: l.assignedTo,
        site: l.site,
    }));

    // Get the site name for display
    let displaySiteName = 'Toutes les agences';
    if (isRestricted && userSiteIds.length === 1) {
        const site = await prisma.site.findUnique({ where: { id: userSiteIds[0] }, select: { name: true } });
        displaySiteName = site?.name || 'Agence';
    }

    return (
        <DashboardLayout>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">📋</span>
                            CRM — Suivi Commercial
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Gérez vos leads post-RDV : courriers, négociation, conversion
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-400">
                            {displaySiteName}
                        </div>
                        <div className="text-xs text-slate-500">
                            {leads.length} lead{leads.length > 1 ? 's' : ''} en suivi
                        </div>
                    </div>
                </div>

                <CRMKanban
                    leads={serializedLeads}
                    commercials={uniqueCommercials}
                />
            </div>
        </DashboardLayout>
    );
}

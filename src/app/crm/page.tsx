/**
 * CRM — Suivi post-RDV : Kanban CRM
 * ====================================
 * /crm — Supporte le mode multi-org via ?scope=all
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
    LeadStatus.RDV_ANNULE,
    LeadStatus.DECISION_EN_ATTENTE,
    // Parcours Financement Personnel
    LeadStatus.TEST_EN_COURS_PERSO,
    LeadStatus.EN_ATTENTE_PAIEMENT,
    LeadStatus.INSCRIT_PERSO,
    // Parcours CPF
    LeadStatus.CPF_COMPTE_A_DEMANDER,
    // Existants
    LeadStatus.COURRIERS_ENVOYES,
    LeadStatus.COURRIERS_RECUS,
    LeadStatus.NEGOCIATION,
    LeadStatus.CONVERTI,
    LeadStatus.PROBLEMES_SAV,
    LeadStatus.PERDU,
];

export default async function CRMPage({ searchParams }: { searchParams: { scope?: string } }) {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;
    const userId = session.user.id;
    const isAllOrgs = searchParams.scope === 'all';

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
            organization: { select: { type: true } },
        },
    });

    const organizationType = membership?.organization?.type || 'OF_STANDARD';

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

    // Filtrer par site si scope RESTRICTED (single org only)
    const userSiteIds = membership?.siteAccess?.map((sa: { siteId: string }) => sa.siteId) || [];
    const isRestricted = !isAllOrgs && membership?.scope === 'RESTRICTED' && userSiteIds.length > 0;

    // Fetch CRM leads
    const leads = await prisma.lead.findMany({
        where: {
            organizationId: isAllOrgs ? { in: orgIds } : organizationId,
            status: { in: CRM_STATUSES },
            ...(isRestricted && { siteId: { in: userSiteIds } }),
        } as any,
        include: {
            assignedTo: { select: { id: true, nom: true, prenom: true } },
            site: { select: { id: true, name: true } },
            organization: { select: { id: true, name: true, type: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });

    // Fetch commercials for reassignment
    const membershipsList = await prisma.membership.findMany({
        where: {
            organizationId: isAllOrgs ? { in: orgIds } : organizationId,
            isActive: true,
        } as any,
        include: { user: { select: { id: true, nom: true, prenom: true } } },
    });

    const uniqueCommercials = Array.from(
        new Map(membershipsList.map(m => [m.user.id, m.user])).values()
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
        organization: (l as any).organization ? {
            id: (l as any).organization.id,
            name: (l as any).organization.name,
            type: (l as any).organization.type,
        } : null,
        // Financement fields
        financementType: l.financementType || null,
        testVolume: l.testVolume || null,
        testTarif: l.testTarif || null,
        montantTotal: l.montantTotal || null,
        montantPaye: l.montantPaye || null,
        factureManuelleValidee: l.factureManuelleValidee || false,
        relancePaiementCount: l.relancePaiementCount || 0,
        dateFacture: l.dateFacture?.toISOString() || null,
        relanceCount: l.relanceCount || 0,
    }));

    // Get site name for display
    let displaySiteName = 'Toutes les agences';
    if (!isAllOrgs && isRestricted && userSiteIds.length === 1) {
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
                            {isAllOrgs
                                ? `Vue consolidée • ${Object.keys(orgMap).length} organisations • ${leads.length} leads en suivi`
                                : `Gérez vos leads post-RDV : courriers, négociation, conversion`
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Multi-Org Toggle */}
                        {hasMultipleOrgs && (
                            <div className="flex items-center bg-slate-800/60 rounded-xl border border-slate-700/50 p-1">
                                <a
                                    href="/crm"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isAllOrgs
                                        ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    🏢 Org. actuelle
                                </a>
                                <a
                                    href="/crm?scope=all"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isAllOrgs
                                        ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    🌐 Toutes ({Object.keys(orgMap).length})
                                </a>
                            </div>
                        )}
                        <div className="text-right">
                            <div className="text-sm text-slate-400">
                                {isAllOrgs ? 'Toutes les organisations' : displaySiteName}
                            </div>
                            <div className="text-xs text-slate-500">
                                {leads.length} lead{leads.length > 1 ? 's' : ''} en suivi
                            </div>
                        </div>
                    </div>
                </div>

                {/* Multi-org indicator */}
                {isAllOrgs && (
                    <div className="flex items-center gap-2 flex-wrap">
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

                <CRMKanban
                    leads={serializedLeads}
                    commercials={uniqueCommercials}
                    organizationType={isAllOrgs ? 'MIXED' : organizationType}
                    multiOrg={isAllOrgs}
                    currentUserId={userId}
                />
            </div>
        </DashboardLayout>
    );
}

/**
 * PAGE DISPATCH LEADS — Distribution Hub & Spoke
 * ================================================
 * Affiche les dossiers en attente de dispatch et permet
 * de les distribuer aux franchisés selon leur zone géographique.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';

export const metadata = {
    title: 'Dispatch Leads | Polyx ERP',
    description: 'Distribution automatique des leads vers les franchisés',
};

export default async function DispatchPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;

    // Charger l'organisation et vérifier le type réseau
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, networkType: true },
    });

    const isHeadOffice = org?.networkType === 'HEAD_OFFICE';

    // Dossiers en attente de dispatch (siège uniquement)
    const pendingDossiers = isHeadOffice
        ? await prisma.dossier.findMany({
            where: {
                organizationId,
                source: 'ORGANIC',
                dispatchedAt: null,
                stagiaireCp: { not: null },
            },
            select: {
                id: true,
                stagiaireNom: true,
                stagiairePrenom: true,
                stagiaireEmail: true,
                stagiaireCp: true,
                status: true,
                createdAt: true,
                session: {
                    select: {
                        programme: { select: { intitule: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })
        : [];

    // Dossiers déjà dispatchés récemment
    const recentDispatched = await prisma.dossier.findMany({
        where: isHeadOffice
            ? { dispatchedFromId: organizationId, dispatchedAt: { not: null } }
            : { organizationId, source: 'NETWORK_DISPATCH' },
        select: {
            id: true,
            stagiaireNom: true,
            stagiairePrenom: true,
            stagiaireCp: true,
            source: true,
            dispatchedAt: true,
            organization: { select: { name: true } },
            session: {
                select: {
                    programme: { select: { intitule: true } },
                },
            },
        },
        orderBy: { dispatchedAt: 'desc' },
        take: 20,
    });

    // Franchisés avec territoires
    const franchisees = isHeadOffice
        ? await prisma.organization.findMany({
            where: {
                parentId: organizationId,
                isActive: true,
                networkType: { in: ['FRANCHISE', 'SUCCURSALE'] },
            },
            include: {
                territories: {
                    where: { isActive: true },
                    select: { name: true, zipCodes: true },
                },
                _count: {
                    select: {
                        dossiers: { where: { source: 'NETWORK_DISPATCH' } },
                    },
                },
            },
        })
        : [];

    // Stats
    const totalPending = pendingDossiers.length;
    const totalDispatched = recentDispatched.length;
    const totalFranchises = franchisees.length;
    const totalCoveredZips = new Set(franchisees.flatMap(f => f.territories.flatMap(t => t.zipCodes))).size;

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">📡</span>
                        Dispatch Leads
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Distribution Hub &amp; Spoke • {org?.name}
                        {!isHeadOffice && (
                            <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                                Vue Franchisé — Leads reçus
                            </span>
                        )}
                    </p>
                </div>

                {/* Non HEAD_OFFICE info */}
                {!isHeadOffice && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 mb-8">
                        <h3 className="font-semibold text-blue-400 mb-2">📥 Leads reçus du réseau</h3>
                        <p className="text-sm text-slate-400">
                            En tant que franchisé, vous recevez automatiquement les leads de votre zone géographique.
                            Le siège dispatche les leads en fonction de votre territoire assigné.
                        </p>
                    </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {isHeadOffice && (
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">En Attente</p>
                            <p className="text-2xl font-bold text-yellow-400">{totalPending}</p>
                            <p className="text-xs text-slate-500">à dispatcher</p>
                        </div>
                    )}
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Dispatchés</p>
                        <p className="text-2xl font-bold text-green-400">{totalDispatched}</p>
                        <p className="text-xs text-slate-500">leads transférés</p>
                    </div>
                    {isHeadOffice && (
                        <>
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Franchisés</p>
                                <p className="text-2xl font-bold text-blue-400">{totalFranchises}</p>
                                <p className="text-xs text-slate-500">dans le réseau</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Couverture</p>
                                <p className="text-2xl font-bold text-purple-400">{totalCoveredZips}</p>
                                <p className="text-xs text-slate-500">codes postaux couverts</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Pending Leads Table (HEAD_OFFICE only) */}
                {isHeadOffice && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            ⏳ Leads en attente de dispatch
                            {totalPending > 0 && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                                    {totalPending}
                                </span>
                            )}
                        </h2>

                        {totalPending === 0 ? (
                            <div className="bg-slate-800/30 rounded-xl border border-dashed border-slate-600 p-8 text-center">
                                <span className="text-4xl mb-3 block">✅</span>
                                <p className="text-slate-400">Tous les leads avec code postal ont été dispatchés</p>
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700/50">
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Stagiaire</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Formation</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Code Postal</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Franchisé Match</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingDossiers.map(dossier => {
                                            // Trouver le franchisé correspondant
                                            const matchedFranchise = franchisees.find(f =>
                                                f.territories.some(t => t.zipCodes.includes(dossier.stagiaireCp || ''))
                                            );
                                            return (
                                                <tr key={dossier.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                                                    <td className="px-4 py-3">
                                                        <p className="text-white font-medium">
                                                            {dossier.stagiairePrenom} {dossier.stagiaireNom}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{dossier.stagiaireEmail}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300">
                                                        {dossier.session.programme.intitule}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="bg-slate-700/50 text-white px-2 py-1 rounded text-xs font-mono">
                                                            {dossier.stagiaireCp}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {matchedFranchise ? (
                                                            <span className="text-green-400 text-xs flex items-center gap-1">
                                                                <span>✅</span>
                                                                {matchedFranchise.name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-yellow-400 text-xs flex items-center gap-1">
                                                                <span>⚠️</span>
                                                                Aucun match
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs">
                                                        {new Date(dossier.createdAt).toLocaleDateString('fr-FR')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Recently Dispatched */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        ✅ {isHeadOffice ? 'Récemment dispatchés' : 'Leads reçus du réseau'}
                    </h2>

                    {recentDispatched.length === 0 ? (
                        <div className="bg-slate-800/30 rounded-xl border border-dashed border-slate-600 p-8 text-center">
                            <span className="text-4xl mb-3 block">📡</span>
                            <p className="text-slate-400">
                                {isHeadOffice
                                    ? 'Aucun lead dispatché pour le moment'
                                    : 'Aucun lead reçu du réseau pour le moment'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recentDispatched.map(dossier => (
                                <div key={dossier.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-white text-sm">
                                            {dossier.stagiairePrenom} {dossier.stagiaireNom}
                                        </h4>
                                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                            ✅ Dispatché
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-1">
                                        🎓 {dossier.session.programme.intitule}
                                    </p>
                                    <p className="text-xs text-slate-400 mb-1">
                                        📍 CP: {dossier.stagiaireCp}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        🏪 → {dossier.organization.name}
                                    </p>
                                    {dossier.dispatchedAt && (
                                        <p className="text-xs text-slate-500 mt-2">
                                            {new Date(dossier.dispatchedAt).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Network Map - Franchisees (HEAD_OFFICE) */}
                {isHeadOffice && franchisees.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-semibold text-white mb-4">🗺️ Couverture Réseau</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {franchisees.map(franchise => (
                                <div key={franchise.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-white">{franchise.name}</h4>
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                            {franchise._count.dossiers} leads
                                        </span>
                                    </div>
                                    {franchise.territories.map((territory, idx) => (
                                        <div key={idx} className="mb-2">
                                            <p className="text-xs text-slate-400 mb-1">📍 {territory.name}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {territory.zipCodes.map(cp => (
                                                    <span key={cp} className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                                                        {cp}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {franchise.territories.length === 0 && (
                                        <p className="text-xs text-slate-500 italic">Aucun territoire assigné</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

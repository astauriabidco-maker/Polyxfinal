/**
 * PAGE REDEVANCES — Calcul et suivi des royalties
 * =================================================
 * Dashboard des redevances dues par les franchisés,
 * avec breakdown organique vs dispatch et KPIs réseau.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';

export const metadata = {
    title: 'Redevances Franchise | Polyx ERP',
    description: 'Calcul et suivi des redevances du réseau franchise',
};

export default async function RoyaltiesPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;

    // Charger l'organisation
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            id: true,
            name: true,
            networkType: true,
            royaltyRate: true,
            leadFeeRate: true,
            parent: { select: { id: true, name: true } },
        },
    });

    const isHeadOffice = org?.networkType === 'HEAD_OFFICE';
    const isFranchise = org?.networkType === 'FRANCHISE' || org?.networkType === 'SUCCURSALE';

    // Mois courant au format YYYY-MM
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Charger les franchisés (pour HEAD_OFFICE)
    const franchisees = isHeadOffice
        ? await prisma.organization.findMany({
            where: {
                parentId: organizationId,
                isActive: true,
                networkType: { in: ['FRANCHISE', 'SUCCURSALE'] },
            },
            select: {
                id: true,
                name: true,
                networkType: true,
                royaltyRate: true,
                leadFeeRate: true,
                siret: true,
                _count: {
                    select: {
                        dossiers: true,
                    },
                },
            },
        })
        : [];

    // Charger les contrats signés ce mois pour calcul des redevances
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Pour chaque franchisé, calculer le CA
    const franchiseeData = await Promise.all(
        franchisees.map(async (franchise) => {
            const contrats = await prisma.contrat.findMany({
                where: {
                    dossier: { organizationId: franchise.id },
                    status: 'ACTIF',
                    isSigned: true,
                    dateSignature: { gte: startDate, lte: endDate },
                },
                include: {
                    dossier: { select: { source: true } },
                },
            });

            let organicCa = 0;
            let organicCount = 0;
            let dispatchCa = 0;
            let dispatchCount = 0;

            for (const contrat of contrats) {
                const montant = Number(contrat.montantHT);
                if (contrat.dossier.source === 'NETWORK_DISPATCH') {
                    dispatchCa += montant;
                    dispatchCount++;
                } else {
                    organicCa += montant;
                    organicCount++;
                }
            }

            const royaltyRate = franchise.royaltyRate ?? 5.0;
            const leadFeeRate = franchise.leadFeeRate ?? 15.0;
            const organicDue = Math.round(organicCa * (royaltyRate / 100) * 100) / 100;
            const dispatchDue = Math.round(dispatchCa * (leadFeeRate / 100) * 100) / 100;

            return {
                ...franchise,
                organicCa,
                organicCount,
                dispatchCa,
                dispatchCount,
                organicDue,
                dispatchDue,
                totalCa: organicCa + dispatchCa,
                totalDue: organicDue + dispatchDue,
                royaltyRate,
                leadFeeRate,
            };
        })
    );

    // KPIs réseau
    const networkTotalCa = franchiseeData.reduce((sum, f) => sum + f.totalCa, 0);
    const networkTotalDue = franchiseeData.reduce((sum, f) => sum + f.totalDue, 0);
    const networkTotalContracts = franchiseeData.reduce((sum, f) => sum + f.organicCount + f.dispatchCount, 0);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">💰</span>
                        Redevances
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {isHeadOffice ? 'Suivi réseau' : 'Ma redevance'} •{' '}
                        <span className="text-white font-medium">
                            {new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </span>
                    </p>
                </div>

                {/* Franchise View - Own Info */}
                {isFranchise && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-white text-lg">{org?.name}</h3>
                                <p className="text-sm text-slate-400">Siège : {org?.parent?.name || '—'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Taux redevance / Commission leads</p>
                                <p className="text-lg font-bold text-white">
                                    {org?.royaltyRate ?? 5}% / {org?.leadFeeRate ?? 15}%
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">CA Réseau</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(networkTotalCa)}</p>
                        <p className="text-xs text-slate-500">{currentMonth}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Redevances Dues</p>
                        <p className={`text-2xl font-bold ${networkTotalDue > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                            {formatCurrency(networkTotalDue)}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Contrats</p>
                        <p className="text-2xl font-bold text-blue-400">{networkTotalContracts}</p>
                        <p className="text-xs text-slate-500">signés ce mois</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Franchisés</p>
                        <p className="text-2xl font-bold text-purple-400">{franchisees.length}</p>
                        <p className="text-xs text-slate-500">dans le réseau</p>
                    </div>
                </div>

                {/* Franchisee Table (HEAD_OFFICE) */}
                {isHeadOffice && (
                    <div>
                        <h2 className="text-lg font-semibold text-white mb-4">📊 Détail par franchisé</h2>

                        {franchisees.length === 0 ? (
                            <div className="bg-slate-800/30 rounded-2xl border border-dashed border-slate-600 p-12 text-center">
                                <span className="text-5xl mb-4 block">💰</span>
                                <h3 className="text-xl font-semibold text-white mb-2">Aucun franchisé actif</h3>
                                <p className="text-slate-400">
                                    Onboardez des candidats franchise pour commencer à suivre les redevances.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700/50 bg-slate-800/50">
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Franchisé</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">CA Organique</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">Taux</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">CA Dispatch</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">Taux</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Dû</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {franchiseeData.map(franchise => (
                                            <tr key={franchise.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                                                <td className="px-4 py-3">
                                                    <p className="text-white font-medium">{franchise.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {franchise.networkType === 'FRANCHISE' ? '🏪' : '🏢'}{' '}
                                                        {franchise.organicCount + franchise.dispatchCount} contrats
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <p className="text-slate-300">{formatCurrency(franchise.organicCa)}</p>
                                                    <p className="text-xs text-slate-500">{franchise.organicCount} contrats</p>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                                        {franchise.royaltyRate}%
                                                    </span>
                                                    <p className="text-xs text-green-400 mt-1">{formatCurrency(franchise.organicDue)}</p>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <p className="text-slate-300">{formatCurrency(franchise.dispatchCa)}</p>
                                                    <p className="text-xs text-slate-500">{franchise.dispatchCount} contrats</p>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                                                        {franchise.leadFeeRate}%
                                                    </span>
                                                    <p className="text-xs text-green-400 mt-1">{formatCurrency(franchise.dispatchDue)}</p>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <p className={`text-lg font-bold ${franchise.totalDue > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                                                        {formatCurrency(franchise.totalDue)}
                                                    </p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-800/60 border-t border-slate-600">
                                            <td className="px-4 py-3 text-white font-semibold">TOTAL RÉSEAU</td>
                                            <td className="px-4 py-3 text-right text-white font-semibold">
                                                {formatCurrency(franchiseeData.reduce((s, f) => s + f.organicCa, 0))}
                                            </td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3 text-right text-white font-semibold">
                                                {formatCurrency(franchiseeData.reduce((s, f) => s + f.dispatchCa, 0))}
                                            </td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3 text-right">
                                                <p className="text-xl font-bold text-green-400">{formatCurrency(networkTotalDue)}</p>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Rate Info */}
                <div className="mt-8 bg-slate-800/30 rounded-xl border border-slate-700/30 p-5">
                    <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider mb-3">
                        ℹ️ Barème des taux
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                                🌱
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Redevance Organique</p>
                                <p className="text-xs text-slate-400">
                                    Appliquée sur le CA des dossiers acquis directement par le franchisé.
                                    Taux par défaut : <span className="text-blue-400">5%</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 shrink-0">
                                📡
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Commission Lead Apporté</p>
                                <p className="text-xs text-slate-400">
                                    Appliquée sur le CA des leads dispatchés par le siège.
                                    Taux par défaut : <span className="text-purple-400">15%</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

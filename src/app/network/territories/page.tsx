/**
 * PAGE TERRITOIRES — Gestion des zones géographiques
 * ====================================================
 * Affiche et gère les territoires des franchisés avec
 * détection de chevauchements et badges codes postaux.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';

export const metadata = {
    title: 'Territoires | Polyx ERP',
    description: 'Gestion des zones géographiques du réseau franchise',
};

export default async function TerritoriesPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    const organizationId = session.user.organizationId;

    // Charger l'organisation
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, networkType: true },
    });

    const isHeadOffice = org?.networkType === 'HEAD_OFFICE';

    // Charger les territoires selon le rôle
    const territories = await prisma.territory.findMany({
        where: isHeadOffice
            ? {
                organization: {
                    OR: [
                        { id: organizationId },
                        { parentId: organizationId },
                    ],
                },
            }
            : { organizationId },
        include: {
            organization: {
                select: { id: true, name: true, networkType: true },
            },
        },
        orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
    });

    // Stats
    const totalTerritories = territories.length;
    const totalZipCodes = new Set(territories.flatMap(t => t.zipCodes)).size;
    const exclusiveTerritories = territories.filter(t => t.isExclusive).length;
    const activeTerritories = territories.filter(t => t.isActive).length;

    // Détecter les chevauchements
    const overlaps: { zip: string; territories: string[] }[] = [];
    const zipMap = new Map<string, string[]>();
    for (const territory of territories) {
        for (const zip of territory.zipCodes) {
            const existing = zipMap.get(zip) || [];
            existing.push(`${territory.name} (${territory.organization.name})`);
            zipMap.set(zip, existing);
        }
    }
    zipMap.forEach((names, zip) => {
        if (names.length > 1) {
            overlaps.push({ zip, territories: names });
        }
    });

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">🗺️</span>
                        Territoires
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Zones géographiques exclusives • {org?.name}
                    </p>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Territoires</p>
                        <p className="text-2xl font-bold text-white">{totalTerritories}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Codes Postaux</p>
                        <p className="text-2xl font-bold text-blue-400">{totalZipCodes}</p>
                        <p className="text-xs text-slate-500">uniques couverts</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Exclusifs</p>
                        <p className="text-2xl font-bold text-purple-400">{exclusiveTerritories}</p>
                        <p className="text-xs text-slate-500">/ {totalTerritories} total</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Actifs</p>
                        <p className="text-2xl font-bold text-green-400">{activeTerritories}</p>
                    </div>
                </div>

                {/* Overlap Warning */}
                {overlaps.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-8">
                        <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                            ⚠️ Chevauchements détectés ({overlaps.length})
                        </h3>
                        <div className="space-y-2">
                            {overlaps.map(overlap => (
                                <div key={overlap.zip} className="flex items-center gap-3 text-sm">
                                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-mono text-xs">
                                        {overlap.zip}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-slate-300">
                                        {overlap.territories.join(' • ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Territories List */}
                {totalTerritories === 0 ? (
                    <div className="bg-slate-800/30 rounded-2xl border border-dashed border-slate-600 p-12 text-center">
                        <span className="text-5xl mb-4 block">🗺️</span>
                        <h3 className="text-xl font-semibold text-white mb-2">Aucun territoire défini</h3>
                        <p className="text-slate-400 mb-4">
                            Définissez des zones géographiques pour vos franchisés afin de permettre le dispatch automatique des leads.
                        </p>
                        <p className="text-sm text-slate-500">
                            Utilisez l&apos;API <code className="text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded">POST /api/network/territories</code> pour créer un territoire.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {territories.map(territory => (
                            <div
                                key={territory.id}
                                className={`bg-slate-800/50 rounded-xl border p-5 transition-all ${territory.isActive
                                    ? 'border-slate-700/50 hover:border-slate-600'
                                    : 'border-slate-700/30 opacity-50'
                                    }`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-semibold text-white text-lg">{territory.name}</h3>
                                        <p className="text-sm text-slate-400">
                                            🏪 {territory.organization.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {territory.isExclusive && (
                                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                                                🔒 Exclusif
                                            </span>
                                        )}
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${territory.isActive
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}
                                        >
                                            {territory.isActive ? '● Actif' : '○ Inactif'}
                                        </span>
                                    </div>
                                </div>

                                {/* Zip Codes */}
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                                        Codes postaux ({territory.zipCodes.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {territory.zipCodes.map(zip => {
                                            const hasOverlap = overlaps.some(o => o.zip === zip);
                                            return (
                                                <span
                                                    key={zip}
                                                    className={`text-xs px-2 py-1 rounded font-mono ${hasOverlap
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        : 'bg-slate-700/50 text-slate-300'
                                                        }`}
                                                >
                                                    {zip}
                                                    {hasOverlap && ' ⚠️'}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
                                    <span className="text-xs text-slate-500">
                                        Créé le {new Date(territory.createdAt).toLocaleDateString('fr-FR')}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {territory.organization.networkType === 'FRANCHISE' && '🏪 Franchise'}
                                        {territory.organization.networkType === 'SUCCURSALE' && '🏢 Succursale'}
                                        {territory.organization.networkType === 'HEAD_OFFICE' && '🏛️ Siège'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

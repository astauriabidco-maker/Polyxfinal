/**
 * SITES / AGENCES - Page principale
 * ==================================
 * Liste globale de tous les sites/agences avec sidebar intégrée.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';

interface Site {
    id: string;
    name: string;
    isHeadquarters: boolean;
    address?: string;
    city: string;
    zipCode: string;
    uaiCode?: string;
    siretNic?: string;
    isActive: boolean;
    organizationId: string;
    organization?: {
        id: string;
        name: string;
        type: string;
    };
    _count?: {
        sessions: number;
        dossiers: number;
    };
}

export default function SitesListPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Charger tous les sites
    useEffect(() => {
        async function loadSites() {
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) throw new Error('Erreur chargement sites');
                const data = await res.json();
                setSites(data.sites || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur de chargement');
            } finally {
                setLoading(false);
            }
        }
        loadSites();
    }, []);

    // Filtrer les sites
    const filteredSites = sites.filter(site => {
        const search = searchQuery.toLowerCase();
        return (
            site.name.toLowerCase().includes(search) ||
            site.city.toLowerCase().includes(search) ||
            site.organization?.name.toLowerCase().includes(search) ||
            site.zipCode.includes(search)
        );
    });

    // Grouper par organisation
    const sitesByOrg = filteredSites.reduce((acc, site) => {
        const orgName = site.organization?.name || 'Non assigné';
        if (!acc[orgName]) acc[orgName] = [];
        acc[orgName].push(site);
        return acc;
    }, {} as Record<string, Site[]>);

    return (
        <div className="min-h-screen bg-slate-950 flex">
            <Sidebar />

            <main className="flex-1 ml-64 transition-all duration-300">
                {/* Header */}
                <header className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-semibold text-white">
                                Sites & Agences
                            </h1>
                            <p className="text-sm text-slate-400">
                                Gérer tous vos campus et lieux de formation
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Recherche */}
                            <div className="relative">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-64"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-6">
                    {/* Stats globales */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-white">{sites.length}</p>
                            <p className="text-sm text-gray-400">Total sites</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-emerald-400">
                                {sites.filter(s => s.isActive).length}
                            </p>
                            <p className="text-sm text-gray-400">Actifs</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-amber-400">
                                {sites.filter(s => s.isHeadquarters).length}
                            </p>
                            <p className="text-sm text-gray-400">Sièges</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-blue-400">
                                {Object.keys(sitesByOrg).length}
                            </p>
                            <p className="text-sm text-gray-400">Organisations</p>
                        </div>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
                            {error}
                        </div>
                    )}

                    {/* Pas de sites */}
                    {!loading && !error && sites.length === 0 && (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-12 text-center">
                            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <p className="text-gray-400 mb-4">Aucun site configuré</p>
                            <p className="text-sm text-gray-500">
                                Les sites sont créés depuis la page Paramètres de chaque organisation.
                            </p>
                            <Link
                                href="/portfolio"
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                            >
                                Voir mes organisations
                            </Link>
                        </div>
                    )}

                    {/* Liste des sites par organisation */}
                    {!loading && !error && Object.keys(sitesByOrg).length > 0 && (
                        <div className="space-y-6">
                            {Object.entries(sitesByOrg).map(([orgName, orgSites]) => (
                                <div key={orgName} className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
                                    {/* En-tête organisation */}
                                    <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-medium">{orgName}</h3>
                                                <p className="text-xs text-gray-500">{orgSites.length} site(s)</p>
                                            </div>
                                        </div>
                                        {orgSites[0]?.organizationId && (
                                            <Link
                                                href={`/organizations/${orgSites[0].organizationId}/sites`}
                                                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                            >
                                                Gérer
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        )}
                                    </div>

                                    {/* Sites de l'organisation */}
                                    <div className="divide-y divide-slate-700/50">
                                        {orgSites.map(site => (
                                            <div key={site.id} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`
                                                            w-10 h-10 rounded-lg flex items-center justify-center
                                                            ${site.isHeadquarters
                                                                ? 'bg-amber-500/20 text-amber-400'
                                                                : 'bg-slate-700 text-slate-400'
                                                            }
                                                        `}>
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-white font-medium">{site.name}</span>
                                                                {site.isHeadquarters && (
                                                                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                                                        Siège
                                                                    </span>
                                                                )}
                                                                {!site.isActive && (
                                                                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                                                        Inactif
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-400">
                                                                {site.zipCode} {site.city}
                                                                {site.address && ` — ${site.address}`}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        {site.uaiCode && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="text-blue-400">UAI:</span> {site.uaiCode}
                                                            </span>
                                                        )}
                                                        {site._count && (
                                                            <>
                                                                <span>{site._count.sessions} sessions</span>
                                                                <span>{site._count.dossiers} dossiers</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

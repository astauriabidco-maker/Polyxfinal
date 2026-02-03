/**
 * SITES MANAGEMENT PAGE
 * ======================
 * Page de gestion des sites/campus d'une organisation.
 * - Liste des sites avec stats
 * - Création/édition
 * - Validation UAI pour CFA
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
    _count?: {
        sessions: number;
        dossiers: number;
    };
}

interface Organization {
    id: string;
    name: string;
    type: string;
    siret: string;
}

// Regex validation UAI (8 caractères: 7 chiffres + 1 lettre)
const UAI_REGEX = /^[0-9]{7}[A-Z]$/;

export default function SitesManagementPage() {
    const params = useParams();
    const orgId = params.id as string;

    const [organization, setOrganization] = useState<Organization | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formCity, setFormCity] = useState('');
    const [formZipCode, setFormZipCode] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formUaiCode, setFormUaiCode] = useState('');
    const [formSiretNic, setFormSiretNic] = useState('');
    const [formIsHeadquarters, setFormIsHeadquarters] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Charger l'organisation et les sites
    useEffect(() => {
        async function loadData() {
            try {
                // Charger l'organisation
                const orgRes = await fetch(`/api/organizations/${orgId}`);
                if (!orgRes.ok) throw new Error('Organisation non trouvée');
                const orgData = await orgRes.json();
                setOrganization(orgData.organization);

                // Charger les sites
                const sitesRes = await fetch(`/api/organizations/${orgId}/sites`);
                if (!sitesRes.ok) throw new Error('Erreur chargement sites');
                const sitesData = await sitesRes.json();
                setSites(sitesData.sites || []);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur de chargement');
            } finally {
                setLoading(false);
            }
        }
        if (orgId) loadData();
    }, [orgId]);

    const isCFA = organization?.type === 'CFA';

    // Ouvrir le modal pour créer
    const handleCreate = () => {
        setEditingSite(null);
        setFormName('');
        setFormCity('');
        setFormZipCode('');
        setFormAddress('');
        setFormUaiCode('');
        setFormSiretNic('');
        setFormIsHeadquarters(sites.length === 0); // Premier site = siège par défaut
        setFormError(null);
        setShowModal(true);
    };

    // Ouvrir le modal pour éditer
    const handleEdit = (site: Site) => {
        setEditingSite(site);
        setFormName(site.name);
        setFormCity(site.city);
        setFormZipCode(site.zipCode);
        setFormAddress(site.address || '');
        setFormUaiCode(site.uaiCode || '');
        setFormSiretNic(site.siretNic || '');
        setFormIsHeadquarters(site.isHeadquarters);
        setFormError(null);
        setShowModal(true);
    };

    // Soumettre le formulaire
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validations
        if (!formName.trim()) {
            setFormError('Le nom du site est obligatoire');
            return;
        }
        if (!formCity.trim()) {
            setFormError('La ville est obligatoire');
            return;
        }
        if (!formZipCode.trim()) {
            setFormError('Le code postal est obligatoire');
            return;
        }

        // Validation UAI pour CFA
        if (isCFA && formUaiCode && !UAI_REGEX.test(formUaiCode.toUpperCase())) {
            setFormError('Code UAI invalide (format: 7 chiffres + 1 lettre, ex: 0751234A)');
            return;
        }

        setSaving(true);

        try {
            const payload = {
                name: formName.trim(),
                city: formCity.trim(),
                zipCode: formZipCode.trim(),
                address: formAddress.trim() || null,
                uaiCode: formUaiCode.trim().toUpperCase() || null,
                siretNic: formSiretNic.trim() || null,
                isHeadquarters: formIsHeadquarters,
            };

            const url = editingSite
                ? `/api/organizations/${orgId}/sites/${editingSite.id}`
                : `/api/organizations/${orgId}/sites`;

            const res = await fetch(url, {
                method: editingSite ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors de la sauvegarde');
            }

            // Mettre à jour la liste
            if (editingSite) {
                setSites(prev => prev.map(s => s.id === editingSite.id ? data.site : s));
            } else {
                setSites(prev => [...prev, data.site]);
            }

            setShowModal(false);

        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setSaving(false);
        }
    };

    // Supprimer un site
    const handleDelete = async (site: Site) => {
        if (!confirm(`Supprimer le site "${site.name}" ?`)) return;

        try {
            const res = await fetch(`/api/organizations/${orgId}/sites/${site.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            setSites(prev => prev.filter(s => s.id !== site.id));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erreur de suppression');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex">
                <Sidebar />
                <main className="flex-1 ml-64 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                </main>
            </div>
        );
    }

    if (error || !organization) {
        return (
            <div className="min-h-screen bg-slate-950 flex">
                <Sidebar />
                <main className="flex-1 ml-64 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error || 'Organisation non trouvée'}</p>
                        <Link href="/portfolio" className="text-blue-400 hover:underline">
                            Retour au portfolio
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex">
            <Sidebar />

            <main className="flex-1 ml-64 transition-all duration-300">
                {/* Header */}
                <header className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/portfolio"
                                className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-xl font-semibold text-white">
                                    Sites: {organization.name}
                                </h1>
                                <p className="text-sm text-slate-400">
                                    Gérer les campus et lieux de formation
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Nouveau Site
                        </button>
                    </div>
                </header>

                <div className="p-6 max-w-5xl mx-auto">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                        <Link href="/portfolio" className="hover:text-white transition-colors">
                            Tour de Contrôle
                        </Link>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-white">Sites</span>
                    </nav>

                    {/* Info CFA */}
                    {isCFA && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-blue-300">Organisation CFA</p>
                                    <p className="text-xs text-blue-200/80 mt-1">
                                        Chaque site CFA doit disposer d'un code UAI (Unité Administrative Immatriculée) délivré par le rectorat.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-white">{sites.length}</p>
                            <p className="text-sm text-gray-400">Sites</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-emerald-400">
                                {sites.filter(s => s.isActive).length}
                            </p>
                            <p className="text-sm text-gray-400">Actifs</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-blue-400">
                                {sites.reduce((acc, s) => acc + (s._count?.dossiers || 0), 0)}
                            </p>
                            <p className="text-sm text-gray-400">Dossiers</p>
                        </div>
                    </div>

                    {/* Liste des sites */}
                    {sites.length === 0 ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-12 text-center">
                            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <p className="text-gray-400 mb-4">Aucun site configuré</p>
                            <button
                                onClick={handleCreate}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Créer le premier site
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sites.map(site => (
                                <div
                                    key={site.id}
                                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className={`
                                                w-12 h-12 rounded-lg flex items-center justify-center
                                                ${site.isHeadquarters
                                                    ? 'bg-amber-500/20 text-amber-400'
                                                    : 'bg-slate-700 text-slate-400'
                                                }
                                            `}>
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium text-white">{site.name}</h3>
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
                                                <p className="text-sm text-gray-400 mt-0.5">
                                                    {site.zipCode} {site.city}
                                                    {site.address && ` — ${site.address}`}
                                                </p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                    {site.uaiCode && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="text-blue-400">UAI:</span> {site.uaiCode}
                                                        </span>
                                                    )}
                                                    {site.siretNic && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="text-gray-400">NIC:</span> {site.siretNic}
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

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(site)}
                                                className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(site)}
                                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Création/Édition */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-slate-700">
                            <h2 className="text-lg font-semibold text-white">
                                {editingSite ? 'Modifier le site' : 'Nouveau site'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Nom */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Nom du site <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Campus Paris"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                    required
                                />
                            </div>

                            {/* Ville + Code postal */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                        Ville <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formCity}
                                        onChange={(e) => setFormCity(e.target.value)}
                                        placeholder="Paris"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                        Code postal <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formZipCode}
                                        onChange={(e) => setFormZipCode(e.target.value)}
                                        placeholder="75001"
                                        maxLength={5}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Adresse */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Adresse
                                </label>
                                <input
                                    type="text"
                                    value={formAddress}
                                    onChange={(e) => setFormAddress(e.target.value)}
                                    placeholder="12 rue de la Formation"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* UAI (CFA) ou NIC */}
                            <div className="grid grid-cols-2 gap-4">
                                {isCFA && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                            Code UAI
                                            <span className="text-xs text-gray-500 ml-1">(CFA)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formUaiCode}
                                            onChange={(e) => setFormUaiCode(e.target.value.toUpperCase())}
                                            placeholder="0751234A"
                                            maxLength={8}
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                        NIC (SIRET)
                                        <span className="text-xs text-gray-500 ml-1">(5 chiffres)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formSiretNic}
                                        onChange={(e) => setFormSiretNic(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                        placeholder="00012"
                                        maxLength={5}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Siège */}
                            <label className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={formIsHeadquarters}
                                    onChange={(e) => setFormIsHeadquarters(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-500 text-amber-500 focus:ring-amber-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-white">Site principal (siège)</p>
                                    <p className="text-xs text-gray-500">Adresse de facturation et siège social</p>
                                </div>
                            </label>

                            {/* Erreur */}
                            {formError && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm">
                                    {formError}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    disabled={saving}
                                    className="px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Enregistrement...
                                        </>
                                    ) : (
                                        editingSite ? 'Enregistrer' : 'Créer le site'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * ORGANIZATION SETTINGS PAGE
 * ==========================
 * Page de paramétrage d'une organisation avec onglets:
 * - Identité Visuelle (Logo, Signature, Cachet)
 * - Documents (CGV, Livret d'accueil, Règlement intérieur)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { switchOrganization } from '@/app/actions/switchOrganization';

// Types
interface Organization {
    id: string;
    name: string;
    type: string;
    siret?: string;
    responsableName?: string;
    ndaNumber?: string;
    qualiopiCertified?: boolean;
    qualiopiExpiry?: string;
    logoUrl?: string;
    signatureUrl?: string;
    cachetUrl?: string;
    cgvUrl?: string;
    livretAccueilUrl?: string;
    reglementInterieurUrl?: string;
}

type TabId = 'general' | 'identity' | 'documents';

// Composant d'upload de fichier
function FileUploadField({
    label,
    description,
    currentUrl,
    accept,
    onUpload,
    isUploading,
}: {
    label: string;
    description: string;
    currentUrl?: string;
    accept: string;
    onUpload: (file: File) => Promise<void>;
    isUploading: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) await onUpload(file);
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await onUpload(file);
    };

    const isImage = accept.includes('image');
    const isPdf = accept.includes('pdf');

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h4 className="text-white font-medium">{label}</h4>
                    <p className="text-sm text-gray-400">{description}</p>
                </div>
                {currentUrl && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Configuré
                    </span>
                )}
            </div>

            {/* Prévisualisation */}
            {currentUrl && isImage && (
                <div className="mb-3 p-2 bg-white/5 rounded-lg inline-block">
                    <img
                        src={currentUrl}
                        alt={label}
                        className="max-h-20 max-w-full object-contain"
                    />
                </div>
            )}

            {currentUrl && isPdf && (
                <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    Voir le document actuel
                </a>
            )}

            {/* Zone de drop */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`
                    border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
                    ${dragOver
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
                    }
                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleChange}
                    className="hidden"
                />

                {isUploading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Téléchargement...
                    </div>
                ) : (
                    <>
                        <svg className="w-8 h-8 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-400">
                            Glissez un fichier ici ou{' '}
                            <span className="text-blue-400">parcourir</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {isImage ? 'PNG, JPG, SVG (max 2MB)' : 'PDF (max 10MB)'}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function OrganizationSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const orgId = params.id as string;

    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saving, setSaving] = useState(false);

    // État du formulaire général
    const [formData, setFormData] = useState({
        name: '',
        responsableName: '',
        ndaNumber: '',
        qualiopiCertified: false,
        qualiopiExpiry: '',
    });

    // Charger l'organisation
    useEffect(() => {
        async function loadOrg() {
            try {
                const res = await fetch(`/api/organizations/${orgId}`);
                if (!res.ok) throw new Error('Organisation non trouvée');
                const data = await res.json();
                setOrganization(data.organization);
                setFormData({
                    name: data.organization.name || '',
                    responsableName: data.organization.responsableName || '',
                    ndaNumber: data.organization.ndaNumber || '',
                    qualiopiCertified: data.organization.qualiopiCertified || false,
                    qualiopiExpiry: data.organization.qualiopiExpiry?.split('T')[0] || '',
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur de chargement');
            } finally {
                setLoading(false);
            }
        }
        if (orgId) loadOrg();
    }, [orgId]);

    // Handler d'upload
    const handleUpload = async (field: string, file: File) => {
        setUploading(field);
        setSaveSuccess(false);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('field', field);

            const res = await fetch(`/api/organizations/${orgId}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erreur upload');
            }

            const data = await res.json();

            // Mettre à jour l'état local
            setOrganization(prev => prev ? { ...prev, [field]: data.url } : null);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur upload');
        } finally {
            setUploading(null);
        }
    };

    // Handler save infos générales
    const handleSaveGeneral = async () => {
        setSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            const patchData: Record<string, unknown> = {
                name: formData.name,
                responsableName: formData.responsableName || null,
                ndaNumber: formData.ndaNumber || null,
                qualiopiCertified: formData.qualiopiCertified,
            };

            if (formData.qualiopiExpiry) {
                patchData.qualiopiExpiry = new Date(formData.qualiopiExpiry).toISOString();
            } else {
                patchData.qualiopiExpiry = null;
            }

            const res = await fetch(`/api/organizations/${orgId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erreur lors de la mise à jour');
            }

            const data = await res.json();
            setOrganization(prev => prev ? { ...prev, ...data.organization } : null);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur de mise à jour');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'general' as TabId, label: 'Informations Générales', icon: '⚙️' },
        { id: 'identity' as TabId, label: 'Identité Visuelle', icon: '🎨' },
        { id: 'documents' as TabId, label: 'Documents Obligatoires', icon: '📄' },
    ];

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
                                    Paramètres: {organization.name}
                                </h1>
                                <p className="text-sm text-slate-400">
                                    Configuration de l'organisme de formation
                                </p>
                            </div>
                        </div>

                        {saveSuccess && (
                            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Enregistré
                            </div>
                        )}
                    </div>
                </header>

                <div className="p-6 max-w-4xl mx-auto">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                        <Link href="/portfolio" className="hover:text-white transition-colors">
                            Tour de Contrôle
                        </Link>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-white">Paramètres Organisation</span>
                    </nav>

                    {/* Info Card */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-4">
                            {organization.logoUrl ? (
                                <img
                                    src={organization.logoUrl}
                                    alt="Logo"
                                    className="w-16 h-16 object-contain rounded-lg bg-white/5 p-2"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                            )}
                            <div>
                                <h2 className="text-lg font-medium text-white">{organization.name}</h2>
                                <p className="text-sm text-gray-400">
                                    {organization.type === 'CFA' ? 'Centre de Formation d\'Apprentis' :
                                        organization.type === 'OF_STANDARD' ? 'Organisme de Formation' :
                                            organization.type === 'BILAN' ? 'Bilan de Compétences' : 'VAE'}
                                </p>
                                {organization.responsableName && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Responsable: {organization.responsableName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Accès rapides */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <Link
                            href={`/organizations/${orgId}/sites`}
                            className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Sites</p>
                                <p className="text-xs text-gray-500">Gérer les campus</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-500 ml-auto group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>

                        <button
                            onClick={async () => {
                                await switchOrganization(orgId);
                                router.push('/users');
                            }}
                            className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-green-500/50 hover:bg-slate-800 transition-all group text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white group-hover:text-green-400 transition-colors">Utilisateurs</p>
                                <p className="text-xs text-gray-500">Gérer les accès</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-500 ml-auto group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <button
                            onClick={async () => {
                                await switchOrganization(orgId);
                                router.push('/dashboard/qualiopi');
                            }}
                            className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/50 hover:bg-slate-800 transition-all group text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">Qualiopi</p>
                                <p className="text-xs text-gray-500">Suivi & conformité</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-500 ml-auto group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                    ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }
                                `}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}

                    {/* ═══ INFORMATIONS GÉNÉRALES ═══ */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            {/* Nom de l'organisme */}
                            <div>
                                <label htmlFor="org-name" className="block text-sm font-medium text-gray-300 mb-1">Nom de l'organisme *</label>
                                <input
                                    id="org-name"
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Nom de l'organisme"
                                />
                            </div>

                            {/* Responsable */}
                            <div>
                                <label htmlFor="org-responsable" className="block text-sm font-medium text-gray-300 mb-1">Nom du responsable</label>
                                <input
                                    id="org-responsable"
                                    type="text"
                                    value={formData.responsableName}
                                    onChange={e => setFormData(prev => ({ ...prev, responsableName: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Jean Dupont"
                                />
                            </div>

                            {/* SIRET (lecture seule) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">SIRET</label>
                                <input
                                    type="text"
                                    value={organization.siret || ''}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-gray-500 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-500 mt-1">Le SIRET ne peut pas être modifié. Contactez le support si nécessaire.</p>
                            </div>

                            {/* NDA */}
                            <div>
                                <label htmlFor="org-nda" className="block text-sm font-medium text-gray-300 mb-1">Numéro de Déclaration d'Activité (NDA)</label>
                                <input
                                    id="org-nda"
                                    type="text"
                                    value={formData.ndaNumber}
                                    onChange={e => setFormData(prev => ({ ...prev, ndaNumber: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="11 75 xxxxx 75"
                                />
                            </div>

                            {/* Qualiopi */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        id="org-qualiopi"
                                        type="checkbox"
                                        checked={formData.qualiopiCertified}
                                        onChange={e => setFormData(prev => ({ ...prev, qualiopiCertified: e.target.checked }))}
                                        className="w-5 h-5 rounded border-gray-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                                    />
                                    <label htmlFor="org-qualiopi" className="text-sm font-medium text-gray-300">
                                        Certification Qualiopi obtenue
                                    </label>
                                </div>

                                {formData.qualiopiCertified && (
                                    <div>
                                        <label htmlFor="org-qualiopi-expiry" className="block text-sm font-medium text-gray-300 mb-1">
                                            Date d'expiration Qualiopi
                                        </label>
                                        <input
                                            id="org-qualiopi-expiry"
                                            type="date"
                                            value={formData.qualiopiExpiry}
                                            onChange={e => setFormData(prev => ({ ...prev, qualiopiExpiry: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        {formData.qualiopiExpiry && new Date(formData.qualiopiExpiry) < new Date() && (
                                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                Certification expirée — non-conformité !
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bouton Enregistrer */}
                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={handleSaveGeneral}
                                    disabled={saving || !formData.name}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Enregistrer les modifications
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══ IDENTITÉ VISUELLE ═══ */}
                    {activeTab === 'identity' && (
                        <div className="space-y-4">
                            <FileUploadField
                                label="Logo de l'organisation"
                                description="Apparaît sur les conventions, attestations et documents officiels"
                                currentUrl={organization.logoUrl}
                                accept="image/png,image/jpeg,image/svg+xml"
                                onUpload={(file) => handleUpload('logoUrl', file)}
                                isUploading={uploading === 'logoUrl'}
                            />

                            <FileUploadField
                                label="Signature électronique"
                                description="Signature du responsable pour les conventions et contrats"
                                currentUrl={organization.signatureUrl}
                                accept="image/png,image/jpeg"
                                onUpload={(file) => handleUpload('signatureUrl', file)}
                                isUploading={uploading === 'signatureUrl'}
                            />

                            <FileUploadField
                                label="Cachet de l'organisation"
                                description="Cachet officiel pour les documents administratifs"
                                currentUrl={organization.cachetUrl}
                                accept="image/png,image/jpeg"
                                onUpload={(file) => handleUpload('cachetUrl', file)}
                                isUploading={uploading === 'cachetUrl'}
                            />
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-amber-300">Documents obligatoires Qualiopi</p>
                                        <p className="text-xs text-amber-200/80 mt-1">
                                            Ces documents sont requis pour la conformité et seront joints automatiquement aux dossiers.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <FileUploadField
                                label="Conditions Générales de Vente (CGV)"
                                description="Applicables à toutes les formations et jointes aux conventions"
                                currentUrl={organization.cgvUrl}
                                accept="application/pdf"
                                onUpload={(file) => handleUpload('cgvUrl', file)}
                                isUploading={uploading === 'cgvUrl'}
                            />

                            <FileUploadField
                                label="Livret d'accueil"
                                description="Remis aux stagiaires avant le début de la formation"
                                currentUrl={organization.livretAccueilUrl}
                                accept="application/pdf"
                                onUpload={(file) => handleUpload('livretAccueilUrl', file)}
                                isUploading={uploading === 'livretAccueilUrl'}
                            />

                            <FileUploadField
                                label="Règlement intérieur"
                                description="Applicable à tous les stagiaires et formateurs"
                                currentUrl={organization.reglementInterieurUrl}
                                accept="application/pdf"
                                onUpload={(file) => handleUpload('reglementInterieurUrl', file)}
                                isUploading={uploading === 'reglementInterieurUrl'}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

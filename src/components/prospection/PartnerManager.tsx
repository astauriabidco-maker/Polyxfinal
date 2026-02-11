/**
 * PARTNER MANAGER - Composant client pour la gestion des partenaires
 * ===================================================================
 * Affiche la liste des partenaires API et permet d'en créer de nouveaux.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NetworkSettingsManager from './NetworkSettingsManager';

interface Partner {
    id: string;
    companyName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    siret: string | null;
    apiKeyPrefix: string;
    rateLimit: number;
    status: string;
    contractUrl: string | null;
    contractSignedAt: string | null;
    contractExpiresAt: string | null;
    dpaSignedAt: string | null;
    totalLeadsSubmitted: number;
    totalLeadsConverted: number;
    leadsCount: number;
    createdAt: string;
}

interface Props {
    partners: Partner[];
    isAdmin: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    'PENDING': { label: 'En attente', color: 'bg-amber-500/20 text-amber-400', icon: '⏳' },
    'ACTIVE': { label: 'Actif', color: 'bg-emerald-500/20 text-emerald-400', icon: '✅' },
    'SUSPENDED': { label: 'Suspendu', color: 'bg-orange-500/20 text-orange-400', icon: '⚠️' },
    'TERMINATED': { label: 'Résilié', color: 'bg-red-500/20 text-red-400', icon: '❌' },
};

export default function PartnerManager({ partners, isAdmin }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showModal, setShowModal] = useState(false);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [activeTab, setActiveTab] = useState<'partners' | 'settings'>('partners');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'settings') setActiveTab('settings');
        if (tab === 'partners') setActiveTab('partners');
    }, [searchParams]);

    const [formData, setFormData] = useState({
        companyName: '', contactName: '', contactEmail: '', contactPhone: '', siret: '',
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/partners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setNewApiKey(data.apiKey);
            setFormData({ companyName: '', contactName: '', contactEmail: '', contactPhone: '', siret: '' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async (partnerId: string, type: 'CONTRACT' | 'DPA') => {
        setLoading(true);
        try {
            const res = await fetch(`/api/partners/${partnerId}/documents/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentType: type }),
            });
            if (!res.ok) throw new Error('Erreur signature');
            router.refresh();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (partnerId: string, newStatus: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/partners/${partnerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.apiKey) {
                setNewApiKey(data.apiKey);
            }
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerateKey = async (partnerId: string) => {
        if (!confirm('Régénérer l\'API Key ? L\'ancienne ne fonctionnera plus.')) return;
        try {
            const res = await fetch(`/api/partners/${partnerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'regenerate-key' }),
            });
            const data = await res.json();
            if (res.ok) {
                setNewApiKey(data.apiKey);
            }
        } catch { }
    };

    const handleTerminate = async (partnerId: string) => {
        if (!confirm('Résilier ce partenariat ? L\'API Key sera désactivée.')) return;
        try {
            await fetch(`/api/partners/${partnerId}`, { method: 'DELETE' });
            router.refresh();
        } catch { }
    };

    const activePartners = partners.filter(p => p.status === 'ACTIVE').length;
    const totalLeads = partners.reduce((sum, p) => sum + p.totalLeadsSubmitted, 0);
    const totalConverted = partners.reduce((sum, p) => sum + p.totalLeadsConverted, 0);

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            {isAdmin && (
                <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-800 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('partners')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'partners' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        👥 Gestion Partenaires
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        ⚙️ Configuration Réseau
                    </button>
                </div>
            )}

            {activeTab === 'settings' ? (
                <NetworkSettingsManager />
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <p className="text-sm text-slate-400">Partenaires</p>
                            <p className="text-2xl font-bold text-white">{partners.length}</p>
                        </div>
                        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                            <p className="text-sm text-emerald-400">Actifs</p>
                            <p className="text-2xl font-bold text-emerald-300">{activePartners}</p>
                        </div>
                        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                            <p className="text-sm text-blue-400">Leads reçus</p>
                            <p className="text-2xl font-bold text-blue-300">{totalLeads}</p>
                        </div>
                        <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                            <p className="text-sm text-purple-400">Convertis</p>
                            <p className="text-2xl font-bold text-purple-300">{totalConverted}</p>
                        </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-white">Partenaires API</h2>
                        {isAdmin && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Nouveau partenaire
                            </button>
                        )}
                    </div>

                    {/* Partners Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {partners.map((partner) => {
                            const statusCfg = STATUS_CONFIG[partner.status] || STATUS_CONFIG['PENDING'];
                            const convRate = partner.totalLeadsSubmitted > 0
                                ? Math.round((partner.totalLeadsConverted / partner.totalLeadsSubmitted) * 100)
                                : 0;

                            return (
                                <div key={partner.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-colors">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-white">{partner.companyName}</h3>
                                                <p className="text-sm text-slate-400">{partner.contactName}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusCfg.color}`}>
                                                {statusCfg.icon} {statusCfg.label}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <span>📧</span>
                                                <span>{partner.contactEmail}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <span>🔑</span>
                                                <code className="bg-slate-700/50 px-2 py-0.5 rounded text-xs text-cyan-400">
                                                    {partner.apiKeyPrefix}...
                                                </code>
                                            </div>
                                            {partner.siret && (
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <span>🏢</span>
                                                    <span>SIRET: {partner.siret}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Metrics */}
                                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700/50">
                                            <div className="text-center">
                                                <p className="text-xs text-slate-500">Leads</p>
                                                <p className="text-lg font-medium text-white">{partner.totalLeadsSubmitted}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-slate-500">Convertis</p>
                                                <p className="text-lg font-medium text-emerald-400">{partner.totalLeadsConverted}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-slate-500">Conv. %</p>
                                                <p className="text-lg font-medium text-blue-400">{convRate}%</p>
                                            </div>
                                        </div>

                                        {/* Contract Status */}
                                        <div className="mt-4 pt-4 border-t border-slate-700/30 flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs flex items-center gap-2 ${partner.contractSignedAt ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {partner.contractSignedAt ? '✅ Contrat signé' : '⬜ Contrat en attente'}
                                                </span>
                                                {!partner.contractSignedAt && isAdmin && (
                                                    <button
                                                        onClick={() => handleSign(partner.id, 'CONTRACT')}
                                                        className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-white transition-colors"
                                                    >
                                                        Signer (Simulation)
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs flex items-center gap-2 ${partner.dpaSignedAt ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {partner.dpaSignedAt ? '✅ DPA signé (RGPD)' : '⬜ DPA manquant'}
                                                </span>
                                                {!partner.dpaSignedAt && isAdmin && (
                                                    <button
                                                        onClick={() => handleSign(partner.id, 'DPA')}
                                                        className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-white transition-colors"
                                                    >
                                                        Signer (Simulation)
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {isAdmin && partner.status !== 'TERMINATED' && (
                                        <div className="px-5 py-3 bg-slate-800/70 border-t border-slate-700/50 flex gap-2">
                                            {partner.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleStatusChange(partner.id, 'ACTIVE')}
                                                    className="text-xs text-emerald-400 hover:text-emerald-300"
                                                >
                                                    ✅ Activer
                                                </button>
                                            )}
                                            {partner.status === 'ACTIVE' && (
                                                <button
                                                    onClick={() => handleStatusChange(partner.id, 'SUSPENDED')}
                                                    className="text-xs text-amber-400 hover:text-amber-300"
                                                >
                                                    ⏸️ Suspendre
                                                </button>
                                            )}
                                            {partner.status === 'SUSPENDED' && (
                                                <button
                                                    onClick={() => handleStatusChange(partner.id, 'ACTIVE')}
                                                    className="text-xs text-emerald-400 hover:text-emerald-300"
                                                >
                                                    ▶️ Réactiver
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}/partners/onboarding/${partner.id}`;
                                                    navigator.clipboard.writeText(url);
                                                    alert('Lien d\'onboarding copié !');
                                                }}
                                                className="text-xs text-slate-400 hover:text-white"
                                                title="Copier le lien public d'onboarding"
                                            >
                                                🔗 Copier Lien
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateKey(partner.id)}
                                                className="text-xs text-cyan-400 hover:text-cyan-300"
                                            >
                                                🔄 Regen Key
                                            </button>
                                            <button
                                                onClick={() => handleTerminate(partner.id)}
                                                className="text-xs text-red-400 hover:text-red-300 ml-auto"
                                            >
                                                ❌ Résilier
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {partners.length === 0 && (
                        <div className="text-center py-16 text-slate-500">
                            <p className="text-5xl mb-3">🤝</p>
                            <p className="text-lg">Aucun partenaire API configuré</p>
                            <p className="text-sm mt-1">Créez votre premier partenaire pour commencer à recevoir des leads via API</p>
                        </div>
                    )}

                    {/* Create / API Key Modal */}
                    {(showModal || newApiKey) && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
                                {newApiKey ? (
                                    /* API Key Display */
                                    <div className="p-6">
                                        <div className="text-center mb-6">
                                            <p className="text-4xl mb-2">🔑</p>
                                            <h2 className="text-lg font-semibold text-white">API Key générée</h2>
                                            <p className="text-sm text-amber-400 mt-2">
                                                ⚠️ Copiez cette clé maintenant. Elle ne sera plus jamais affichée.
                                            </p>
                                        </div>
                                        <div className="bg-slate-900 rounded-lg p-4 mb-4">
                                            <code className="text-sm text-cyan-400 break-all select-all">{newApiKey}</code>
                                        </div>
                                        <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
                                            <p className="text-sm font-medium text-white mb-2">Usage (curl):</p>
                                            <code className="text-xs text-slate-300 break-all">
                                                {`curl -X POST /api/v1/leads \\
  -H "X-API-Key: ${newApiKey.substring(0, 20)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"email":"...", "nom":"...", "prenom":"...", "consentText":"..."}'`}
                                            </code>
                                        </div>
                                        <button
                                            onClick={() => { setNewApiKey(null); setShowModal(false); router.refresh(); }}
                                            className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600"
                                        >
                                            J&apos;ai copié la clé, fermer
                                        </button>
                                    </div>
                                ) : (
                                    /* Create Form */
                                    <>
                                        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                                            <h2 className="text-lg font-semibold text-white">Nouveau partenaire</h2>
                                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                                            {error && (
                                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
                                            )}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-400 mb-1">Raison sociale *</label>
                                                <input type="text" required value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-400 mb-1">Nom du contact *</label>
                                                    <input type="text" required value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-400 mb-1">Email *</label>
                                                    <input type="email" required value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-400 mb-1">Téléphone</label>
                                                    <input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-400 mb-1">SIRET</label>
                                                    <input type="text" value={formData.siret} onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                </div>
                                            </div>
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                                <p className="text-sm text-blue-400">
                                                    🔐 Une API Key sécurisée sera générée automatiquement. Le partenaire devra signer le contrat et le DPA (Data Processing Agreement) avant activation.
                                                </p>
                                            </div>
                                            <div className="flex justify-end gap-3 pt-2">
                                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Annuler</button>
                                                <button type="submit" disabled={loading}
                                                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50">
                                                    {loading ? 'Création...' : 'Créer le partenaire'}
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

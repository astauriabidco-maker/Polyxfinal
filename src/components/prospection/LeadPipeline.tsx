/**
 * LEAD PIPELINE - Composant client pour le pipeline de leads
 * ============================================================
 * Affiche la liste des leads avec filtres, actions, et modal de création.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Lead {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    source: string;
    status: string;
    score: number | null;
    notes: string | null;
    formationSouhaitee: string | null;
    codePostal: string | null;
    ville: string | null;
    campaign: { id: string; name: string; source: string } | null;
    partner: { id: string; companyName: string } | null;
    consent: { consentGiven: boolean; anonymizedAt: string | null } | null;
    createdAt: string;
}

interface Props {
    leads: Lead[];
    stats: {
        byStatus: Record<string, number>;
        bySource: Record<string, number>;
    };
    isAdmin: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    'NEW': { label: 'Nouveau', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '🆕' },
    'DISPATCHED': { label: 'Affecté', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', icon: '📨' },
    'ATTEMPTED': { label: 'Tentative', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '📞' },
    'CONTACTED': { label: 'Contacté', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: '🗣️' },
    'QUALIFIED': { label: 'Qualifié', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '⭐' },
    'RDV_SCHEDULED': { label: 'RDV Planifié', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '📅' },
    'NEGOTIATION': { label: 'Négociation', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: '🤝' },
    'CONVERTED': { label: 'Converti', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '✅' },
    'NURTURING': { label: 'A mûrir', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: '🌱' },
    'NOT_ELIGIBLE': { label: 'Non éligible', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '🚫' },
    'LOST': { label: 'Perdu', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: '❌' },
    'ARCHIVED': { label: 'Archivé', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: '📦' },
};

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
    'FACEBOOK_ADS': { label: 'Facebook', icon: '📘' },
    'TIKTOK_ADS': { label: 'TikTok', icon: '🎵' },
    'GOOGLE_ADS': { label: 'Google', icon: '🔍' },
    'LINKEDIN_ADS': { label: 'LinkedIn', icon: '💼' },
    'WEBSITE_FORM': { label: 'Site Web', icon: '🌐' },
    'PARTNER_API': { label: 'Partenaire', icon: '🤝' },
    'MANUAL': { label: 'Manuel', icon: '✍️' },
};

const STATUSES = [
    'NEW', 'DISPATCHED', 'ATTEMPTED', 'CONTACTED', 'QUALIFIED', 'RDV_SCHEDULED',
    'NEGOTIATION', 'CONVERTED', 'NURTURING', 'NOT_ELIGIBLE', 'LOST', 'ARCHIVED'
];

export default function LeadPipeline({ leads, stats, isAdmin }: Props) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [showDetailId, setShowDetailId] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        email: '', nom: '', prenom: '', telephone: '',
        formationSouhaitee: '', message: '', codePostal: '', ville: '',
    });

    const filteredLeads = filter
        ? leads.filter(l => l.status === filter)
        : leads;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, source: 'MANUAL' }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error);
            }
            setShowModal(false);
            setFormData({ email: '', nom: '', prenom: '', telephone: '', formationSouhaitee: '', message: '', codePostal: '', ville: '' });
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        try {
            await fetch(`/api/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            router.refresh();
        } catch { }
    };

    const handleAnonymize = async (leadId: string) => {
        if (!confirm('Anonymiser ce lead ? Cette action est irréversible (RGPD).')) return;
        try {
            await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
            router.refresh();
        } catch { }
    };

    const totalLeads = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
    const converted = stats.byStatus['CONVERTED'] || 0;
    const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

    return (
        <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <p className="text-sm text-slate-400">Total Leads</p>
                    <p className="text-2xl font-bold text-white">{totalLeads}</p>
                </div>
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                    <p className="text-sm text-emerald-400">Convertis</p>
                    <p className="text-2xl font-bold text-emerald-300">{converted}</p>
                </div>
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                    <p className="text-sm text-blue-400">Taux Conversion</p>
                    <p className="text-2xl font-bold text-blue-300">{conversionRate}%</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                    <p className="text-sm text-amber-400">En Négociation</p>
                    <p className="text-2xl font-bold text-amber-300">{stats.byStatus['NEGOTIATION'] || 0}</p>
                </div>
            </div>

            {/* Source Distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
                {Object.entries(stats.bySource).map(([source, count]) => (
                    <div key={source} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 text-center">
                        <span className="text-lg">{SOURCE_LABELS[source]?.icon || '📊'}</span>
                        <p className="text-xs text-slate-400 mt-1">{SOURCE_LABELS[source]?.label || source}</p>
                        <p className="text-lg font-semibold text-white">{count}</p>
                    </div>
                ))}
            </div>

            {/* Filter Bar + Actions */}
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setFilter('')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${!filter ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
                    >
                        Tous ({totalLeads})
                    </button>
                    {STATUSES.map(s => {
                        const count = stats.byStatus[s] || 0;
                        if (count === 0 && s !== 'NEW') return null;
                        const cfg = STATUS_LABELS[s];
                        return (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filter === s ? cfg.color + ' border' : 'text-slate-400 hover:text-white'}`}
                            >
                                {cfg.icon} {cfg.label} ({count})
                            </button>
                        );
                    })}
                </div>

                {isAdmin && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 whitespace-nowrap"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Nouveau lead
                    </button>
                )}
            </div>

            {/* Leads Table */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-800/70">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Prospect</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Source</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Formation</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Statut</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Score</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                            {isAdmin && (
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filteredLeads.map((lead) => {
                            const statusCfg = STATUS_LABELS[lead.status] || STATUS_LABELS['NEW'];
                            const sourceCfg = SOURCE_LABELS[lead.source] || { label: lead.source, icon: '📊' };
                            const isAnonymized = lead.consent?.anonymizedAt;

                            return (
                                <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-medium">
                                                {lead.prenom[0]}{lead.nom[0]}
                                            </div>
                                            <div>
                                                <p className={`font-medium ${isAnonymized ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                    {lead.prenom} {lead.nom}
                                                </p>
                                                <p className="text-xs text-slate-400">{lead.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-300">
                                            {sourceCfg.icon} {sourceCfg.label}
                                        </span>
                                        {lead.campaign && (
                                            <p className="text-xs text-slate-500 mt-0.5">{lead.campaign.name}</p>
                                        )}
                                        {lead.partner && (
                                            <p className="text-xs text-slate-500 mt-0.5">via {lead.partner.companyName}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-300">
                                            {lead.formationSouhaitee || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {isAdmin ? (
                                            <select
                                                value={lead.status}
                                                onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                                className={`px-2 py-1 rounded text-xs font-medium border bg-transparent cursor-pointer ${statusCfg.color}`}
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s} value={s} className="bg-slate-800 text-white">
                                                        {STATUS_LABELS[s].icon} {STATUS_LABELS[s].label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusCfg.color}`}>
                                                {statusCfg.icon} {statusCfg.label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {lead.score !== null ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-12 h-1.5 bg-slate-700 rounded-full">
                                                    <div
                                                        className={`h-full rounded-full ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${lead.score}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">{lead.score}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-slate-400">
                                            {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
                                        </span>
                                    </td>
                                    {isAdmin && (
                                        <td className="px-4 py-3 text-right">
                                            {!isAnonymized && (
                                                <button
                                                    onClick={() => handleAnonymize(lead.id)}
                                                    className="text-red-400 hover:text-red-300 text-xs"
                                                    title="RGPD : Anonymiser"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredLeads.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-4xl mb-2">📭</p>
                        <p>{filter ? 'Aucun lead avec ce statut' : 'Aucun lead pour le moment'}</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
                        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Nouveau lead</h2>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Prénom *</label>
                                    <input type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Nom *</label>
                                    <input type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Email *</label>
                                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Téléphone</label>
                                    <input type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Code Postal</label>
                                    <input type="text" value={formData.codePostal} onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Formation souhaitée</label>
                                <input type="text" value={formData.formationSouhaitee} onChange={(e) => setFormData({ ...formData, formationSouhaitee: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Message</label>
                                <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Annuler</button>
                                <button type="submit" disabled={loading}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50">
                                    {loading ? 'Création...' : 'Créer le lead'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

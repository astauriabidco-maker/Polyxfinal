/**
 * LEAD PIPELINE - Composant client : vue Kanban (défaut) + tableau
 * ==================================================================
 * Affiche les leads Pipeline avec KPIs, Kanban drag-and-drop,
 * et un mode tableau alternatif.
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, X, Phone, Mail, MessageSquare, Calendar, ChevronRight, MoreVertical, LayoutGrid, List as ListIcon } from 'lucide-react';
import CallCockpit from './CallCockpit';
import LeadTimeline from './LeadTimeline';

interface Lead {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    adresse: string | null;
    codePostal: string | null;
    ville: string | null;
    source: string;
    status: string;
    score: number | null;
    notes: string | null;
    formationSouhaitee: string | null;
    campaign: { id: string; name: string; source: string } | null;
    partner: { id: string; companyName: string } | null;
    site: { id: string; name: string } | null;
    assignedTo: { id: string; nom: string; prenom: string } | null;
    consent: { consentGiven: boolean; legalBasis: string | null; anonymizedAt: string | null } | null;
    createdAt: string;
}

interface Props {
    leads: Lead[];
    stats: {
        byStatus: Record<string, number>;
        bySource: Record<string, number>;
    };
    isAdmin: boolean;
    sites?: { id: string; name: string }[];
    commercials?: { id: string; nom: string; prenom: string }[];
    scripts?: { id: string; question: string; ordre: number; }[];
    programs?: { id: string; title: string; reference: string }[];
    mode?: 'pipeline' | 'my-leads';
    organizationType?: string;
}

// ─── Pipeline statuses only ──────────────────────────────────
const PIPELINE_STATUSES = ['NEW', 'A_RAPPELER', 'RDV_PLANIFIE', 'NE_REPONDS_PAS', 'PAS_INTERESSE'];
const MY_LEADS_STATUSES = ['NEW', 'A_RAPPELER', 'NE_REPONDS_PAS', 'PAS_INTERESSE'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgHeader: string; icon: string }> = {
    'NEW': { label: 'Nouveau', icon: '🆕', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', bgHeader: 'bg-blue-500/20 border-blue-500/40' },
    'DISPATCHED': { label: 'Affecté', icon: '📨', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', bgHeader: 'bg-indigo-500/20 border-indigo-500/40' },
    'A_RAPPELER': { label: 'A rappeler', icon: '📞', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', bgHeader: 'bg-yellow-500/20 border-yellow-500/40' },
    'NE_REPONDS_PAS': { label: 'Ne réponds pas', icon: '📵', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', bgHeader: 'bg-orange-500/20 border-orange-500/40' },
    'RDV_PLANIFIE': { label: 'RDV Planifié', icon: '📅', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', bgHeader: 'bg-purple-500/20 border-purple-500/40' },
    'PAS_INTERESSE': { label: 'Pas intéressé', icon: '🚫', color: 'bg-red-500/20 text-red-400 border-red-500/30', bgHeader: 'bg-red-500/20 border-red-500/40' },
};

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
    'FACEBOOK_ADS': { label: 'Facebook', icon: '📘' },
    'TIKTOK_ADS': { label: 'TikTok', icon: '🎵' },
    'GOOGLE_ADS': { label: 'Google', icon: '🔍' },
    'LINKEDIN_ADS': { label: 'LinkedIn', icon: '💼' },
    'WEBSITE_FORM': { label: 'Site Web', icon: '🌐' },
    'PARTNER_API': { label: 'Partenaire', icon: '🤝' },
    'MANUAL': { label: 'Manuel', icon: '✍️' },
    'CAMPAIGN': { label: 'Campagne', icon: '📣' },
    'REFERRAL': { label: 'Parrainage', icon: '👥' },
    'EVENT': { label: 'Événement', icon: '🎪' },
    'OTHER': { label: 'Autre', icon: '📊' },
};

// ─── Component ───────────────────────────────────────────────

export default function LeadPipeline({ leads, stats, isAdmin, sites = [], commercials = [], scripts = [], programs = [], mode = 'pipeline', organizationType = 'OF_STANDARD' }: Props) {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
    const [showModal, setShowModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [filter, setFilter] = useState<string>('');
    const [siteFilter, setSiteFilter] = useState<string>('ALL');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        email: '', nom: '', prenom: '', telephone: '',
        adresse: '', codePostal: '', ville: '',
        formationSouhaitee: '', message: '',
        siteId: '', assignedToId: '',
    });
    const [consentGiven, setConsentGiven] = useState(false);

    const filteredLeads = leads.filter(l => {
        const statusMatch = filter ? l.status === filter : true;
        const siteMatch = siteFilter === 'ALL' ? true : l.site?.id === siteFilter;
        return statusMatch && siteMatch;
    });

    const activeStatuses = mode === 'pipeline' ? PIPELINE_STATUSES : MY_LEADS_STATUSES;

    const totalLeads = leads.length; // Use actual filtered leads count or stats? Using leads.length is safer if we passed filtered leads
    // Re-calculate stats based on leads passed if 'my-leads' mode to be accurate?
    // stats prop contains DB aggregation.

    // In My-Leads mode, NEW count should include DISPATCHED
    const newLeads = mode === 'my-leads'
        ? (stats.byStatus['NEW'] || 0) + (stats.byStatus['DISPATCHED'] || 0)
        : stats.byStatus['NEW'] || 0;

    const aRappeler = stats.byStatus['A_RAPPELER'] || 0;
    const nrp = stats.byStatus['NE_REPONDS_PAS'] || 0;
    const pasInteresse = stats.byStatus['PAS_INTERESSE'] || 0;

    // ─── Handlers ────────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, source: 'MANUAL', consentGiven }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error);
            }
            setShowModal(false);
            setFormData({ email: '', nom: '', prenom: '', telephone: '', adresse: '', codePostal: '', ville: '', formationSouhaitee: '', message: '', siteId: '', assignedToId: '' });
            setConsentGiven(false);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = useCallback(async (leadId: string, newStatus: string) => {
        try {
            await fetch(`/api/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            router.refresh();
        } catch { }
    }, [router]);

    const handleAnonymize = async (leadId: string) => {
        if (!confirm('Anonymiser ce lead ? Cette action est irréversible (RGPD).')) return;
        try {
            await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
            router.refresh();
        } catch { }
    };

    // ─── Drag & Drop ─────────────────────────────────────────

    const onDragStart = (e: React.DragEvent, leadId: string) => {
        e.dataTransfer.setData('text/plain', leadId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
    };

    const onDragLeave = () => setDragOverColumn(null);

    const onDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        setDragOverColumn(null);
        const leadId = e.dataTransfer.getData('text/plain');
        if (leadId) {
            const lead = leads.find(l => l.id === leadId);
            if (lead && lead.status !== newStatus) {
                handleStatusChange(leadId, newStatus);
            }
        }
    };

    // ─── Kanban View ─────────────────────────────────────────

    const renderKanban = () => (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
            {activeStatuses.map(status => {
                const cfg = STATUS_CONFIG[status];

                let columnLeads = [];
                if (mode === 'my-leads' && status === 'NEW') {
                    columnLeads = filteredLeads.filter(l => l.status === 'NEW' || l.status === 'DISPATCHED');
                } else {
                    columnLeads = filteredLeads.filter(l => l.status === status);
                }

                const isDragOver = dragOverColumn === status;

                return (
                    <div
                        key={status}
                        className={`flex-shrink-0 w-72 rounded-xl border transition-all duration-200 flex flex-col ${isDragOver
                            ? 'border-cyan-500/60 bg-cyan-500/5 shadow-lg shadow-cyan-500/10'
                            : 'border-slate-700/50 bg-slate-800/30'
                            }`}
                        onDragOver={(e) => onDragOver(e, status)}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, status)}
                    >
                        {/* Column Header */}
                        <div className={`px-3 py-2.5 rounded-t-xl border-b ${cfg.bgHeader} flex items-center justify-between`}>
                            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                                {cfg.icon} {cfg.label}
                            </span>
                            <span className="text-xs font-medium bg-slate-900/40 text-slate-300 px-2 py-0.5 rounded-full">
                                {columnLeads.length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[600px]">
                            {columnLeads.length === 0 && (
                                <div className="text-center py-8 text-slate-500 text-xs">
                                    Glissez un lead ici
                                </div>
                            )}

                            {columnLeads.map(lead => {
                                const sourceCfg = SOURCE_LABELS[lead.source] || { label: lead.source, icon: '📊' };
                                return (
                                    <div
                                        key={lead.id}
                                        draggable={isAdmin}
                                        onDragStart={(e) => onDragStart(e, lead.id)}
                                        onClick={() => setSelectedLead(lead)}
                                        className="bg-slate-800/70 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group hover:shadow-md"
                                    >
                                        {/* Name + initials */}
                                        <div className="flex items-center gap-2.5 mb-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {lead.prenom[0]}{lead.nom[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {lead.prenom} {lead.nom}
                                                </p>
                                                <p className="text-xs text-slate-400 truncate">{lead.email}</p>
                                            </div>
                                        </div>

                                        {/* Formation */}
                                        {lead.formationSouhaitee && (
                                            <p className="text-xs text-cyan-400/80 mb-1.5 truncate">
                                                🎓 {lead.formationSouhaitee}
                                            </p>
                                        )}

                                        {/* Meta row */}
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>{sourceCfg.icon} {sourceCfg.label}</span>
                                            <span>{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</span>
                                        </div>

                                        {/* RGPD badge */}
                                        {lead.consent && (
                                            <div className="mt-1.5 flex items-center gap-1">
                                                {lead.consent.anonymizedAt ? (
                                                    <span className="text-xs text-slate-500">🔒 Anonymisé</span>
                                                ) : lead.consent.consentGiven ? (
                                                    <span className="text-xs text-emerald-500">✅ RGPD OK</span>
                                                ) : (
                                                    <span className="text-xs text-amber-400">⚠️ Consent ?</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Telephone */}
                                        {lead.telephone && (
                                            <a href={`tel:${lead.telephone}`} className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 flex items-center gap-1 transition-colors">
                                                📱 {lead.telephone}
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    // ─── Table View ──────────────────────────────────────────

    const renderTable = () => (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-800/70">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Prospect</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Formation</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Score</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">RGPD</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                        {isAdmin && (
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                    {filteredLeads.map((lead) => {
                        const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['NEW'];
                        const sourceCfg = SOURCE_LABELS[lead.source] || { label: lead.source, icon: '📊' };
                        const isAnonymized = lead.consent?.anonymizedAt;

                        return (
                            <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setSelectedLead(lead)}>
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
                                    <span className="text-sm text-slate-300">{sourceCfg.icon} {sourceCfg.label}</span>
                                    {lead.campaign && <p className="text-xs text-slate-500 mt-0.5">{lead.campaign.name}</p>}
                                    {lead.partner && <p className="text-xs text-slate-500 mt-0.5">via {lead.partner.companyName}</p>}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-slate-300">{lead.formationSouhaitee || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    {isAdmin ? (
                                        <select
                                            value={lead.status}
                                            onChange={(e) => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value); }}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`px-2 py-1 rounded text-xs font-medium border bg-transparent cursor-pointer ${statusCfg.color}`}
                                        >
                                            {activeStatuses.map(s => (
                                                <option key={s} value={s} className="bg-slate-800 text-white">
                                                    {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
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
                                <td className="px-4 py-3 text-center">
                                    {isAnonymized ? (
                                        <span title="Données anonymisées (RGPD Art.17)" className="cursor-help">🔒</span>
                                    ) : lead.consent?.consentGiven ? (
                                        <span title={`Consentement OK — ${lead.consent.legalBasis || 'Non spécifié'}`} className="cursor-help">✅</span>
                                    ) : (
                                        <span title="Consentement manquant" className="cursor-help text-amber-400">⚠️</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs text-slate-400">{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</span>
                                </td>
                                {isAdmin && (
                                    <td className="px-4 py-3 text-right">
                                        {!isAnonymized && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAnonymize(lead.id); }}
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
    );

    // ─── Lead Detail Slide-Over ──────────────────────────────

    const renderDetail = () => {
        if (!selectedLead) return null;
        const lead = selectedLead;
        const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['NEW'];
        const sourceCfg = SOURCE_LABELS[lead.source] || { label: lead.source, icon: '📊' };

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end" onClick={() => setSelectedLead(null)}>
                <div
                    className="w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto animate-slide-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-5 py-4 flex items-center justify-between z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                {lead.prenom[0]}{lead.nom[0]}
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">{lead.prenom} {lead.nom}</h3>
                                <p className="text-xs text-slate-400">{lead.email}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-white p-1">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-5 space-y-5">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Statut</span>
                            {isAdmin ? (
                                <select
                                    value={lead.status}
                                    onChange={(e) => { handleStatusChange(lead.id, e.target.value); setSelectedLead(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border bg-transparent cursor-pointer ${statusCfg.color}`}
                                >
                                    {activeStatuses.map(s => (
                                        <option key={s} value={s} className="bg-slate-800 text-white">
                                            {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${statusCfg.color}`}>
                                    {statusCfg.icon} {statusCfg.label}
                                </span>
                            )}
                        </div>

                        {/* Agence & Commercial */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">🏢 Agence</p>
                                <p className="text-sm text-white">{lead.site?.name || '— Non assignée'}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">👤 Commercial</p>
                                <p className="text-sm text-white">{lead.assignedTo ? `${lead.assignedTo.prenom} ${lead.assignedTo.nom}` : '— Non assigné'}</p>
                            </div>
                        </div>

                        {/* Adresse Postale */}
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                            <p className="text-xs text-slate-500 mb-1">📍 Adresse postale</p>
                            <p className="text-sm text-white">
                                {lead.adresse || lead.codePostal || lead.ville ? (
                                    <>
                                        {lead.adresse && <span>{lead.adresse}<br /></span>}
                                        {[lead.codePostal, lead.ville].filter(Boolean).join(' ')}
                                    </>
                                ) : '—'}
                            </p>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">Téléphone</p>
                                {lead.telephone ? (
                                    <a href={`tel:${lead.telephone}`} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                                        📞 {lead.telephone}
                                    </a>
                                ) : (
                                    <p className="text-sm text-white">—</p>
                                )}
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">Source</p>
                                <p className="text-sm text-white">{sourceCfg.icon} {sourceCfg.label}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">Formation</p>
                                <p className="text-sm text-white">{lead.formationSouhaitee || '—'}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">Date création</p>
                                <p className="text-sm text-white">{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">Score</p>
                                {lead.score !== null ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-700 rounded-full">
                                            <div
                                                className={`h-full rounded-full transition-all ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${lead.score}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium text-white">{lead.score}</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">— Non noté</p>
                                )}
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                <p className="text-xs text-slate-500 mb-0.5">RGPD</p>
                                <p className="text-sm">
                                    {lead.consent?.anonymizedAt ? (
                                        <span className="text-slate-500">🔒 Anonymisé</span>
                                    ) : lead.consent?.consentGiven ? (
                                        <span className="text-emerald-400">✅ Consentement OK</span>
                                    ) : (
                                        <span className="text-amber-400">⚠️ Manquant</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Campaign / Partner */}
                        {(lead.campaign || lead.partner) && (
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                {lead.campaign && (
                                    <p className="text-sm text-slate-300">📣 Campagne : <span className="text-white">{lead.campaign.name}</span></p>
                                )}
                                {lead.partner && (
                                    <p className="text-sm text-slate-300 mt-1">🤝 Partenaire : <span className="text-white">{lead.partner.companyName}</span></p>
                                )}
                            </div>
                        )}

                        {/* Notes */}
                        {lead.notes && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-2">📝 Notes</h4>
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{lead.notes}</pre>
                                </div>
                            </div>
                        )}

                        {/* Call Cockpit */}
                        <CallCockpit
                            leadId={selectedLead.id}
                            phone={selectedLead.telephone}
                            leadName={`${selectedLead.prenom} ${selectedLead.nom}`}
                            scripts={scripts}
                            onClose={() => setSelectedLead(null)}
                            onStatusChange={() => {
                                // Simple refresh or optimistic update
                                router.refresh();
                            }}
                        />

                        {/* Timeline */}
                        <div className="pt-4 border-t border-slate-700/50">
                            <LeadTimeline leadId={lead.id} />
                        </div>

                        {/* Actions */}
                        {isAdmin && !lead.consent?.anonymizedAt && (
                            <button
                                onClick={() => { handleAnonymize(lead.id); setSelectedLead(null); }}
                                className="w-full py-2 mt-2 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 text-sm transition-colors"
                            >
                                🗑️ Anonymiser (RGPD)
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ─── Render ──────────────────────────────────────────────

    return (
        <>
            {/* Mode Badge */}
            <div className="flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-2">
                    {organizationType === 'CFA' ? (
                        <div className="bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/20 flex items-center gap-2 shadow-sm shadow-purple-500/5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                            Workflow Apprentissage (CFA)
                        </div>
                    ) : (
                        <div className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-500/20 flex items-center gap-2 shadow-sm shadow-blue-500/5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Workflow Organisme de Formation (OF)
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <p className="text-sm text-slate-400">Total Pipeline</p>
                    <p className="text-2xl font-bold text-white">{totalLeads}</p>
                </div>
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                    <p className="text-sm text-blue-400">🆕 Nouveaux</p>
                    <p className="text-2xl font-bold text-blue-300">{newLeads}</p>
                </div>
                <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                    <p className="text-sm text-yellow-400">📞 A rappeler</p>
                    <p className="text-2xl font-bold text-yellow-300">{aRappeler}</p>
                </div>
                <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
                    <p className="text-sm text-orange-400">📵 NRP</p>
                    <p className="text-2xl font-bold text-orange-300">{nrp}</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                    <p className="text-sm text-red-400">🚫 Pas intéressé</p>
                    <p className="text-2xl font-bold text-red-300">{pasInteresse}</p>
                </div>
            </div>

            {/* Source Distribution */}
            {Object.keys(stats.bySource).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
                    {Object.entries(stats.bySource).map(([source, count]) => (
                        <div key={source} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 text-center">
                            <span className="text-lg">{SOURCE_LABELS[source]?.icon || '📊'}</span>
                            <p className="text-xs text-slate-400 mt-1">{SOURCE_LABELS[source]?.label || source}</p>
                            <p className="text-lg font-semibold text-white">{count}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* View Toggle + Actions */}
            <div className="flex items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'kanban'
                            ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        ▦ Kanban
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'table'
                            ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        ☰ Tableau
                    </button>

                    {/* Site Filter (Added) */}
                    {sites.length > 0 && (
                        <select
                            value={siteFilter}
                            onChange={(e) => setSiteFilter(e.target.value)}
                            className="bg-transparent text-slate-300 text-sm font-medium focus:outline-none focus:text-white px-2 border-l border-slate-700/50"
                        >
                            <option value="ALL" className="bg-slate-800">Tous les sites</option>
                            {sites.map(s => (
                                <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Table filter (only in table mode) */}
                {viewMode === 'table' && (
                    <div className="flex gap-2 flex-wrap flex-1 justify-center">
                        <button
                            onClick={() => setFilter('')}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${!filter ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
                        >
                            Tous ({filteredLeads.length})
                        </button>
                        {activeStatuses.map(s => {
                            const count = stats.byStatus[s] || 0;
                            const cfg = STATUS_CONFIG[s];
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
                )}

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

            {/* Main Content */}
            {viewMode === 'kanban' ? renderKanban() : renderTable()}

            {/* Detail Slide-Over */}
            {renderDetail()}

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
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Téléphone</label>
                                <input type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Adresse (rue)</label>
                                <input type="text" value={formData.adresse} onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                                    placeholder="12 rue de la Formation"
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Code Postal</label>
                                    <input type="text" value={formData.codePostal} onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Ville</label>
                                    <input type="text" value={formData.ville} onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">🏢 Agence</label>
                                    <select value={formData.siteId} onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                        <option value="" className="bg-slate-800">— Auto (zonage CP)</option>
                                        {sites.map(s => (
                                            <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">👤 Commercial</label>
                                    <select value={formData.assignedToId} onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                        <option value="" className="bg-slate-800">— Non assigné</option>
                                        {commercials.map(c => (
                                            <option key={c.id} value={c.id} className="bg-slate-800">{c.prenom} {c.nom}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Formation souhaitée</label>
                                <select
                                    value={formData.formationSouhaitee}
                                    onChange={(e) => setFormData({ ...formData, formationSouhaitee: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="" className="bg-slate-800">— Sélectionner une formation</option>
                                    {programs.map(p => (
                                        <option key={p.id} value={p.title} className="bg-slate-800">
                                            {p.title} ({p.reference})
                                        </option>
                                    ))}
                                    <option value="AUTRE" className="bg-slate-800">Autre / Sur mesure</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Message</label>
                                <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                                <input
                                    type="checkbox"
                                    id="consent"
                                    checked={consentGiven}
                                    onChange={(e) => setConsentGiven(e.target.checked)}
                                    className="mt-1 h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-slate-600 rounded bg-slate-700"
                                    required
                                />
                                <label htmlFor="consent" className="text-sm text-slate-300">
                                    <span className="font-medium text-white">Consentement RGPD *</span><br />
                                    Je confirme avoir recueilli le consentement explicite de cette personne pour le traitement de ses données personnelles.
                                </label>
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

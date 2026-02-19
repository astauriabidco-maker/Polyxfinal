'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';

// ─── Types ────────────────────────────────────────────────────

interface Broadcast {
    id: string;
    name: string;
    description: string | null;
    channel: string;
    templateKey: string | null;
    content: string | null;
    filters: string;
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    _count: { recipients: number };
}

interface Segment {
    sessions: { id: string; label: string; site: string; count: number }[];
    sites: { id: string; label: string; count: number }[];
    tags: { tag: string; count: number }[];
}

interface Progress {
    id: string;
    name: string;
    status: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    progress: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
}

const STATUS_LABELS: Record<string, { icon: string; label: string; color: string }> = {
    DRAFT: { icon: '📝', label: 'Brouillon', color: 'text-slate-400 bg-slate-800' },
    SENDING: { icon: '📤', label: 'Envoi en cours', color: 'text-blue-400 bg-blue-500/10' },
    PAUSED: { icon: '⏸️', label: 'Pausé', color: 'text-amber-400 bg-amber-500/10' },
    COMPLETED: { icon: '✅', label: 'Terminé', color: 'text-green-400 bg-green-500/10' },
    FAILED: { icon: '❌', label: 'Échoué', color: 'text-red-400 bg-red-500/10' },
    CANCELLED: { icon: '🚫', label: 'Annulé', color: 'text-slate-500 bg-slate-800' },
};

const DOSSIER_STATUSES = [
    { value: 'ADMIS', label: 'Admis' },
    { value: 'CONTRACTUALISE', label: 'Contractualisé' },
    { value: 'ACTIF', label: 'Actif' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINE', label: 'Terminé' },
];

// ─── Main Page Component ─────────────────────────────────────

export default function BroadcastsPage() {
    const [activeTab, setActiveTab] = useState<'broadcasts' | 'segments'>('broadcasts');
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [segments, setSegments] = useState<Segment | null>(null);
    const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    // Wizard state
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardData, setWizardData] = useState({
        name: '',
        sessionId: '',
        siteId: '',
        status: [] as string[],
        formation: '',
        selectedTags: [] as string[],
        content: '',
        templateKey: '',
        channel: 'WHATSAPP',
    });
    const [recipientPreview, setRecipientPreview] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Progress tracking
    const [trackingId, setTrackingId] = useState<string | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);

    // New tag input
    const [newTag, setNewTag] = useState('');

    const loadData = useCallback(async () => {
        try {
            const [bRes, sRes, tRes] = await Promise.all([
                fetch('/api/messaging/broadcasts'),
                fetch('/api/messaging/segments'),
                fetch('/api/messaging/tags'),
            ]);
            const [bData, sData, tData] = await Promise.all([bRes.json(), sRes.json(), tRes.json()]);
            setBroadcasts(bData.broadcasts || []);
            setSegments(sData.segments || null);
            setTags(tData.tags || []);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Progress polling
    useEffect(() => {
        if (!trackingId) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/messaging/broadcasts/${trackingId}/progress`);
                const data = await res.json();
                setProgress(data.progress);
                if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(data.progress?.status)) {
                    clearInterval(interval);
                    loadData();
                }
            } catch { /* ignore */ }
        }, 2000);
        return () => clearInterval(interval);
    }, [trackingId, loadData]);

    // Preview recipient count
    const previewRecipients = async () => {
        try {
            const filters: any = {};
            if (wizardData.sessionId) filters.sessionId = wizardData.sessionId;
            if (wizardData.siteId) filters.siteId = wizardData.siteId;
            if (wizardData.status.length) filters.status = wizardData.status;
            if (wizardData.formation) filters.formation = wizardData.formation;
            if (wizardData.selectedTags.length) filters.tags = wizardData.selectedTags;

            // Use the broadcast create to get count (but don't actually create yet)
            setRecipientPreview(-1); // loading
            const res = await fetch('/api/messaging/segments');
            const data = await res.json();
            // Estimate based on session/site selection
            let count = 0;
            if (filters.sessionId && data.segments?.sessions) {
                const s = data.segments.sessions.find((x: any) => x.id === filters.sessionId);
                if (s) count = s.count;
            } else if (filters.siteId && data.segments?.sites) {
                const s = data.segments.sites.find((x: any) => x.id === filters.siteId);
                if (s) count = s.count;
            }
            setRecipientPreview(count || 0);
        } catch {
            setRecipientPreview(0);
        }
    };

    const createAndLaunch = async () => {
        setSaving(true);
        try {
            const filters: any = {};
            if (wizardData.sessionId) filters.sessionId = wizardData.sessionId;
            if (wizardData.siteId) filters.siteId = wizardData.siteId;
            if (wizardData.status.length) filters.status = wizardData.status;
            if (wizardData.formation) filters.formation = wizardData.formation;
            if (wizardData.selectedTags.length) filters.tags = wizardData.selectedTags;

            // 1. Create broadcast
            const createRes = await fetch('/api/messaging/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: wizardData.name,
                    content: wizardData.content || null,
                    templateKey: wizardData.templateKey || null,
                    channel: wizardData.channel,
                    filters,
                }),
            });
            const createData = await createRes.json();

            if (!createRes.ok) {
                alert(createData.error || 'Erreur de création');
                return;
            }

            // 2. Start broadcast
            const startRes = await fetch(`/api/messaging/broadcasts/${createData.broadcast.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' }),
            });

            if (startRes.ok) {
                setTrackingId(createData.broadcast.id);
                setShowWizard(false);
                setWizardStep(1);
                setWizardData({ name: '', sessionId: '', siteId: '', status: [], formation: '', selectedTags: [], content: '', templateKey: '', channel: 'WHATSAPP' });
                loadData();
            }
        } catch (err) {
            console.error('Broadcast failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const startBroadcast = async (id: string) => {
        await fetch(`/api/messaging/broadcasts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start' }),
        });
        setTrackingId(id);
        loadData();
    };

    const cancelBroadcast = async (id: string) => {
        await fetch(`/api/messaging/broadcasts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel' }),
        });
        loadData();
    };

    const deleteBroadcast = async (id: string) => {
        if (!confirm('Supprimer ce broadcast ?')) return;
        await fetch(`/api/messaging/broadcasts/${id}`, { method: 'DELETE' });
        loadData();
    };

    const addTag = async () => {
        if (!newTag.trim()) return;
        // Tag is created when applied to a lead, for now just show it
        setNewTag('');
    };

    const deleteTag = async (tag: string) => {
        if (!confirm(`Supprimer le tag "${tag}" pour tous les contacts ?`)) return;
        await fetch(`/api/messaging/tags?tag=${encodeURIComponent(tag)}`, { method: 'DELETE' });
        loadData();
    };

    const toggleStatus = (status: string) => {
        setWizardData(prev => ({
            ...prev,
            status: prev.status.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...prev.status, status],
        }));
    };

    const toggleTag = (tag: string) => {
        setWizardData(prev => ({
            ...prev,
            selectedTags: prev.selectedTags.includes(tag)
                ? prev.selectedTags.filter(t => t !== tag)
                : [...prev.selectedTags, tag],
        }));
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
            <Sidebar />
            <main className="flex-1 ml-64 text-white">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-bold">📢 Broadcasts</h1>
                            <p className="text-sm text-slate-400 mt-1">Envois groupés et segmentation des contacts</p>
                        </div>
                        <a href="/messaging" className="px-3 py-2 text-sm text-slate-400 hover:text-white bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors">
                            ← Retour Messagerie
                        </a>
                    </div>

                    {/* Progress Tracker */}
                    {progress && (progress.status === 'SENDING' || progress.status === 'PAUSED') && (
                        <div className="mb-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold">📤 {progress.name}</h3>
                                <span className="text-xs text-blue-400">{progress.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
                                    style={{ width: `${progress.progress}%` }} />
                            </div>
                            <div className="flex gap-4 text-xs text-slate-400">
                                <span>⏳ {progress.pending} en attente</span>
                                <span>✅ {progress.sent} envoyés</span>
                                <span>📬 {progress.delivered} délivrés</span>
                                <span>❌ {progress.failed} échoués</span>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800/40 border border-slate-700/30 rounded-xl p-1 mb-6">
                        {[
                            { id: 'broadcasts' as const, label: '📢 Broadcasts', desc: 'Campagnes d\'envoi groupé' },
                            { id: 'segments' as const, label: '🏷️ Segmentation', desc: 'Groupes et tags' },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-slate-700/60 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                <span className="block">{tab.label}</span>
                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{tab.desc}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                        {/* ─── Broadcasts Tab ────────────────────── */}
                        {activeTab === 'broadcasts' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-400">Envoyer un message à un groupe de contacts</p>
                                    <button onClick={() => { setShowWizard(true); setWizardStep(1); }}
                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg transition-colors">
                                        + Nouveau Broadcast
                                    </button>
                                </div>

                                {/* Wizard Modal */}
                                {showWizard && (
                                    <div className="p-5 bg-slate-800/70 border border-orange-500/20 rounded-xl space-y-4">
                                        {/* Step Indicators */}
                                        <div className="flex items-center gap-2 mb-4">
                                            {[1, 2, 3].map(step => (
                                                <div key={step} className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep >= step ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'
                                                        }`}>{step}</div>
                                                    <span className="text-xs text-slate-400 hidden sm:inline">
                                                        {step === 1 ? 'Audience' : step === 2 ? 'Message' : 'Lancer'}
                                                    </span>
                                                    {step < 3 && <div className="w-8 h-px bg-slate-700" />}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Step 1: Audience */}
                                        {wizardStep === 1 && (
                                            <div className="space-y-3">
                                                <input value={wizardData.name} onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                                                    placeholder="Nom de la campagne" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] text-slate-500 uppercase">Session</label>
                                                        <select value={wizardData.sessionId} onChange={e => setWizardData({ ...wizardData, sessionId: e.target.value })}
                                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                                            <option value="">Toutes les sessions</option>
                                                            {segments?.sessions.map(s => (
                                                                <option key={s.id} value={s.id}>{s.label} ({s.count})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-slate-500 uppercase">Site</label>
                                                        <select value={wizardData.siteId} onChange={e => setWizardData({ ...wizardData, siteId: e.target.value })}
                                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                                            <option value="">Tous les sites</option>
                                                            {segments?.sites.map(s => (
                                                                <option key={s.id} value={s.id}>{s.label} ({s.count})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase">Statuts dossier</label>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {DOSSIER_STATUSES.map(s => (
                                                            <button key={s.value} onClick={() => toggleStatus(s.value)}
                                                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${wizardData.status.includes(s.value)
                                                                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                                                                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                                                                    }`}>{s.label}</button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {tags.length > 0 && (
                                                    <div>
                                                        <label className="text-[10px] text-slate-500 uppercase">Tags</label>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {tags.map(t => (
                                                                <button key={t.tag} onClick={() => toggleTag(t.tag)}
                                                                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${wizardData.selectedTags.includes(t.tag)
                                                                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                                                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                                                                        }`}>🏷️ {t.tag} ({t.count})</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <input value={wizardData.formation} onChange={e => setWizardData({ ...wizardData, formation: e.target.value })}
                                                    placeholder="Filtrer par formation (recherche partielle)" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />

                                                <div className="flex justify-between items-center">
                                                    <button onClick={previewRecipients} className="text-xs text-orange-400 hover:text-orange-300">
                                                        📊 Estimer les destinataires
                                                    </button>
                                                    {recipientPreview !== null && recipientPreview >= 0 && (
                                                        <span className="text-xs text-slate-400">≈ {recipientPreview} destinataires</span>
                                                    )}
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setShowWizard(false)} className="px-4 py-2 text-sm text-slate-400">Annuler</button>
                                                    <button onClick={() => setWizardStep(2)} disabled={!wizardData.name}
                                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg disabled:opacity-30">
                                                        Suivant →
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 2: Message */}
                                        {wizardStep === 2 && (
                                            <div className="space-y-3">
                                                <select value={wizardData.channel} onChange={e => setWizardData({ ...wizardData, channel: e.target.value })}
                                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                                    <option value="WHATSAPP">WhatsApp</option>
                                                    <option value="SMS">SMS</option>
                                                </select>

                                                <input value={wizardData.templateKey} onChange={e => setWizardData({ ...wizardData, templateKey: e.target.value })}
                                                    placeholder="Template Meta (optionnel, ex: rappel_session)"
                                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />

                                                <textarea value={wizardData.content} onChange={e => setWizardData({ ...wizardData, content: e.target.value })}
                                                    placeholder="Message libre (si pas de template)... Variables: {nom}, {prenom}, {formation}"
                                                    rows={4} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none" />

                                                <div className="flex justify-between">
                                                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-sm text-slate-400">← Retour</button>
                                                    <button onClick={() => setWizardStep(3)} disabled={!wizardData.content && !wizardData.templateKey}
                                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg disabled:opacity-30">
                                                        Suivant →
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 3: Confirm & Launch */}
                                        {wizardStep === 3 && (
                                            <div className="space-y-3">
                                                <div className="p-3 bg-slate-900/50 rounded-lg space-y-2">
                                                    <p className="text-sm font-semibold text-white">📢 {wizardData.name}</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                                        <span>Canal: {wizardData.channel}</span>
                                                        <span>Session: {wizardData.sessionId ? segments?.sessions.find(s => s.id === wizardData.sessionId)?.label : 'Toutes'}</span>
                                                        <span>Site: {wizardData.siteId ? segments?.sites.find(s => s.id === wizardData.siteId)?.label : 'Tous'}</span>
                                                        <span>Statuts: {wizardData.status.length ? wizardData.status.join(', ') : 'Tous'}</span>
                                                    </div>
                                                    {wizardData.content && (
                                                        <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs text-slate-300">
                                                            💬 {wizardData.content}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                                                    ⚠️ Le broadcast sera lancé immédiatement. Les messages seront envoyés un par un (~1/sec).
                                                </div>

                                                <div className="flex justify-between">
                                                    <button onClick={() => setWizardStep(2)} className="px-4 py-2 text-sm text-slate-400">← Retour</button>
                                                    <button onClick={createAndLaunch} disabled={saving}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg disabled:opacity-30">
                                                        {saving ? '🔄 Lancement...' : '🚀 Lancer le Broadcast'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Loading */}
                                {loading && (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full" />
                                    </div>
                                )}

                                {/* Empty */}
                                {!loading && broadcasts.length === 0 && !showWizard && (
                                    <div className="text-center py-12">
                                        <p className="text-4xl mb-2">📢</p>
                                        <p className="text-sm text-slate-400">Aucun broadcast envoyé</p>
                                        <p className="text-xs text-slate-600 mt-1">Créez votre première campagne d&apos;envoi groupé</p>
                                    </div>
                                )}

                                {/* Broadcast List */}
                                <div className="space-y-2">
                                    {broadcasts.map(bc => {
                                        const st = STATUS_LABELS[bc.status] || STATUS_LABELS.DRAFT;
                                        const pct = bc.totalRecipients > 0 ? Math.round(((bc.sentCount + bc.failedCount) / bc.totalRecipients) * 100) : 0;
                                        return (
                                            <div key={bc.id} className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-semibold text-white">{bc.name}</h3>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.color}`}>
                                                                {st.icon} {st.label}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            {bc.totalRecipients} destinataires • {bc.sentCount} envoyés • {bc.deliveredCount} délivrés • {bc.failedCount} échoués
                                                        </p>
                                                        {bc.status === 'SENDING' && (
                                                            <div className="w-48 h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-slate-600 mt-1">{formatDate(bc.createdAt)}</p>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {bc.status === 'DRAFT' && (
                                                            <button onClick={() => startBroadcast(bc.id)}
                                                                className="px-3 py-1.5 text-xs bg-green-600/80 hover:bg-green-500 text-white rounded-lg">
                                                                ▶ Lancer
                                                            </button>
                                                        )}
                                                        {bc.status === 'SENDING' && (
                                                            <button onClick={() => cancelBroadcast(bc.id)}
                                                                className="px-3 py-1.5 text-xs bg-red-600/80 hover:bg-red-500 text-white rounded-lg">
                                                                ⏹ Stop
                                                            </button>
                                                        )}
                                                        {['DRAFT', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(bc.status) && (
                                                            <button onClick={() => deleteBroadcast(bc.id)}
                                                                className="p-1.5 text-slate-500 hover:text-red-400">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ─── Segments Tab ──────────────────────── */}
                        {activeTab === 'segments' && (
                            <div className="space-y-6">
                                {/* Dynamic Segments: Sessions */}
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-3">📅 Segments par session</h3>
                                    {segments?.sessions.length ? (
                                        <div className="space-y-1">
                                            {segments.sessions.map(s => (
                                                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                                                    <div>
                                                        <p className="text-sm text-white">{s.label}</p>
                                                        <p className="text-[10px] text-slate-500">{s.site}</p>
                                                    </div>
                                                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">{s.count} apprenants</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-xs text-slate-500">Aucune session active</p>}
                                </div>

                                {/* Dynamic Segments: Sites */}
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-3">🏢 Segments par site</h3>
                                    {segments?.sites.length ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {segments.sites.map(s => (
                                                <div key={s.id} className="p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg text-center">
                                                    <p className="text-sm text-white">{s.label}</p>
                                                    <p className="text-xs text-slate-400">{s.count} dossiers</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-xs text-slate-500">Aucun site configuré</p>}
                                </div>

                                {/* Tags */}
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-3">🏷️ Tags personnalisés</h3>
                                    <div className="flex items-center gap-2 mb-3">
                                        <input value={newTag} onChange={e => setNewTag(e.target.value)}
                                            placeholder="Nouveau tag..." onKeyDown={e => e.key === 'Enter' && addTag()}
                                            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                                        <button onClick={addTag} disabled={!newTag.trim()}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg disabled:opacity-30">
                                            + Créer
                                        </button>
                                    </div>

                                    {tags.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map(t => (
                                                <div key={t.tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
                                                    <span className="text-xs text-purple-300">🏷️ {t.tag}</span>
                                                    <span className="text-[10px] text-slate-500">({t.count})</span>
                                                    <button onClick={() => deleteTag(t.tag)} className="text-slate-500 hover:text-red-400 text-[10px] ml-1">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-xs text-slate-500">Aucun tag créé. Les tags sont appliqués aux leads pour créer des segments ciblés.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

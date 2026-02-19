'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Event Metadata ──────────────────────────────────────────

const EVENT_METADATA: Record<string, { icon: string; label: string; desc: string }> = {
    INSCRIPTION_CONFIRMED: { icon: '✅', label: 'Inscription confirmée', desc: 'Dossier validé (ADMIS)' },
    SESSION_J7: { icon: '📅', label: 'J-7 avant formation', desc: '7 jours avant la session' },
    SESSION_J1: { icon: '⏰', label: 'J-1 avant formation', desc: 'Veille de la session' },
    ABSENCE_DETECTED: { icon: '❌', label: 'Absence détectée', desc: 'Stagiaire non présent' },
    MODULE_COMPLETED: { icon: '🎓', label: 'Module terminé', desc: 'Dossier → TERMINÉ' },
    SIGNATURE_MISSING: { icon: '✍️', label: 'Signature manquante', desc: 'Émargement non signé > 24h' },
    SESSION_J1_POST: { icon: '📋', label: 'J+1 post-formation', desc: '1 jour après la fin de session' },
    DOSSIER_STATUS_CHANGE: { icon: '🔄', label: 'Changement statut', desc: 'Tout changement de phase dossier' },
    LEAD_CREATED: { icon: '🆕', label: 'Nouveau lead', desc: 'Lead créé dans le pipeline' },
    LEAD_QUALIFIED: { icon: '⭐', label: 'Lead qualifié', desc: 'Lead → statut QUALIFIED' },
};

// ─── Types ────────────────────────────────────────────────────

interface Automation {
    id: string;
    name: string;
    description: string | null;
    event: string;
    isActive: boolean;
    channel: string;
    templateKey: string | null;
    content: string | null;
    delayMinutes: number;
    conditions: string | null;
    createdAt: string;
    _count: { scheduledMessages: number };
}

// ─── Component ───────────────────────────────────────────────

interface Props {
    onRefresh?: () => void;
}

export default function AutomationList({ onRefresh }: Props) {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Create form state
    const [form, setForm] = useState({
        name: '',
        event: 'INSCRIPTION_CONFIRMED',
        content: '',
        delayMinutes: 0,
        channel: 'WHATSAPP',
        templateKey: '',
    });
    const [saving, setSaving] = useState(false);

    const loadAutomations = useCallback(async () => {
        try {
            const res = await fetch('/api/messaging/automations');
            const data = await res.json();
            setAutomations(data.automations || []);
        } catch (err) {
            console.error('Failed to load automations:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAutomations(); }, [loadAutomations]);

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            await fetch(`/api/messaging/automations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });
            setAutomations(prev =>
                prev.map(a => a.id === id ? { ...a, isActive: !isActive } : a)
            );
        } catch (err) {
            console.error('Toggle failed:', err);
        }
    };

    const deleteAutomation = async (id: string) => {
        if (!confirm('Supprimer cette automation ?')) return;
        try {
            await fetch(`/api/messaging/automations/${id}`, { method: 'DELETE' });
            setAutomations(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const createAutomation = async () => {
        if (!form.name || !form.content) return;
        setSaving(true);
        try {
            const res = await fetch('/api/messaging/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    templateKey: form.templateKey || null,
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setForm({ name: '', event: 'INSCRIPTION_CONFIRMED', content: '', delayMinutes: 0, channel: 'WHATSAPP', templateKey: '' });
                loadAutomations();
                onRefresh?.();
            }
        } catch (err) {
            console.error('Create failed:', err);
        } finally {
            setSaving(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    Déclencher des messages automatiques sur les événements du parcours
                </p>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                    + Nouvelle Automation
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Nom (ex: Bienvenue inscription)"
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                        <select
                            value={form.event}
                            onChange={e => setForm({ ...form, event: e.target.value })}
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            {Object.entries(EVENT_METADATA).map(([key, meta]) => (
                                <option key={key} value={key}>{meta.icon} {meta.label}</option>
                            ))}
                        </select>
                    </div>

                    <textarea
                        value={form.content}
                        onChange={e => setForm({ ...form, content: e.target.value })}
                        placeholder="Message (variables: {nom}, {prenom}, {formation}, {dateDebut}, {lieuFormation})"
                        rows={3}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none"
                    />

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase">Délai (minutes)</label>
                            <input
                                type="number"
                                value={form.delayMinutes}
                                onChange={e => setForm({ ...form, delayMinutes: parseInt(e.target.value) || 0 })}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase">Canal</label>
                            <select
                                value={form.channel}
                                onChange={e => setForm({ ...form, channel: e.target.value })}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="SMS">SMS</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase">Template (optionnel)</label>
                            <input
                                value={form.templateKey}
                                onChange={e => setForm({ ...form, templateKey: e.target.value })}
                                placeholder="nom_template"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
                            Annuler
                        </button>
                        <button
                            onClick={createAutomation}
                            disabled={!form.name || !form.content || saving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors disabled:opacity-30"
                        >
                            {saving ? 'Enregistrement...' : 'Créer'}
                        </button>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full"></div>
                </div>
            )}

            {/* Empty */}
            {!loading && automations.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-4xl mb-2">⚡</p>
                    <p className="text-sm text-slate-400">Aucune automation configurée</p>
                    <p className="text-xs text-slate-600 mt-1">Créez votre première automation pour envoyer des messages automatiques</p>
                </div>
            )}

            {/* Automation Cards */}
            <div className="space-y-2">
                {automations.map(auto => {
                    const meta = EVENT_METADATA[auto.event] || { icon: '📨', label: auto.event, desc: '' };
                    return (
                        <div
                            key={auto.id}
                            className={`p-4 rounded-xl border transition-all ${auto.isActive
                                ? 'bg-slate-800/40 border-purple-500/20 hover:border-purple-500/40'
                                : 'bg-slate-900/40 border-slate-700/30 opacity-60'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{meta.icon}</span>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">{auto.name}</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {meta.label}
                                            {auto.delayMinutes > 0 && (
                                                <span className="ml-2 text-amber-400">⏱ {auto.delayMinutes}min après</span>
                                            )}
                                        </p>
                                        {auto.content && (
                                            <p className="text-xs text-slate-500 mt-1 max-w-md truncate">
                                                💬 {auto.content}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-slate-600">
                                                {auto._count.scheduledMessages} messages envoyés
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${auto.channel === 'WHATSAPP' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {auto.channel}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Toggle */}
                                    <button
                                        onClick={() => toggleActive(auto.id, auto.isActive)}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${auto.isActive ? 'bg-purple-600' : 'bg-slate-700'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${auto.isActive ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                    </button>
                                    {/* Delete */}
                                    <button
                                        onClick={() => deleteAutomation(auto.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                        title="Supprimer"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────

interface SequenceStep {
    id?: string;
    stepOrder: number;
    delayDays: number;
    channel: string;
    templateKey: string | null;
    content: string | null;
}

interface Sequence {
    id: string;
    name: string;
    description: string | null;
    triggerEvent: string;
    stopOnReply: boolean;
    isActive: boolean;
    steps: SequenceStep[];
    _count: { enrollments: number };
    createdAt: string;
}

const TRIGGER_OPTIONS: Record<string, string> = {
    INSCRIPTION_CONFIRMED: '✅ Inscription confirmée',
    SESSION_J7: '📅 Rappel session (déclenchement J-7)',
    MODULE_COMPLETED: '🎓 Module terminé',
    LEAD_CREATED: '🆕 Nouveau lead',
};

// ─── Component ───────────────────────────────────────────────

export default function SequenceBuilder() {
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);

    // Create form
    const [form, setForm] = useState({
        name: '',
        triggerEvent: 'INSCRIPTION_CONFIRMED',
        stopOnReply: true,
        description: '',
    });
    const [steps, setSteps] = useState<{ delayDays: number; content: string; channel: string }[]>([
        { delayDays: -7, content: '', channel: 'WHATSAPP' },
    ]);

    const loadSequences = useCallback(async () => {
        try {
            const res = await fetch('/api/messaging/sequences');
            const data = await res.json();
            setSequences(data.sequences || []);
        } catch (err) {
            console.error('Failed to load sequences:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSequences(); }, [loadSequences]);

    const addStep = () => {
        const lastDelay = steps[steps.length - 1]?.delayDays || 0;
        setSteps([...steps, { delayDays: lastDelay + 1, content: '', channel: 'WHATSAPP' }]);
    };

    const removeStep = (index: number) => {
        if (steps.length <= 1) return;
        setSteps(steps.filter((_, i) => i !== index));
    };

    const updateStep = (index: number, field: string, value: any) => {
        setSteps(steps.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const createSequence = async () => {
        if (!form.name || steps.some(s => !s.content)) return;
        setSaving(true);
        try {
            const res = await fetch('/api/messaging/sequences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, steps }),
            });
            if (res.ok) {
                setShowCreate(false);
                setForm({ name: '', triggerEvent: 'INSCRIPTION_CONFIRMED', stopOnReply: true, description: '' });
                setSteps([{ delayDays: -7, content: '', channel: 'WHATSAPP' }]);
                loadSequences();
            }
        } catch (err) {
            console.error('Create failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const toggleSequence = async (id: string, isActive: boolean) => {
        try {
            await fetch('/api/messaging/sequences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !isActive }),
            });
            setSequences(prev => prev.map(s => s.id === id ? { ...s, isActive: !isActive } : s));
        } catch (err) {
            console.error('Toggle failed:', err);
        }
    };

    const deleteSequence = async (id: string) => {
        if (!confirm('Supprimer cette séquence ?')) return;
        try {
            await fetch(`/api/messaging/sequences?id=${id}`, { method: 'DELETE' });
            setSequences(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const formatDelay = (days: number) => {
        if (days < 0) return `J${days}`;
        if (days === 0) return 'Jour J';
        return `J+${days}`;
    };

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    Séquences multi-étapes avec arrêt automatique sur réponse
                </p>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
                >
                    + Nouvelle Séquence
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Nom de la séquence (ex: Onboarding J-7 → J+1)"
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                        <select
                            value={form.triggerEvent}
                            onChange={e => setForm({ ...form, triggerEvent: e.target.value })}
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            {Object.entries(TRIGGER_OPTIONS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={form.stopOnReply}
                            onChange={e => setForm({ ...form, stopOnReply: e.target.checked })}
                            className="rounded"
                        />
                        🛑 Arrêter automatiquement si le contact répond
                    </label>

                    {/* Steps Timeline */}
                    <div className="space-y-3">
                        <h4 className="text-xs text-slate-500 uppercase tracking-wide font-medium">Étapes de la séquence</h4>

                        {steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                {/* Timeline dot */}
                                <div className="flex flex-col items-center mt-2">
                                    <div className="w-3 h-3 rounded-full bg-cyan-500 border-2 border-cyan-400/30"></div>
                                    {i < steps.length - 1 && (
                                        <div className="w-0.5 h-12 bg-slate-700 mt-1"></div>
                                    )}
                                </div>

                                <div className="flex-1 grid grid-cols-12 gap-2">
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-slate-500">Jour</label>
                                        <input
                                            type="number"
                                            value={step.delayDays}
                                            onChange={e => updateStep(i, 'delayDays', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center"
                                        />
                                        <p className="text-[9px] text-cyan-400 text-center mt-0.5">
                                            {formatDelay(step.delayDays)}
                                        </p>
                                    </div>
                                    <div className="col-span-9">
                                        <label className="text-[10px] text-slate-500">Message</label>
                                        <textarea
                                            value={step.content}
                                            onChange={e => updateStep(i, 'content', e.target.value)}
                                            placeholder="Contenu du message... (variables: {nom}, {formation})"
                                            rows={2}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500 resize-none"
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-end pb-1">
                                        <button
                                            onClick={() => removeStep(i)}
                                            disabled={steps.length <= 1}
                                            className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-20"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addStep}
                            className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors ml-6"
                        >
                            <span className="text-lg">+</span> Ajouter une étape
                        </button>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400">
                            Annuler
                        </button>
                        <button
                            onClick={createSequence}
                            disabled={!form.name || steps.some(s => !s.content) || saving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg disabled:opacity-30"
                        >
                            {saving ? 'Création...' : 'Créer la séquence'}
                        </button>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                </div>
            )}

            {/* Empty */}
            {!loading && sequences.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-4xl mb-2">🔄</p>
                    <p className="text-sm text-slate-400">Aucune séquence configurée</p>
                    <p className="text-xs text-slate-600 mt-1">Créez des séquences pour envoyer des messages planifiés (J-7, J-1, J+1)</p>
                </div>
            )}

            {/* Sequence Cards */}
            <div className="space-y-3">
                {sequences.map(seq => (
                    <div
                        key={seq.id}
                        className={`p-4 rounded-xl border transition-all ${seq.isActive
                            ? 'bg-slate-800/40 border-cyan-500/20'
                            : 'bg-slate-900/40 border-slate-700/30 opacity-60'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-white">{seq.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {TRIGGER_OPTIONS[seq.triggerEvent] || seq.triggerEvent}
                                    {seq.stopOnReply && <span className="ml-2 text-amber-400">🛑 Arrêt sur réponse</span>}
                                </p>
                                <p className="text-[10px] text-slate-600 mt-1">
                                    {seq._count.enrollments} contacts inscrits
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleSequence(seq.id, seq.isActive)}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${seq.isActive ? 'bg-cyan-600' : 'bg-slate-700'
                                        }`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${seq.isActive ? 'translate-x-5' : 'translate-x-0.5'
                                        }`} />
                                </button>
                                <button onClick={() => deleteSequence(seq.id)} className="p-1.5 text-slate-500 hover:text-red-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Steps timeline */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {seq.steps.map((step, i) => (
                                <div key={step.id || i} className="flex items-center">
                                    <div className="flex-shrink-0 px-3 py-1.5 bg-slate-900/60 border border-slate-700/50 rounded-lg">
                                        <p className="text-[10px] text-cyan-400 font-medium">{formatDelay(step.delayDays)}</p>
                                        <p className="text-[10px] text-slate-400 max-w-[120px] truncate">{step.content}</p>
                                    </div>
                                    {i < seq.steps.length - 1 && (
                                        <div className="w-6 h-px bg-slate-700 flex-shrink-0"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

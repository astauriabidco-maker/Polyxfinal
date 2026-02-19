'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';

// ─── Types ────────────────────────────────────────────────────

interface ChatbotRule {
    id: string;
    name: string;
    keywords: string;
    pattern: string | null;
    responseType: string;
    response: string;
    isActive: boolean;
    priority: number;
    isDefault: boolean;
}

interface Handoff {
    phone: string;
    handoffAt: string;
}

interface InteractiveAction {
    id: string;
    phone: string;
    dossierId: string | null;
    actionType: string;
    actionData: any;
    replyId: string;
    status: string;
    appliedAt: string | null;
    createdAt: string;
    dossier: {
        stagiaireNom: string;
        stagiairePrenom: string;
        stagiaireTelephone: string | null;
        session: { nom: string } | null;
    } | null;
}

const RESPONSE_TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
    TEXT: { icon: '💬', label: 'Texte', color: 'bg-slate-800 text-slate-300' },
    INTERACTIVE_BUTTONS: { icon: '🔘', label: 'Boutons', color: 'bg-blue-500/10 text-blue-400' },
    INTERACTIVE_LIST: { icon: '📋', label: 'Liste', color: 'bg-cyan-500/10 text-cyan-400' },
    REDIRECT_HUMAN: { icon: '👤', label: 'Redirection', color: 'bg-amber-500/10 text-amber-400' },
};

const ACTION_TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
    CONFIRM_PRESENCE: { icon: '✅', label: 'Présence', color: 'text-green-400' },
    RESCHEDULE: { icon: '📅', label: 'Report', color: 'text-amber-400' },
    SELECT_SLOT: { icon: '🕐', label: 'Créneau', color: 'text-blue-400' },
    SELECT_DOCUMENT: { icon: '📄', label: 'Document', color: 'text-cyan-400' },
    SURVEY_RESPONSE: { icon: '⭐', label: 'Satisfaction', color: 'text-yellow-400' },
};

// ─── Page Component ──────────────────────────────────────────

export default function ChatbotPage() {
    const [activeTab, setActiveTab] = useState<'rules' | 'actions'>('rules');
    const [rules, setRules] = useState<ChatbotRule[]>([]);
    const [handoffs, setHandoffs] = useState<Handoff[]>([]);
    const [actions, setActions] = useState<InteractiveAction[]>([]);
    const [surveyAverage, setSurveyAverage] = useState<number | null>(null);
    const [actionStats, setActionStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [sendingAction, setSendingAction] = useState<string | null>(null);

    // Form
    const [form, setForm] = useState({
        name: '',
        keywords: '',
        responseType: 'TEXT',
        responseText: '',
        buttons: [{ id: 'btn_1', title: '' }] as Array<{ id: string; title: string }>,
        priority: 5,
    });

    const [testInput, setTestInput] = useState('');
    const [testResult, setTestResult] = useState<string | null>(null);

    // Quick send form
    const [quickDossierId, setQuickDossierId] = useState('');
    const [quickMessageType, setQuickMessageType] = useState('presence');

    const loadRules = useCallback(async () => {
        try {
            const res = await fetch('/api/messaging/chatbot');
            const data = await res.json();
            setRules(data.rules || []);
            setHandoffs(data.handoffs || []);
        } catch (err) {
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadActions = useCallback(async () => {
        try {
            const res = await fetch('/api/messaging/interactive');
            const data = await res.json();
            setActions(data.actions || []);
            setSurveyAverage(data.surveyAverage);
            setActionStats(data.stats || []);
        } catch (err) {
            console.error('Failed to load actions:', err);
        }
    }, []);

    useEffect(() => {
        loadRules();
        loadActions();
    }, [loadRules, loadActions]);

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            await fetch('/api/messaging/chatbot', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !isActive }),
            });
            setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !isActive } : r));
        } catch (err) {
            console.error('Toggle failed:', err);
        }
    };

    const deleteRule = async (id: string) => {
        if (!confirm('Supprimer cette règle ?')) return;
        try {
            await fetch(`/api/messaging/chatbot?id=${id}`, { method: 'DELETE' });
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const releaseHandoff = async (phone: string) => {
        try {
            await fetch('/api/messaging/chatbot', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'release_handoff', phone }),
            });
            setHandoffs(prev => prev.filter(h => h.phone !== phone));
        } catch (err) {
            console.error('Release failed:', err);
        }
    };

    const createRule = async () => {
        if (!form.name || !form.keywords || !form.responseText) return;
        setSaving(true);
        try {
            const response: any = { text: form.responseText };
            if (form.responseType === 'INTERACTIVE_BUTTONS') {
                response.buttons = form.buttons.filter(b => b.title.trim());
            }

            const res = await fetch('/api/messaging/chatbot', {
                method: editId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(editId ? { id: editId } : {}),
                    name: form.name,
                    keywords: form.keywords,
                    responseType: form.responseType,
                    response,
                    priority: form.priority,
                }),
            });

            if (res.ok) {
                setShowCreate(false);
                setEditId(null);
                resetForm();
                loadRules();
            }
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const editRule = (rule: ChatbotRule) => {
        const response = typeof rule.response === 'string' ? JSON.parse(rule.response) : rule.response;
        setForm({
            name: rule.name,
            keywords: rule.keywords,
            responseType: rule.responseType,
            responseText: response.text || '',
            buttons: response.buttons || [{ id: 'btn_1', title: '' }],
            priority: rule.priority,
        });
        setEditId(rule.id);
        setShowCreate(true);
    };

    const resetForm = () => {
        setForm({ name: '', keywords: '', responseType: 'TEXT', responseText: '', buttons: [{ id: 'btn_1', title: '' }], priority: 5 });
    };

    const addButton = () => {
        if (form.buttons.length >= 3) return;
        setForm({ ...form, buttons: [...form.buttons, { id: `btn_${form.buttons.length + 1}`, title: '' }] });
    };

    const testKeyword = () => {
        if (!testInput.trim()) return;
        const normalizedInput = testInput.toLowerCase().trim();
        const match = rules.find(r => {
            if (!r.isActive || r.keywords === '__FALLBACK__') return false;
            const kws = r.keywords.split(',').map(k => k.trim().toLowerCase());
            return kws.some(kw => normalizedInput.includes(kw));
        });
        const fallback = rules.find(r => r.keywords === '__FALLBACK__');
        setTestResult(match ? `✅ Match: "${match.name}"` : fallback ? `🔄 Fallback: "${fallback.name}"` : '❌ Aucun match');
    };

    const sendQuickAction = async () => {
        if (!quickDossierId.trim()) return;
        setSendingAction(quickMessageType);
        try {
            const res = await fetch('/api/messaging/interactive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dossierId: quickDossierId.trim(), messageType: quickMessageType }),
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ Message envoyé (${quickMessageType})`);
                setQuickDossierId('');
                loadActions();
            } else {
                alert(`❌ Erreur: ${data.error}`);
            }
        } catch (err) {
            console.error('Send failed:', err);
        } finally {
            setSendingAction(null);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleString('fr-FR');

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
            <Sidebar />
            <main className="flex-1 ml-64 text-white">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-bold">🤖 Chatbot & Interactions</h1>
                            <p className="text-sm text-slate-400 mt-1">Réponses automatiques, menus interactifs et actions dossier</p>
                        </div>
                        <a href="/messaging" className="px-3 py-2 text-sm text-slate-400 hover:text-white bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors">
                            ← Retour Messagerie
                        </a>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mb-6 bg-slate-900/50 rounded-xl p-1 w-fit">
                        <button onClick={() => setActiveTab('rules')}
                            className={`px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            🤖 Règles Chatbot
                        </button>
                        <button onClick={() => setActiveTab('actions')}
                            className={`px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'actions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            📊 Actions Dossier
                        </button>
                    </div>

                    {/* Handoff Banner */}
                    {handoffs.length > 0 && (
                        <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <h3 className="text-sm font-semibold text-amber-300 mb-2">👤 Conversations transférées ({handoffs.length})</h3>
                            <div className="space-y-1">
                                {handoffs.map(h => (
                                    <div key={h.phone} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                                        <div>
                                            <span className="text-sm text-white font-mono">+{h.phone}</span>
                                            <span className="text-[10px] text-slate-500 ml-2">depuis {formatDate(h.handoffAt)}</span>
                                        </div>
                                        <button onClick={() => releaseHandoff(h.phone)}
                                            className="px-3 py-1 text-xs bg-green-600/80 hover:bg-green-500 text-white rounded-lg">
                                            🤖 Remettre au bot
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ═══════ TAB: Rules ═══════ */}
                    {activeTab === 'rules' && (
                        <>
                            {/* Test Bar */}
                            <div className="mb-6 flex items-center gap-2">
                                <input value={testInput} onChange={e => setTestInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && testKeyword()}
                                    placeholder="🧪 Tester un mot-clé..." className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                                <button onClick={testKeyword} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg">
                                    Tester
                                </button>
                                {testResult && <span className="text-sm text-slate-300 ml-2">{testResult}</span>}
                            </div>

                            <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm text-slate-400">Règles de réponse automatique par mots-clés</p>
                                    <button onClick={() => { setShowCreate(!showCreate); setEditId(null); resetForm(); }}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors">
                                        + Nouvelle Règle
                                    </button>
                                </div>

                                {/* Create/Edit Form */}
                                {showCreate && (
                                    <div className="mb-4 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                                placeholder="Nom (ex: Réponse horaires)" className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                                            <select value={form.responseType} onChange={e => setForm({ ...form, responseType: e.target.value })}
                                                className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                                {Object.entries(RESPONSE_TYPE_LABELS).map(([key, meta]) => (
                                                    <option key={key} value={key}>{meta.icon} {meta.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })}
                                            placeholder="Mots-clés séparés par virgule (ex: horaires,heures,ouverture)"
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500" />

                                        <textarea value={form.responseText} onChange={e => setForm({ ...form, responseText: e.target.value })}
                                            placeholder="Message de réponse (WhatsApp markdown: *gras*, _italique_)" rows={3}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none" />

                                        {form.responseType === 'INTERACTIVE_BUTTONS' && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-500 uppercase">Boutons (max 3)</label>
                                                {form.buttons.map((btn, i) => (
                                                    <div key={i} className="flex gap-2">
                                                        <input value={btn.title} onChange={e => {
                                                            const btns = [...form.buttons];
                                                            btns[i] = { ...btns[i], title: e.target.value };
                                                            setForm({ ...form, buttons: btns });
                                                        }} placeholder={`Bouton ${i + 1}`}
                                                            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500" />
                                                        {form.buttons.length > 1 && (
                                                            <button onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, j) => j !== i) })}
                                                                className="text-slate-500 hover:text-red-400">✕</button>
                                                        )}
                                                    </div>
                                                ))}
                                                {form.buttons.length < 3 && (
                                                    <button onClick={addButton} className="text-xs text-indigo-400 hover:text-indigo-300">+ Ajouter un bouton</button>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3">
                                            <label className="text-[10px] text-slate-500 uppercase">Priorité</label>
                                            <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                                                className="w-20 bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center" />
                                            <span className="text-[10px] text-slate-600">Plus haut = prioritaire</span>
                                        </div>

                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setShowCreate(false); setEditId(null); }} className="px-4 py-2 text-sm text-slate-400">Annuler</button>
                                            <button onClick={createRule} disabled={!form.name || !form.keywords || !form.responseText || saving}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg disabled:opacity-30">
                                                {saving ? 'Enregistrement...' : editId ? 'Modifier' : 'Créer'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {loading && (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full" />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {rules.map(rule => {
                                        const meta = RESPONSE_TYPE_LABELS[rule.responseType] || RESPONSE_TYPE_LABELS.TEXT;
                                        const keywords = rule.keywords.split(',').slice(0, 5);
                                        let responsePreview = '';
                                        try {
                                            const resp = JSON.parse(rule.response);
                                            responsePreview = resp.text?.substring(0, 80) || '';
                                        } catch { responsePreview = rule.response.substring(0, 80); }

                                        return (
                                            <div key={rule.id}
                                                className={`p-4 rounded-xl border transition-all ${rule.isActive
                                                    ? 'bg-slate-800/40 border-indigo-500/20 hover:border-indigo-500/40'
                                                    : 'bg-slate-900/40 border-slate-700/30 opacity-60'
                                                    }`}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="text-sm font-semibold text-white">{rule.name}</h3>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta.color}`}>
                                                                {meta.icon} {meta.label}
                                                            </span>
                                                            {rule.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">Défaut</span>}
                                                            <span className="text-[10px] text-slate-600">P{rule.priority}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mb-1">
                                                            {keywords.map((kw, i) => (
                                                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300">
                                                                    {kw.trim()}
                                                                </span>
                                                            ))}
                                                            {rule.keywords.split(',').length > 5 && (
                                                                <span className="text-[10px] text-slate-500">+{rule.keywords.split(',').length - 5}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 truncate max-w-md">{responsePreview}</p>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <button onClick={() => toggleActive(rule.id, rule.isActive)}
                                                            className={`relative w-10 h-5 rounded-full transition-colors ${rule.isActive ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${rule.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </button>
                                                        <button onClick={() => editRule(rule)} className="p-1.5 text-slate-500 hover:text-indigo-400" title="Modifier">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-slate-500 hover:text-red-400" title="Supprimer">
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
                        </>
                    )}

                    {/* ═══════ TAB: Actions Dossier ═══════ */}
                    {activeTab === 'actions' && (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                                {Object.entries(ACTION_TYPE_LABELS).map(([type, meta]) => {
                                    const count = actionStats.find((s: any) => s.actionType === type)?._count?.id || 0;
                                    return (
                                        <div key={type} className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-3 text-center">
                                            <div className={`text-lg ${meta.color}`}>{meta.icon}</div>
                                            <div className="text-xl font-bold text-white">{count}</div>
                                            <div className="text-[10px] text-slate-500">{meta.label}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Survey Average */}
                            {surveyAverage !== null && (
                                <div className="mb-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-center gap-3">
                                    <span className="text-2xl">⭐</span>
                                    <div>
                                        <p className="text-sm font-semibold text-yellow-300">Note satellite moyenne : {surveyAverage}/5</p>
                                        <p className="text-[10px] text-slate-500">Basée sur les sondages satisfaction WhatsApp</p>
                                    </div>
                                </div>
                            )}

                            {/* Quick Send */}
                            <div className="mb-6 bg-slate-900/30 border border-slate-700/30 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3">📤 Envoi rapide</h3>
                                <div className="flex flex-wrap gap-3 items-end">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="text-[10px] text-slate-500 uppercase block mb-1">ID Dossier</label>
                                        <input value={quickDossierId} onChange={e => setQuickDossierId(e.target.value)}
                                            placeholder="Coller l'ID du dossier..."
                                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 font-mono" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase block mb-1">Type de message</label>
                                        <select value={quickMessageType} onChange={e => setQuickMessageType(e.target.value)}
                                            className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
                                            <option value="presence">✅ Confirmation présence</option>
                                            <option value="slots">📅 Choix de créneau</option>
                                            <option value="documents">📄 Checklist documents</option>
                                            <option value="survey">⭐ Sondage satisfaction</option>
                                        </select>
                                    </div>
                                    <button onClick={sendQuickAction} disabled={!quickDossierId.trim() || !!sendingAction}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg disabled:opacity-30">
                                        {sendingAction ? '⏳ Envoi...' : '📤 Envoyer'}
                                    </button>
                                </div>
                            </div>

                            {/* Actions History */}
                            <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-white mb-4">📜 Historique des actions</h3>

                                {actions.length === 0 && (
                                    <p className="text-sm text-slate-500 py-4 text-center">Aucune action enregistrée pour le moment</p>
                                )}

                                <div className="space-y-2">
                                    {actions.map(action => {
                                        const meta = ACTION_TYPE_LABELS[action.actionType] || { icon: '❓', label: action.actionType, color: 'text-slate-400' };
                                        const statusColor = action.status === 'APPLIED' ? 'text-green-400' : action.status === 'FAILED' ? 'text-red-400' : 'text-amber-400';

                                        return (
                                            <div key={action.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/20">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-lg ${meta.color}`}>{meta.icon}</span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-white font-medium">{meta.label}</span>
                                                            <span className={`text-[10px] ${statusColor}`}>● {action.status}</span>
                                                        </div>
                                                        {action.dossier && (
                                                            <p className="text-xs text-slate-500">
                                                                {action.dossier.stagiairePrenom} {action.dossier.stagiaireNom}
                                                                {action.dossier.session && <span> — {action.dossier.session.nom}</span>}
                                                            </p>
                                                        )}
                                                        {action.actionData && action.actionType === 'SURVEY_RESPONSE' && (
                                                            <span className="text-xs text-yellow-400">
                                                                {'⭐'.repeat(action.actionData.score || 0)}{'☆'.repeat(5 - (action.actionData.score || 0))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-500 font-mono">+{action.phone}</p>
                                                    <p className="text-[10px] text-slate-600">{formatDate(action.createdAt)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

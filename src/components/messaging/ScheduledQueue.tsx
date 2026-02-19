'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────

interface ScheduledMsg {
    id: string;
    phone: string;
    content: string;
    channel: string;
    templateKey: string | null;
    scheduledAt: string;
    status: string;
    retryCount: number;
    maxRetries: number;
    lastError: string | null;
    automation: { name: string; event: string } | null;
    createdAt: string;
}

const STATUS_LABELS: Record<string, { icon: string; label: string; color: string }> = {
    PENDING: { icon: '⏳', label: 'En attente', color: 'text-amber-400' },
    PROCESSING: { icon: '🔄', label: 'En cours', color: 'text-blue-400' },
    SENT: { icon: '✅', label: 'Envoyé', color: 'text-green-400' },
    FAILED: { icon: '❌', label: 'Échoué', color: 'text-red-400' },
    CANCELLED: { icon: '🚫', label: 'Annulé', color: 'text-slate-500' },
};

// ─── Component ───────────────────────────────────────────────

export default function ScheduledQueue() {
    const [messages, setMessages] = useState<ScheduledMsg[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');
    const [showSchedule, setShowSchedule] = useState(false);

    // Schedule form
    const [form, setForm] = useState({
        phone: '',
        content: '',
        scheduledAt: '',
        channel: 'WHATSAPP',
    });
    const [saving, setSaving] = useState(false);

    const loadMessages = useCallback(async () => {
        try {
            const url = filter
                ? `/api/messaging/scheduled?status=${filter}`
                : '/api/messaging/scheduled';
            const res = await fetch(url);
            const data = await res.json();
            setMessages(data.scheduled || []);
            setCounts(data.counts || {});
        } catch (err) {
            console.error('Failed to load scheduled:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { loadMessages(); }, [loadMessages]);

    const cancelMessage = async (id: string) => {
        try {
            await fetch(`/api/messaging/scheduled?id=${id}`, { method: 'DELETE' });
            setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'CANCELLED' } : m));
        } catch (err) {
            console.error('Cancel failed:', err);
        }
    };

    const scheduleMessage = async () => {
        if (!form.phone || !form.content || !form.scheduledAt) return;
        setSaving(true);
        try {
            const res = await fetch('/api/messaging/scheduled', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setShowSchedule(false);
                setForm({ phone: '', content: '', scheduledAt: '', channel: 'WHATSAPP' });
                loadMessages();
            }
        } catch (err) {
            console.error('Schedule failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Stats Bar */}
            <div className="flex items-center gap-4 flex-wrap">
                <button
                    onClick={() => setFilter('')}
                    className={`px-3 py-1.5 text-xs rounded-full transition-colors ${!filter ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    Tous ({total})
                </button>
                {Object.entries(STATUS_LABELS).map(([key, meta]) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${filter === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {meta.icon} {meta.label} ({counts[key] || 0})
                    </button>
                ))}

                <div className="flex-1" />

                <button
                    onClick={() => setShowSchedule(!showSchedule)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
                >
                    📅 Programmer un envoi
                </button>
            </div>

            {/* Schedule Form */}
            {showSchedule && (
                <div className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            placeholder="Numéro (ex: 33612345678)"
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                        <input
                            type="datetime-local"
                            value={form.scheduledAt}
                            onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        />
                        <select
                            value={form.channel}
                            onChange={e => setForm({ ...form, channel: e.target.value })}
                            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="SMS">SMS</option>
                        </select>
                    </div>
                    <textarea
                        value={form.content}
                        onChange={e => setForm({ ...form, content: e.target.value })}
                        placeholder="Contenu du message"
                        rows={2}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowSchedule(false)} className="px-4 py-2 text-sm text-slate-400">Annuler</button>
                        <button
                            onClick={scheduleMessage}
                            disabled={!form.phone || !form.content || !form.scheduledAt || saving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg disabled:opacity-30"
                        >
                            {saving ? 'Programmation...' : 'Programmer'}
                        </button>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full"></div>
                </div>
            )}

            {/* Empty */}
            {!loading && messages.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-4xl mb-2">📅</p>
                    <p className="text-sm text-slate-400">Aucun message programmé</p>
                </div>
            )}

            {/* Message List */}
            <div className="space-y-2">
                {messages.map(msg => {
                    const statusMeta = STATUS_LABELS[msg.status] || STATUS_LABELS.PENDING;
                    return (
                        <div
                            key={msg.id}
                            className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-slate-600/50 transition-colors"
                        >
                            <span className="text-lg">{statusMeta.icon}</span>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-white font-mono">+{msg.phone}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusMeta.color} bg-slate-900/50`}>
                                        {statusMeta.label}
                                    </span>
                                    {msg.automation && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                                            ⚡ {msg.automation.name}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{msg.content}</p>
                                {msg.lastError && (
                                    <p className="text-[10px] text-red-400 mt-0.5">⚠ {msg.lastError}</p>
                                )}
                            </div>

                            <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-slate-500">{formatDate(msg.scheduledAt)}</p>
                                {msg.retryCount > 0 && (
                                    <p className="text-[10px] text-amber-500">Retry {msg.retryCount}/{msg.maxRetries}</p>
                                )}
                            </div>

                            {msg.status === 'PENDING' && (
                                <button
                                    onClick={() => cancelMessage(msg.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                                    title="Annuler"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

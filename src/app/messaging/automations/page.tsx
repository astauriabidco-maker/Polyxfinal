'use client';

import { useState, useEffect, useCallback } from 'react';
import AutomationList from '@/components/messaging/AutomationList';
import SequenceBuilder from '@/components/messaging/SequenceBuilder';
import ScheduledQueue from '@/components/messaging/ScheduledQueue';
import Sidebar from '@/components/layout/Sidebar';

// ─── Tab Config ──────────────────────────────────────────────

const TABS = [
    { id: 'workflows', label: '⚡ Workflows', desc: 'Messages automatiques sur événements' },
    { id: 'scheduled', label: '📅 Programmés', desc: 'File d\'attente des envois' },
    { id: 'sequences', label: '🔄 Séquences', desc: 'Messages multi-étapes' },
    { id: 'hooks', label: '🔗 Intégrations', desc: 'Hooks modules (Dossiers, Leads…)' },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Hook Types ──────────────────────────────────────────────

interface HookItem {
    id: string;
    label: string;
    description: string;
    icon: string;
    enabled: boolean;
}

// ─── HooksConfig Component ──────────────────────────────────

function HooksConfig() {
    const [hooks, setHooks] = useState<HookItem[]>([]);
    const [messagingActive, setMessagingActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);

    const fetchHooks = useCallback(async () => {
        try {
            const res = await fetch('/api/messaging/hooks');
            if (res.ok) {
                const data = await res.json();
                setHooks(data.hooks);
                setMessagingActive(data.messagingActive);
            }
        } catch (err) {
            console.error('Failed to fetch hooks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHooks(); }, [fetchHooks]);

    const toggleHook = async (hookId: string, enabled: boolean) => {
        setToggling(hookId);
        try {
            const res = await fetch('/api/messaging/hooks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hookId, enabled }),
            });
            if (res.ok) {
                setHooks(prev => prev.map(h => h.id === hookId ? { ...h, enabled } : h));
            }
        } catch (err) {
            console.error('Failed to toggle hook:', err);
        } finally {
            setToggling(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full" />
                <span className="ml-3 text-slate-400">Chargement…</span>
            </div>
        );
    }

    if (!messagingActive) {
        return (
            <div className="text-center py-16">
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-lg font-semibold text-slate-300 mb-2">WhatsApp non configuré</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Configurez d'abord WhatsApp dans les paramètres de messagerie avant d'activer les hooks d'intégration.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 mb-5 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <span className="text-xl">💡</span>
                <p className="text-xs text-indigo-300">
                    Les hooks permettent aux autres modules (Dossiers, Leads, CRM) de déclencher automatiquement des messages WhatsApp.
                    Chaque hook nécessite qu'une <strong>automatisation</strong> correspondante soit créée dans l'onglet Workflows.
                </p>
            </div>

            {hooks.map(hook => (
                <div
                    key={hook.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hook.enabled
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-slate-800/30 border-slate-700/30'
                        }`}
                >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl mt-0.5">{hook.icon}</span>
                        <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-200">{hook.label}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{hook.description}</p>
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-2 font-medium ${hook.enabled
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-slate-700/50 text-slate-500'
                                }`}>
                                Événement: {hook.id}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => toggleHook(hook.id, !hook.enabled)}
                        disabled={toggling === hook.id}
                        className={`relative shrink-0 w-12 h-7 rounded-full transition-all duration-200 ${hook.enabled
                                ? 'bg-emerald-500'
                                : 'bg-slate-600'
                            } ${toggling === hook.id ? 'opacity-50' : ''}`}
                    >
                        <span
                            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${hook.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                        />
                    </button>
                </div>
            ))}
        </div>
    );
}

// ─── Page Component ──────────────────────────────────────────

export default function AutomationsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('workflows');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
            <Sidebar />
            <main className="flex-1 ml-64 text-white">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-bold">
                                ⚡ Automatisations
                            </h1>
                            <p className="text-sm text-slate-400 mt-1">
                                Messages automatiques, planifiés, séquences et hooks d'intégration
                            </p>
                        </div>

                        <a
                            href="/messaging"
                            className="px-3 py-2 text-sm text-slate-400 hover:text-white bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors"
                        >
                            ← Retour Messagerie
                        </a>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800/40 border border-slate-700/30 rounded-xl p-1 mb-6">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-slate-700/60 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                                    }`}
                            >
                                <span className="block">{tab.label}</span>
                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{tab.desc}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                        {activeTab === 'workflows' && <AutomationList />}
                        {activeTab === 'scheduled' && <ScheduledQueue />}
                        {activeTab === 'sequences' && <SequenceBuilder />}
                        {activeTab === 'hooks' && <HooksConfig />}
                    </div>
                </div>
            </main>
        </div>
    );
}

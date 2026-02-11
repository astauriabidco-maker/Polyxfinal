/**
 * NETWORK SETTINGS MANAGER
 * ========================
 * Component pour éditer les templates d'email et de documentation.
 */

'use client';

import { useState, useEffect } from 'react';

export default function NetworkSettingsManager() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch('/api/network/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/network/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                setMessage('Paramètres enregistrés avec succès !');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            alert('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-slate-400 p-8 text-center">Chargement des paramètres...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Configuration Réseau</h2>
                    <p className="text-slate-400 text-sm">Personnalisez les communications et la documentation pour vos partenaires API.</p>
                </div>
                {message && (
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg animate-in slide-in-from-top duration-300">
                        {message}
                    </div>
                )}
            </header>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Onboarding Email */}
                <div className="space-y-4 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>📧</span> Email d&apos;Onboarding
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Envoyé lors de la création du partenaire (Phase 1).</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Sujet</label>
                            <input
                                type="text"
                                value={settings.onboardingEmailSubject}
                                onChange={e => setSettings({ ...settings, onboardingEmailSubject: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Corps de l&apos;email</label>
                            <textarea
                                rows={6}
                                value={settings.onboardingEmailBody}
                                onChange={e => setSettings({ ...settings, onboardingEmailBody: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                placeholder="Utilisez {{contactName}}, {{companyName}}, {{onboardingUrl}}"
                            />
                        </div>
                    </div>
                </div>

                {/* Activation Email */}
                <div className="space-y-4 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>🔐</span> Email d&apos;Activation
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Envoyé lors de l&apos;activation avec la clé API (Phase 2).</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Sujet</label>
                            <input
                                type="text"
                                value={settings.activationEmailSubject}
                                onChange={e => setSettings({ ...settings, activationEmailSubject: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Corps de l&apos;email</label>
                            <textarea
                                rows={6}
                                value={settings.activationEmailBody}
                                onChange={e => setSettings({ ...settings, activationEmailBody: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                placeholder="Utilisez {{contactName}}, {{apiKey}}, {{docsUrl}}"
                            />
                        </div>
                    </div>
                </div>

                {/* Documentation Markdown */}
                <div className="md:col-span-2 space-y-4 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>📖</span> Documentation Technique API
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Contenu dynamique affiché aux partenaires (Markdown supporté).</p>

                    <textarea
                        rows={12}
                        value={settings.apiDocumentationMarkdown}
                        onChange={e => setSettings({ ...settings, apiDocumentationMarkdown: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-6 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-inner"
                    />
                </div>

                <div className="md:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 shadow-lg shadow-purple-500/20 active:scale-95 transition-all"
                    >
                        {saving ? 'Enregistrement...' : 'Enregistrer les templates'}
                    </button>
                </div>
            </form>
        </div>
    );
}

/**
 * CONFIGURATION RÉSEAU FRANCHISE — Page complète
 * ================================================
 * 4 sections : Redevances, Conformité, Templates Emails, Documentation API
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';

interface NetworkConfigData {
    // Taux de redevance (stockés sur Organization)
    royaltyRate: number;
    leadFeeRate: number;
    // Conformité (stocké sur NetworkSettings)
    doubinDelayDays: number;
    // Templates emails
    onboardingEmailSubject: string;
    onboardingEmailBody: string;
    activationEmailSubject: string;
    activationEmailBody: string;
    // Documentation API
    apiDocumentationMarkdown: string;
}

const defaultConfig: NetworkConfigData = {
    royaltyRate: 5.0,
    leadFeeRate: 15.0,
    doubinDelayDays: 20,
    onboardingEmailSubject: '',
    onboardingEmailBody: '',
    activationEmailSubject: '',
    activationEmailBody: '',
    apiDocumentationMarkdown: '',
};

type Tab = 'royalties' | 'compliance' | 'emails' | 'docs';

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'royalties', label: 'Redevances', icon: '💰' },
    { id: 'compliance', label: 'Conformité', icon: '⚖️' },
    { id: 'emails', label: 'Templates Emails', icon: '📧' },
    { id: 'docs', label: 'Documentation API', icon: '📄' },
];

export default function NetworkSettingsPage() {
    const [config, setConfig] = useState<NetworkConfigData>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('royalties');

    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/network/settings');
            if (!res.ok) throw new Error('Erreur de chargement');
            const data = await res.json();
            setConfig({
                royaltyRate: data.royaltyRate ?? 5.0,
                leadFeeRate: data.leadFeeRate ?? 15.0,
                doubinDelayDays: data.doubinDelayDays ?? 20,
                onboardingEmailSubject: data.onboardingEmailSubject || '',
                onboardingEmailBody: data.onboardingEmailBody || '',
                activationEmailSubject: data.activationEmailSubject || '',
                activationEmailBody: data.activationEmailBody || '',
                apiDocumentationMarkdown: data.apiDocumentationMarkdown || '',
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const res = await fetch('/api/network/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erreur de sauvegarde');
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: keyof NetworkConfigData, value: string | number) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <Sidebar />
                <main className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="text-2xl">⚙️</span>
                                Configuration Réseau Franchise
                            </h1>
                            <p className="text-slate-400 mt-1">
                                Paramétrage complet du module franchise
                            </p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 
                                     hover:from-emerald-500 hover:to-emerald-400 
                                     text-white font-semibold transition-all duration-200
                                     disabled:opacity-60 disabled:cursor-not-allowed
                                     flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Sauvegarde...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Sauvegarder
                                </>
                            )}
                        </button>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="mb-6 px-4 py-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {saved && (
                        <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-800/50 flex items-center gap-3 animate-fade-in">
                            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm text-emerald-400">Configuration sauvegardée avec succès</p>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 mb-6 bg-slate-800/40 p-1 rounded-xl border border-slate-700/30">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                                        ? 'bg-slate-700/80 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/40'
                                    }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'royalties' && (
                        <RoyaltiesSection config={config} updateField={updateField} />
                    )}
                    {activeTab === 'compliance' && (
                        <ComplianceSection config={config} updateField={updateField} />
                    )}
                    {activeTab === 'emails' && (
                        <EmailsSection config={config} updateField={updateField} />
                    )}
                    {activeTab === 'docs' && (
                        <DocsSection config={config} updateField={updateField} />
                    )}
                </div>
            </main>
        </div>
    );
}

// ─── Sections ─────────────────────────────────────────────────

interface SectionProps {
    config: NetworkConfigData;
    updateField: (field: keyof NetworkConfigData, value: string | number) => void;
}

function RoyaltiesSection({ config, updateField }: SectionProps) {
    return (
        <div className="space-y-6">
            {/* Redevance Organique */}
            <section className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Redevance Organique</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Taux appliqué sur le chiffre d&apos;affaires des dossiers acquis directement par le franchisé.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min={0}
                        max={30}
                        step={0.5}
                        value={config.royaltyRate}
                        onChange={e => updateField('royaltyRate', parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="w-24 flex items-center gap-1">
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={config.royaltyRate}
                            onChange={e => updateField('royaltyRate', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50 
                                     text-white text-center text-sm font-mono
                                     focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-slate-400 font-bold">%</span>
                    </div>
                </div>
            </section>

            {/* Commission Dispatch */}
            <section className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Commission Lead Dispatché</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Taux appliqué sur le CA des leads apportés par le siège et dispatchés au franchisé.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min={0}
                        max={50}
                        step={0.5}
                        value={config.leadFeeRate}
                        onChange={e => updateField('leadFeeRate', parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="w-24 flex items-center gap-1">
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={config.leadFeeRate}
                            onChange={e => updateField('leadFeeRate', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50 
                                     text-white text-center text-sm font-mono
                                     focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                        <span className="text-slate-400 font-bold">%</span>
                    </div>
                </div>
            </section>

            {/* Résumé visuel */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 Aperçu du barème actuel</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
                        <p className="text-xs text-blue-400 uppercase tracking-wide mb-1">Organique</p>
                        <p className="text-2xl font-bold text-blue-300">{config.royaltyRate}%</p>
                        <p className="text-xs text-slate-500 mt-1">CA acquis par le franchisé</p>
                    </div>
                    <div className="bg-purple-500/5 rounded-lg p-4 border border-purple-500/10">
                        <p className="text-xs text-purple-400 uppercase tracking-wide mb-1">Dispatch</p>
                        <p className="text-2xl font-bold text-purple-300">{config.leadFeeRate}%</p>
                        <p className="text-xs text-slate-500 mt-1">Leads apportés par le siège</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ComplianceSection({ config, updateField }: SectionProps) {
    return (
        <div className="space-y-6">
            <section className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 01-6.001 0M18 7l-3 9m-3-19v20" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Délai Loi Doubin</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Nombre de jours minimum entre l&apos;envoi du DIP et la signature du contrat.
                            <br />
                            <span className="text-amber-400/70">
                                Art. L. 330-3 du Code de commerce — Minimum légal : 20 jours.
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => updateField('doubinDelayDays', Math.max(1, config.doubinDelayDays - 1))}
                            className="w-10 h-10 rounded-lg bg-slate-900/60 border border-slate-700/50 text-slate-400 
                                     hover:border-amber-500/30 hover:text-amber-400 transition-all flex items-center justify-center"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                        </button>
                        <div className="relative">
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={config.doubinDelayDays}
                                onChange={e => updateField('doubinDelayDays', parseInt(e.target.value) || 20)}
                                className="w-24 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                         text-white text-center text-2xl font-bold font-mono
                                         focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                            />
                        </div>
                        <button
                            onClick={() => updateField('doubinDelayDays', Math.min(365, config.doubinDelayDays + 1))}
                            className="w-10 h-10 rounded-lg bg-slate-900/60 border border-slate-700/50 text-slate-400 
                                     hover:border-amber-500/30 hover:text-amber-400 transition-all flex items-center justify-center"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <span className="text-slate-300 font-medium ml-1">jours</span>
                    </div>
                </div>

                {config.doubinDelayDays < 20 && (
                    <div className="mt-4 px-4 py-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-center gap-3">
                        <svg className="w-5 h-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-400 font-medium">
                            ⚠️ Le minimum légal est de 20 jours. Un délai inférieur expose votre organisation à un risque juridique.
                        </p>
                    </div>
                )}

                {config.doubinDelayDays >= 20 && (
                    <div className="mt-4 px-4 py-3 rounded-xl bg-emerald-950/30 border border-emerald-800/30 flex items-center gap-3">
                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-emerald-400">
                            Conforme au minimum légal (≥ 20 jours)
                        </p>
                    </div>
                )}
            </section>

            {/* Info Card */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">📋 Impact sur le pipeline</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Ce délai bloque automatiquement la transition du statut <code className="text-amber-400 bg-slate-800 px-1 rounded">DIP Envoyé</code> vers <code className="text-amber-400 bg-slate-800 px-1 rounded">Contrat Signé</code> dans le pipeline Kanban.
                    Le compteur de jours restants est affiché sur la fiche du candidat.
                </p>
            </div>
        </div>
    );
}

function EmailsSection({ config, updateField }: SectionProps) {
    return (
        <div className="space-y-6">
            {/* Email Onboarding */}
            <section className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email d&apos;Onboarding
                </h2>
                <p className="text-sm text-slate-400 mb-5">
                    Envoyé au nouveau franchisé lors de son intégration.
                    Variables : <code className="text-emerald-400">{'{{contactName}}'}</code>, <code className="text-emerald-400">{'{{onboardingUrl}}'}</code>
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Objet</label>
                        <input
                            type="text"
                            value={config.onboardingEmailSubject}
                            onChange={e => updateField('onboardingEmailSubject', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                     text-white placeholder-slate-500 
                                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Corps</label>
                        <textarea
                            value={config.onboardingEmailBody}
                            onChange={e => updateField('onboardingEmailBody', e.target.value)}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                     text-white placeholder-slate-500 font-mono text-sm
                                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y"
                        />
                    </div>
                </div>
            </section>

            {/* Email Activation */}
            <section className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Email d&apos;Activation
                </h2>
                <p className="text-sm text-slate-400 mb-5">
                    Envoyé après validation des contrats. Contient la clé API.
                    Variables : <code className="text-emerald-400">{'{{contactName}}'}</code>, <code className="text-emerald-400">{'{{apiKey}}'}</code>, <code className="text-emerald-400">{'{{docsUrl}}'}</code>
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Objet</label>
                        <input
                            type="text"
                            value={config.activationEmailSubject}
                            onChange={e => updateField('activationEmailSubject', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                     text-white placeholder-slate-500 
                                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Corps</label>
                        <textarea
                            value={config.activationEmailBody}
                            onChange={e => updateField('activationEmailBody', e.target.value)}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                     text-white placeholder-slate-500 font-mono text-sm
                                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function DocsSection({ config, updateField }: SectionProps) {
    return (
        <section className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documentation API Partenaires
            </h2>
            <p className="text-sm text-slate-400 mb-5">
                Documentation technique en Markdown, accessible par les franchisés connectés.
            </p>
            <textarea
                value={config.apiDocumentationMarkdown}
                onChange={e => updateField('apiDocumentationMarkdown', e.target.value)}
                rows={16}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                         text-white placeholder-slate-500 font-mono text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y"
                placeholder="# Documentation API&#10;&#10;Rédigez ici la documentation technique..."
            />
        </section>
    );
}

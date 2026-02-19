'use client';

import { useState, useEffect } from 'react';
import { Save, TestTube, Loader2, CheckCircle, AlertTriangle, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import MetaTemplateManager from './MetaTemplateManager';

// ─── Types ────────────────────────────────────────────────────

interface MessagingConfig {
    id: string;
    provider: 'META_CLOUD' | 'TWILIO';
    isActive: boolean;
    metaPhoneNumberId: string | null;
    metaBusinessId: string | null;
    metaAccessToken: string | null;
    twilioAccountSid: string | null;
    twilioAuthToken: string | null;
    twilioPhoneNumber: string | null;
    defaultCountryCode: string;
    templates: TemplateMapping[];
}

interface TemplateMapping {
    id: string;
    internalKey: string;
    providerTemplateName: string;
    language: string;
    fallbackText: string | null;
    isActive: boolean;
}

// ─── Default Template Keys ───────────────────────────────────

const SUGGESTED_TEMPLATES = [
    { key: 'RDV_CONFIRMATION', label: 'Confirmation de RDV', defaultFallback: 'Bonjour {{name}}, je vous confirme votre rendez-vous pour le {{date}}. Cordialement, Polyx.' },
    { key: 'NO_ANSWER', label: 'Relance (pas de réponse)', defaultFallback: "Bonjour {{name}}, j'ai tenté de vous joindre concernant votre demande de formation. Quand êtes-vous disponible ? Cordialement, Polyx." },
    { key: 'INFO_SOUHAITEE', label: 'Information souhaitée', defaultFallback: 'Bonjour {{name}}, suite à votre demande, je reste à votre disposition pour échanger sur votre projet de formation. Cordialement.' },
];

// ─── Component ───────────────────────────────────────────────

interface Props {
    initialConfig: MessagingConfig | null;
}

export default function MessagingConfigPanel({ initialConfig }: Props) {
    const [config, setConfig] = useState<MessagingConfig | null>(initialConfig);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Form state
    const [provider, setProvider] = useState<'META_CLOUD' | 'TWILIO'>(config?.provider || 'META_CLOUD');
    const [isActive, setIsActive] = useState(config?.isActive || false);
    const [metaPhoneNumberId, setMetaPhoneNumberId] = useState(config?.metaPhoneNumberId || '');
    const [metaBusinessId, setMetaBusinessId] = useState(config?.metaBusinessId || '');
    const [metaAccessToken, setMetaAccessToken] = useState(config?.metaAccessToken || '');
    const [twilioAccountSid, setTwilioAccountSid] = useState(config?.twilioAccountSid || '');
    const [twilioAuthToken, setTwilioAuthToken] = useState(config?.twilioAuthToken || '');
    const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(config?.twilioPhoneNumber || '');
    const [defaultCountryCode, setDefaultCountryCode] = useState(config?.defaultCountryCode || '+33');

    // Templates state
    const [templates, setTemplates] = useState<TemplateMapping[]>(config?.templates || []);
    const [newTemplate, setNewTemplate] = useState({ internalKey: '', providerTemplateName: '', fallbackText: '' });
    const [showNewTemplate, setShowNewTemplate] = useState(false);

    // ─── Save Config ─────────────────────────────────────────

    const saveConfig = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            const res = await fetch('/api/messaging/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    isActive,
                    metaPhoneNumberId: metaPhoneNumberId || null,
                    metaBusinessId: metaBusinessId || null,
                    metaAccessToken: metaAccessToken || null,
                    twilioAccountSid: twilioAccountSid || null,
                    twilioAuthToken: twilioAuthToken || null,
                    twilioPhoneNumber: twilioPhoneNumber || null,
                    defaultCountryCode,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setConfig(data.config);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    // ─── Test Send ───────────────────────────────────────────

    const testSend = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const testPhone = prompt('Numéro de test (format international, ex: +33612345678) :');
            if (!testPhone) {
                setTesting(false);
                return;
            }

            const res = await fetch('/api/messaging/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testPhone,
                    text: '🧪 Test Polyx ERP — Si vous recevez ce message, la configuration messaging fonctionne !',
                    channel: 'whatsapp',
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setTestResult({ success: true, message: `✅ Message envoyé (ID: ${data.messageId})` });
            } else {
                setTestResult({ success: false, message: `❌ ${data.error || 'Erreur inconnue'}` });
            }
        } catch (err) {
            setTestResult({ success: false, message: '❌ Erreur réseau' });
        } finally {
            setTesting(false);
        }
    };

    // ─── Template CRUD ───────────────────────────────────────

    const addTemplate = async () => {
        if (!newTemplate.internalKey || !newTemplate.providerTemplateName) return;

        try {
            const res = await fetch('/api/messaging/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTemplate),
            });

            if (res.ok) {
                const data = await res.json();
                setTemplates([...templates, data.template]);
                setNewTemplate({ internalKey: '', providerTemplateName: '', fallbackText: '' });
                setShowNewTemplate(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleTemplate = async (id: string, currentActive: boolean) => {
        try {
            const res = await fetch('/api/messaging/templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !currentActive }),
            });

            if (res.ok) {
                setTemplates(templates.map(t => t.id === id ? { ...t, isActive: !currentActive } : t));
            }
        } catch (err) {
            console.error(err);
        }
    };

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">📱 Configuration Messaging</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Configurez WhatsApp Business API ou Twilio pour envoyer des messages aux leads.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {testResult && (
                        <span className={`text-sm px-3 py-1 rounded-full ${testResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {testResult.message}
                        </span>
                    )}
                    {saveSuccess && (
                        <span className="text-sm text-emerald-400 flex items-center gap-1">
                            <CheckCircle size={14} /> Sauvegardé
                        </span>
                    )}
                </div>
            </div>

            {/* Provider Selection */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Fournisseur</h2>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setProvider('META_CLOUD')}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${provider === 'META_CLOUD'
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">💬</span>
                            <span className="font-bold text-white">Meta Cloud API</span>
                        </div>
                        <p className="text-xs text-slate-400">
                            WhatsApp Business Platform direct. Templates pré-approuvés par Meta.
                        </p>
                    </button>
                    <button
                        onClick={() => setProvider('TWILIO')}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${provider === 'TWILIO'
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">📞</span>
                            <span className="font-bold text-white">Twilio BSP</span>
                        </div>
                        <p className="text-xs text-slate-400">
                            WhatsApp via Twilio Business Solution Provider + SMS natif.
                        </p>
                    </button>
                </div>
            </div>

            {/* Provider Config */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">
                        {provider === 'META_CLOUD' ? '💬 Meta Cloud API' : '📞 Twilio BSP'}
                    </h2>
                    <button
                        onClick={() => setIsActive(!isActive)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                            }`}
                    >
                        {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {isActive ? 'Actif' : 'Inactif'}
                    </button>
                </div>

                {provider === 'META_CLOUD' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number ID</label>
                            <input
                                type="text"
                                value={metaPhoneNumberId}
                                onChange={e => setMetaPhoneNumberId(e.target.value)}
                                placeholder="Depuis Meta Business Manager"
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Business Account ID</label>
                            <input
                                type="text"
                                value={metaBusinessId}
                                onChange={e => setMetaBusinessId(e.target.value)}
                                placeholder="WhatsApp Business Account ID"
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Access Token</label>
                            <input
                                type="password"
                                value={metaAccessToken}
                                onChange={e => setMetaAccessToken(e.target.value)}
                                placeholder="Permanent token depuis l'App Meta"
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500/50"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Account SID</label>
                            <input
                                type="text"
                                value={twilioAccountSid}
                                onChange={e => setTwilioAccountSid(e.target.value)}
                                placeholder="AC..."
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Auth Token</label>
                            <input
                                type="password"
                                value={twilioAuthToken}
                                onChange={e => setTwilioAuthToken(e.target.value)}
                                placeholder="Twilio Auth Token"
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Numéro WhatsApp</label>
                            <input
                                type="text"
                                value={twilioPhoneNumber}
                                onChange={e => setTwilioPhoneNumber(e.target.value)}
                                placeholder="+33..."
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                            />
                        </div>
                    </div>
                )}

                {/* Default Country Code */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Indicatif par défaut</label>
                    <input
                        type="text"
                        value={defaultCountryCode}
                        onChange={e => setDefaultCountryCode(e.target.value)}
                        placeholder="+33"
                        className="w-32 bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                </div>
            </div>

            {/* Templates */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">📝 Templates de Messages</h2>
                    <button
                        onClick={() => setShowNewTemplate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm hover:bg-cyan-600/30 transition-colors"
                    >
                        <Plus size={14} /> Ajouter
                    </button>
                </div>

                {/* Existing Templates */}
                <div className="space-y-3">
                    {templates.length === 0 && !showNewTemplate && (
                        <div className="text-center py-6 text-slate-500">
                            <p className="text-sm">Aucun template configuré.</p>
                            <p className="text-xs mt-1">Les templates statiques seront utilisés comme fallback.</p>
                        </div>
                    )}

                    {templates.map(t => (
                        <div
                            key={t.id}
                            className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${t.isActive
                                ? 'bg-slate-700/30 border-slate-600'
                                : 'bg-slate-800/50 border-slate-700/50 opacity-60'
                                }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <code className="text-xs bg-slate-900/80 px-2 py-0.5 rounded text-cyan-400">{t.internalKey}</code>
                                    <span className="text-slate-500">→</span>
                                    <code className="text-xs bg-slate-900/80 px-2 py-0.5 rounded text-amber-400">{t.providerTemplateName}</code>
                                    <span className="text-xs text-slate-500">({t.language})</span>
                                </div>
                                {t.fallbackText && (
                                    <p className="text-xs text-slate-500 mt-1 truncate">{t.fallbackText}</p>
                                )}
                            </div>
                            <button
                                onClick={() => toggleTemplate(t.id, t.isActive)}
                                className={`p-1.5 rounded transition-colors ${t.isActive ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-slate-500 hover:bg-slate-600/30'
                                    }`}
                            >
                                {t.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            </button>
                        </div>
                    ))}

                    {/* New Template Form */}
                    {showNewTemplate && (
                        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 space-y-3">
                            <h3 className="text-sm font-medium text-cyan-400">Nouveau template</h3>

                            {/* Suggested Templates */}
                            <div className="flex flex-wrap gap-2">
                                {SUGGESTED_TEMPLATES
                                    .filter(s => !templates.some(t => t.internalKey === s.key))
                                    .map(s => (
                                        <button
                                            key={s.key}
                                            onClick={() => setNewTemplate({
                                                internalKey: s.key,
                                                providerTemplateName: s.key.toLowerCase(),
                                                fallbackText: s.defaultFallback,
                                            })}
                                            className="text-xs px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-slate-300 hover:bg-slate-600/50 transition-colors"
                                        >
                                            {s.label}
                                        </button>
                                    ))
                                }
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Clé interne</label>
                                    <input
                                        type="text"
                                        value={newTemplate.internalKey}
                                        onChange={e => setNewTemplate({ ...newTemplate, internalKey: e.target.value })}
                                        placeholder="RDV_CONFIRMATION"
                                        className="w-full bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Nom template provider</label>
                                    <input
                                        type="text"
                                        value={newTemplate.providerTemplateName}
                                        onChange={e => setNewTemplate({ ...newTemplate, providerTemplateName: e.target.value })}
                                        placeholder="rdv_confirm_v1"
                                        className="w-full bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Texte de fallback</label>
                                <textarea
                                    value={newTemplate.fallbackText}
                                    onChange={e => setNewTemplate({ ...newTemplate, fallbackText: e.target.value })}
                                    placeholder="Bonjour {{name}}, ..."
                                    rows={2}
                                    className="w-full bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => { setShowNewTemplate(false); setNewTemplate({ internalKey: '', providerTemplateName: '', fallbackText: '' }); }}
                                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={addTemplate}
                                    disabled={!newTemplate.internalKey || !newTemplate.providerTemplateName}
                                    className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    Ajouter
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Meta Template Manager - only when Meta Cloud selected */}
            {provider === 'META_CLOUD' && (
                <MetaTemplateManager
                    isMetaConfigured={true}
                />
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <AlertTriangle size={12} />
                    <span>L&apos;envoi réel nécessite des credentials valides chez le fournisseur choisi.</span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={testSend}
                        disabled={testing || !isActive}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-600/30 disabled:opacity-50 transition-colors"
                    >
                        {testing ? <Loader2 size={16} className="animate-spin" /> : <TestTube size={16} />}
                        Tester l&apos;envoi
                    </button>
                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg shadow-lg shadow-cyan-900/20 disabled:opacity-50 transition-all font-medium"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Sauvegarder
                    </button>
                </div>
            </div>
        </div>
    );
}

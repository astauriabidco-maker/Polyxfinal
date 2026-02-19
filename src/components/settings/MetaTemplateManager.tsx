'use client';

import { useState, useEffect } from 'react';
import {
    RefreshCw, Plus, Trash2, Send, Loader2, CheckCircle,
    Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp, Eye
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface MetaTemplate {
    id: string;
    name: string;
    language: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    components: MetaTemplateComponent[];
    rejected_reason?: string;
}

interface MetaTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: string;
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

// ─── Status Badge ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    APPROVED: { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', label: 'Approuvé' },
    PENDING: { icon: Clock, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30', label: 'En attente' },
    REJECTED: { icon: XCircle, color: 'text-red-400 bg-red-500/15 border-red-500/30', label: 'Rejeté' },
    PAUSED: { icon: AlertTriangle, color: 'text-slate-400 bg-slate-500/15 border-slate-500/30', label: 'Suspendu' },
    DISABLED: { icon: XCircle, color: 'text-slate-500 bg-slate-600/15 border-slate-600/30', label: 'Désactivé' },
};

const CATEGORY_LABELS: Record<string, string> = {
    UTILITY: '🔧 Utilitaire',
    MARKETING: '📢 Marketing',
    AUTHENTICATION: '🔐 Authentification',
};

const LANGUAGE_OPTIONS = [
    { value: 'fr', label: '🇫🇷 Français' },
    { value: 'en_US', label: '🇺🇸 English (US)' },
    { value: 'en', label: '🇬🇧 English' },
    { value: 'es', label: '🇪🇸 Español' },
    { value: 'de', label: '🇩🇪 Deutsch' },
    { value: 'it', label: '🇮🇹 Italiano' },
    { value: 'pt_BR', label: '🇧🇷 Português' },
    { value: 'ar', label: '🇸🇦 العربية' },
];

// ─── Component ───────────────────────────────────────────────

interface Props {
    isMetaConfigured: boolean;
}

export default function MetaTemplateManager({ isMetaConfigured }: Props) {
    const [templates, setTemplates] = useState<MetaTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

    // Create Form
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createResult, setCreateResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    // New template form fields
    const [newName, setNewName] = useState('');
    const [newLang, setNewLang] = useState('fr');
    const [newCategory, setNewCategory] = useState<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
    const [newHeaderText, setNewHeaderText] = useState('');
    const [newBodyText, setNewBodyText] = useState('');
    const [newFooterText, setNewFooterText] = useState('');
    const [newButtons, setNewButtons] = useState<Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>>([]);

    // ─── Load Templates from Meta ────────────────────────────

    const loadTemplates = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/messaging/templates/meta');
            const data = await res.json();
            if (res.ok) {
                setTemplates(data.templates || []);
            } else {
                setError(data.error || 'Erreur de chargement');
            }
        } catch {
            setError('Erreur réseau');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isMetaConfigured) loadTemplates();
    }, [isMetaConfigured]);

    // ─── Create Template ─────────────────────────────────────

    const createTemplate = async () => {
        if (!newName || !newBodyText) return;
        setCreating(true);
        setCreateResult(null);

        const components: any[] = [];

        if (newHeaderText.trim()) {
            components.push({ type: 'HEADER', format: 'TEXT', text: newHeaderText });
        }

        // Body with example values for parameters
        const bodyParams = newBodyText.match(/\{\{\d+\}\}/g) || [];
        const bodyComponent: any = { type: 'BODY', text: newBodyText };
        if (bodyParams.length > 0) {
            bodyComponent.example = {
                body_text: [bodyParams.map((_, i) => `exemple_${i + 1}`)],
            };
        }
        components.push(bodyComponent);

        if (newFooterText.trim()) {
            components.push({ type: 'FOOTER', text: newFooterText });
        }

        if (newButtons.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: newButtons.map(b => ({
                    type: b.type,
                    text: b.text,
                    ...(b.type === 'URL' && b.url && { url: b.url }),
                })),
            });
        }

        try {
            const res = await fetch('/api/messaging/templates/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    language: newLang,
                    category: newCategory,
                    components,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setCreateResult({ type: 'success', text: `✅ Template soumis (statut: ${data.status})` });
                resetForm();
                loadTemplates(); // Refresh list
            } else {
                setCreateResult({ type: 'error', text: `❌ ${data.error || 'Erreur'}` });
            }
        } catch {
            setCreateResult({ type: 'error', text: '❌ Erreur réseau' });
        } finally {
            setCreating(false);
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewBodyText('');
        setNewHeaderText('');
        setNewFooterText('');
        setNewButtons([]);
        setShowCreateForm(false);
    };

    // ─── Delete Template ─────────────────────────────────────

    const deleteTemplate = async (name: string) => {
        if (!confirm(`Supprimer le template "${name}" chez Meta ? Cette action est irréversible.`)) return;
        setDeleting(name);
        try {
            const res = await fetch('/api/messaging/templates/meta', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                loadTemplates();
            }
        } catch {
            // silent
        } finally {
            setDeleting(null);
        }
    };

    // ─── Preview Template ────────────────────────────────────

    const renderPreview = () => {
        if (!newBodyText) return null;
        return (
            <div className="bg-slate-900/80 border border-slate-600 rounded-xl p-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                    <Eye size={14} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-400 uppercase">Aperçu du message</span>
                </div>
                <div className="bg-green-900/30 border border-green-800/40 rounded-lg p-3 max-w-sm">
                    {newHeaderText && (
                        <p className="text-sm font-bold text-white mb-1">{newHeaderText}</p>
                    )}
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">
                        {newBodyText.replace(/\{\{(\d+)\}\}/g, (_, i) => `[param ${i}]`)}
                    </p>
                    {newFooterText && (
                        <p className="text-xs text-slate-500 mt-2">{newFooterText}</p>
                    )}
                    {newButtons.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-green-800/40 pt-2">
                            {newButtons.map((btn, i) => (
                                <div key={i} className="text-center text-xs text-cyan-400 py-1 border border-cyan-500/20 rounded">
                                    {btn.text}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">🏭 Templates Meta WhatsApp</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Créez et soumettez des templates directement auprès de Meta pour approbation.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadTemplates}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                        title="Rafraîchir"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-600/30 transition-colors"
                    >
                        <Plus size={14} /> Nouveau Template
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    ⚠️ {error}
                </div>
            )}

            {/* Create Result Toast */}
            {createResult && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${createResult.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                    {createResult.text}
                </div>
            )}

            {/* Create Form */}
            {showCreateForm && (
                <div className="mb-6 bg-green-500/5 border border-green-500/20 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-green-400">✨ Créer un nouveau template</h3>

                    {/* Name & Language & Category */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Nom *</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                placeholder="rdv_confirmation"
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
                            />
                            <p className="text-[10px] text-slate-600 mt-0.5">Minuscules, chiffres, underscores</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Langue *</label>
                            <select
                                value={newLang}
                                onChange={e => setNewLang(e.target.value)}
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/50"
                            >
                                {LANGUAGE_OPTIONS.map(l => (
                                    <option key={l.value} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Catégorie *</label>
                            <select
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value as any)}
                                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/50"
                            >
                                <option value="UTILITY">🔧 Utilitaire</option>
                                <option value="MARKETING">📢 Marketing</option>
                                <option value="AUTHENTICATION">🔐 Authentification</option>
                            </select>
                        </div>
                    </div>

                    {/* Header */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">En-tête (optionnel)</label>
                        <input
                            type="text"
                            value={newHeaderText}
                            onChange={e => setNewHeaderText(e.target.value)}
                            placeholder="Polyx Formation"
                            maxLength={60}
                            className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Corps du message * <span className="text-slate-600">(utilisez {"{{1}}"}, {"{{2}}"} pour les variables)</span></label>
                        <textarea
                            value={newBodyText}
                            onChange={e => setNewBodyText(e.target.value)}
                            placeholder={"Bonjour {{1}}, nous vous confirmons votre rendez-vous le {{2}}. Cordialement, l'équipe Polyx."}
                            rows={4}
                            maxLength={1024}
                            className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500/50 resize-none"
                        />
                        <p className="text-[10px] text-slate-600 mt-0.5">{newBodyText.length}/1024 caractères</p>
                    </div>

                    {/* Footer */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Pied de page (optionnel)</label>
                        <input
                            type="text"
                            value={newFooterText}
                            onChange={e => setNewFooterText(e.target.value)}
                            placeholder="Polyx Formation • Ne pas répondre"
                            maxLength={60}
                            className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
                        />
                    </div>

                    {/* Buttons */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-slate-400">Boutons (optionnel, max 3)</label>
                            {newButtons.length < 3 && (
                                <button
                                    onClick={() => setNewButtons([...newButtons, { type: 'QUICK_REPLY', text: '' }])}
                                    className="text-xs text-cyan-400 hover:text-cyan-300"
                                >
                                    + Ajouter un bouton
                                </button>
                            )}
                        </div>
                        {newButtons.map((btn, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                                <select
                                    value={btn.type}
                                    onChange={e => {
                                        const updated = [...newButtons];
                                        updated[idx] = { ...btn, type: e.target.value as any };
                                        setNewButtons(updated);
                                    }}
                                    className="bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-white w-32"
                                >
                                    <option value="QUICK_REPLY">Réponse rapide</option>
                                    <option value="URL">Lien URL</option>
                                </select>
                                <input
                                    type="text"
                                    value={btn.text}
                                    onChange={e => {
                                        const updated = [...newButtons];
                                        updated[idx] = { ...btn, text: e.target.value };
                                        setNewButtons(updated);
                                    }}
                                    placeholder="Texte du bouton"
                                    className="flex-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
                                />
                                {btn.type === 'URL' && (
                                    <input
                                        type="url"
                                        value={btn.url || ''}
                                        onChange={e => {
                                            const updated = [...newButtons];
                                            updated[idx] = { ...btn, url: e.target.value };
                                            setNewButtons(updated);
                                        }}
                                        placeholder="https://..."
                                        className="flex-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
                                    />
                                )}
                                <button
                                    onClick={() => setNewButtons(newButtons.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-300 p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Preview */}
                    {renderPreview()}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={createTemplate}
                            disabled={creating || !newName || !newBodyText}
                            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-lg shadow-green-900/20"
                        >
                            {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Soumettre à Meta
                        </button>
                    </div>
                </div>
            )}

            {/* Templates List */}
            <div className="space-y-2">
                {loading && templates.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-slate-500">
                        <Loader2 size={20} className="animate-spin mr-2" />
                        Chargement des templates Meta...
                    </div>
                )}

                {!loading && templates.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                        <p className="text-sm">Aucun template trouvé sur votre compte Meta.</p>
                        <p className="text-xs mt-1">Créez votre premier template ci-dessus.</p>
                    </div>
                )}

                {templates.map(tpl => {
                    const statusConf = STATUS_CONFIG[tpl.status] || STATUS_CONFIG.PENDING;
                    const StatusIcon = statusConf.icon;
                    const isExpanded = expandedTemplate === tpl.id;
                    const bodyComponent = tpl.components?.find(c => c.type === 'BODY');

                    return (
                        <div key={tpl.id} className="border border-slate-700 rounded-lg overflow-hidden transition-all hover:border-slate-600">
                            {/* Template Header Row */}
                            <div
                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
                                onClick={() => setExpandedTemplate(isExpanded ? null : tpl.id)}
                            >
                                {/* Status */}
                                <span className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${statusConf.color}`}>
                                    <StatusIcon size={12} />
                                    {statusConf.label}
                                </span>

                                {/* Name */}
                                <code className="text-sm text-cyan-400 font-mono">{tpl.name}</code>

                                {/* Language */}
                                <span className="text-xs text-slate-500">{tpl.language}</span>

                                {/* Category */}
                                <span className="text-xs text-slate-500 ml-auto">
                                    {CATEGORY_LABELS[tpl.category] || tpl.category}
                                </span>

                                {/* Expand */}
                                {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t border-slate-700 bg-slate-900/30 p-4 space-y-3">
                                    {/* Rejected Reason */}
                                    {tpl.status === 'REJECTED' && tpl.rejected_reason && (
                                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                            ❌ Raison du refus : {tpl.rejected_reason}
                                        </div>
                                    )}

                                    {/* Components */}
                                    {tpl.components?.map((comp, i) => (
                                        <div key={i}>
                                            <span className="text-[10px] uppercase font-medium text-slate-500">{comp.type}</span>
                                            {comp.text && (
                                                <p className="text-sm text-slate-300 mt-0.5 whitespace-pre-wrap">{comp.text}</p>
                                            )}
                                            {comp.buttons && (
                                                <div className="flex gap-2 mt-1">
                                                    {comp.buttons.map((btn, j) => (
                                                        <span key={j} className="text-xs px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-slate-300">
                                                            {btn.text}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Actions */}
                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteTemplate(tpl.name); }}
                                            disabled={deleting === tpl.name}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {deleting === tpl.name ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                            Supprimer chez Meta
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

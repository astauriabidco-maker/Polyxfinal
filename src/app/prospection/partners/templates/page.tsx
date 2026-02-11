/**
 * ADMIN — Éditeur de Templates de Documents Partenaires
 * =====================================================
 * Page d'administration pour personnaliser les modèles de :
 *   - Contrat de Partenariat API
 *   - DPA (Data Processing Agreement)
 *
 * Fonctionnalités :
 *   - Éditeur de sections (titre + contenu avec variables)
 *   - Liste des variables {{...}} disponibles avec copier-coller
 *   - Prévisualisation PDF en temps réel
 *   - Historique des versions + restauration
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

// ─── Types ────────────────────────────────────────────────────

interface TemplateSection {
    title: string;
    content: string;
}

interface DocumentTemplate {
    id: string;
    type: 'CONTRACT' | 'DPA' | 'CGV';
    title: string;
    version: number;
    isActive: boolean;
    sections: TemplateSection[];
    footerText: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
}

// ─── Page Component ───────────────────────────────────────────

export default function DocumentTemplatesPage() {
    // State
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Editor state
    const [selectedType, setSelectedType] = useState<'CONTRACT' | 'DPA'>('CONTRACT');
    const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
    const [editSections, setEditSections] = useState<TemplateSection[]>([]);
    const [editTitle, setEditTitle] = useState('');
    const [editFooter, setEditFooter] = useState('');
    const [saving, setSaving] = useState(false);
    const [showVariables, setShowVariables] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [copiedVar, setCopiedVar] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<number | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // ─── Data fetching ────────────────────────────────────────

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetch('/api/document-templates');
            if (!res.ok) throw new Error('Erreur de chargement');
            const data = await res.json();
            setTemplates(data.templates || []);
            setVariables(data.variables || {});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // ─── Select template for editing ──────────────────────────

    useEffect(() => {
        const active = templates.find(t => t.type === selectedType && t.isActive);
        if (active) {
            setEditingTemplate(active);
            setEditSections(JSON.parse(JSON.stringify(active.sections)));
            setEditTitle(active.title);
            setEditFooter(active.footerText || '');
            setHasChanges(false);
            setExpandedSection(null);
        }
    }, [selectedType, templates]);

    // ─── Handlers ─────────────────────────────────────────────

    const handleSectionChange = (index: number, field: 'title' | 'content', value: string) => {
        const updated = [...editSections];
        updated[index] = { ...updated[index], [field]: value };
        setEditSections(updated);
        setHasChanges(true);
    };

    const handleAddSection = () => {
        setEditSections([...editSections, { title: 'Nouvelle section', content: '' }]);
        setExpandedSection(editSections.length);
        setHasChanges(true);
    };

    const handleRemoveSection = (index: number) => {
        if (editSections.length <= 1) return;
        setEditSections(editSections.filter((_, i) => i !== index));
        setHasChanges(true);
    };

    const handleMoveSection = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= editSections.length) return;
        const updated = [...editSections];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        setEditSections(updated);
        setExpandedSection(newIndex);
        setHasChanges(true);
    };

    const handleCopyVariable = (variable: string) => {
        navigator.clipboard.writeText(variable);
        setCopiedVar(variable);
        setTimeout(() => setCopiedVar(null), 1500);
    };

    const handleSave = async () => {
        if (!editingTemplate) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/document-templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: editingTemplate.id,
                    title: editTitle,
                    sections: editSections,
                    footerText: editFooter,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur');

            setSuccess(data.message || 'Template sauvegardé !');
            setHasChanges(false);
            await fetchTemplates();
            setTimeout(() => setSuccess(null), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur');
        } finally {
            setSaving(false);
        }
    };

    const handleRestore = async (templateId: string) => {
        try {
            const res = await fetch('/api/document-templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, action: 'restore' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(data.message || 'Version restaurée !');
            setShowHistory(false);
            await fetchTemplates();
            setTimeout(() => setSuccess(null), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur');
        }
    };

    const handleResetChanges = () => {
        if (!editingTemplate) return;
        setEditSections(JSON.parse(JSON.stringify(editingTemplate.sections)));
        setEditTitle(editingTemplate.title);
        setEditFooter(editingTemplate.footerText || '');
        setHasChanges(false);
    };

    // ─── Computed ─────────────────────────────────────────────

    const activeTemplate = templates.find(t => t.type === selectedType && t.isActive);
    const versionHistory = templates
        .filter(t => t.type === selectedType)
        .sort((a, b) => b.version - a.version);
    const totalSections = editSections.length;

    // Group variables
    const variableGroups: Record<string, [string, string][]> = {};
    Object.entries(variables).forEach(([key, desc]) => {
        const group = key.startsWith('{{org.') ? 'Organisation' :
            key.startsWith('{{partner.') ? 'Partenaire' :
                key.startsWith('{{date.') ? 'Dates' : 'Autre';
        if (!variableGroups[group]) variableGroups[group] = [];
        variableGroups[group].push([key, desc]);
    });

    // ─── Loading ──────────────────────────────────────────────

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500" />
                        <p className="text-slate-400 text-sm">Chargement des templates...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // ─── Render ───────────────────────────────────────────────

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* ═══ Header ═══ */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">📝</span>
                            Templates Documents Partenaires
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Personnalisez les modèles de Contrat et DPA envoyés à vos partenaires API
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowVariables(!showVariables)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${showVariables
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                }`}
                        >
                            <span>{showVariables ? '✕' : '{' + '}'}</span>
                            Variables
                        </button>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${showHistory
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                }`}
                        >
                            🕒 Historique
                        </button>
                    </div>
                </div>

                {/* ═══ Alerts ═══ */}
                {error && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                        ⚠️ {error}
                        <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
                    </div>
                )}
                {success && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                        ✅ {success}
                    </div>
                )}

                {/* ═══ Document Type Tabs ═══ */}
                <div className="flex gap-3 mb-6">
                    {(['CONTRACT', 'DPA'] as const).map(type => {
                        const activeT = templates.find(t => t.type === type && t.isActive);
                        return (
                            <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                className={`flex-1 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${selectedType === type
                                        ? 'border-purple-500 bg-purple-500/10'
                                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{type === 'CONTRACT' ? '📄' : '🛡️'}</span>
                                    <div>
                                        <h3 className="text-white font-bold">
                                            {type === 'CONTRACT' ? 'Contrat de Partenariat' : 'DPA (RGPD Art. 28)'}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {activeT
                                                ? `v${activeT.version} • ${activeT.sections.length} sections`
                                                : 'Non initialisé'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* ═══ Main Layout ═══ */}
                <div className="flex gap-6">
                    {/* ─── Editor ── */}
                    <div className={`flex-1 ${showVariables || showHistory ? 'max-w-[calc(100%-380px)]' : ''} transition-all`}>
                        {/* Title Field */}
                        {editingTemplate && (
                            <div className="mb-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Titre du document
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => { setEditTitle(e.target.value); setHasChanges(true); }}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                />
                            </div>
                        )}

                        {/* Sections */}
                        <div className="space-y-3">
                            {editSections.map((section, index) => (
                                <div
                                    key={index}
                                    className={`bg-slate-900/50 border rounded-2xl transition-all duration-200 ${expandedSection === index
                                            ? 'border-purple-500/50 shadow-lg shadow-purple-500/5'
                                            : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    {/* Section Header */}
                                    <div
                                        className="flex items-center gap-3 p-4 cursor-pointer"
                                        onClick={() => setExpandedSection(expandedSection === index ? null : index)}
                                    >
                                        <span className="text-slate-500 text-sm font-mono w-6 text-center">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{section.title || 'Section sans titre'}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {section.content.length} caractères
                                                {section.content.match(/\{\{/g)?.length
                                                    ? ` • ${section.content.match(/\{\{/g)?.length} variables`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveSection(index, 'up'); }}
                                                disabled={index === 0}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                                                title="Monter"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveSection(index, 'down'); }}
                                                disabled={index === editSections.length - 1}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                                                title="Descendre"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveSection(index); }}
                                                disabled={editSections.length <= 1}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                                                title="Supprimer"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                            <svg
                                                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${expandedSection === index ? 'rotate-180' : ''
                                                    }`}
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Section Body (Expanded) */}
                                    {expandedSection === index && (
                                        <div className="px-4 pb-4 border-t border-slate-800">
                                            <div className="pt-4 space-y-3">
                                                {/* Section Title */}
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                                        Titre de la section
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={section.title}
                                                        onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none transition-all"
                                                    />
                                                </div>

                                                {/* Section Content */}
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                                        Contenu (supporte les variables {'{{...}}'})
                                                    </label>
                                                    <textarea
                                                        value={section.content}
                                                        onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
                                                        rows={Math.min(20, Math.max(6, section.content.split('\n').length + 2))}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono leading-relaxed focus:border-purple-500 outline-none transition-all resize-y"
                                                        spellCheck={false}
                                                    />
                                                    {/* Variable highlights */}
                                                    {section.content.match(/\{\{[^}]+\}\}/g) && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {[...new Set(section.content.match(/\{\{[^}]+\}\}/g))].map(v => (
                                                                <span
                                                                    key={v}
                                                                    className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                                                >
                                                                    {v}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Add Section Button */}
                            <button
                                onClick={handleAddSection}
                                className="w-full py-3 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 hover:text-purple-400 hover:border-purple-500/30 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Ajouter une section
                            </button>
                        </div>

                        {/* Footer Text */}
                        {editingTemplate && (
                            <div className="mt-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Pied de page du PDF
                                </label>
                                <input
                                    type="text"
                                    value={editFooter}
                                    onChange={(e) => { setEditFooter(e.target.value); setHasChanges(true); }}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:border-purple-500 outline-none transition-all"
                                    placeholder="Ex: Contrat de Partenariat API — {{org.name}} × {{partner.companyName}}"
                                />
                            </div>
                        )}

                        {/* ═══ Action Bar ═══ */}
                        <div className="sticky bottom-0 mt-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 -mx-6 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                    <span>{totalSections} sections</span>
                                    {activeTemplate && (
                                        <span>v{activeTemplate.version}</span>
                                    )}
                                    {hasChanges && (
                                        <span className="text-amber-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                            Modifications non sauvegardées
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {editingTemplate && (
                                        <button
                                            onClick={() => setShowPreview(true)}
                                            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all text-sm font-medium flex items-center gap-2"
                                        >
                                            👁️ Prévisualiser
                                        </button>
                                    )}
                                    {hasChanges && (
                                        <button
                                            onClick={handleResetChanges}
                                            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-sm"
                                        >
                                            Annuler
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={!hasChanges || saving}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Sauvegarde...
                                            </>
                                        ) : (
                                            <>💾 Sauvegarder (nouvelle version)</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── Side Panel: Variables ── */}
                    {showVariables && (
                        <div className="w-[360px] shrink-0">
                            <div className="sticky top-20 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <span className="text-lg">{'{' + '}'}</span>
                                        Variables disponibles
                                    </h3>
                                    <button
                                        onClick={() => setShowVariables(false)}
                                        className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                                    <p className="text-xs text-slate-500 mb-4 px-1">
                                        Cliquez sur une variable pour la copier, puis collez-la dans le contenu d&apos;une section.
                                    </p>
                                    {Object.entries(variableGroups).map(([group, vars]) => (
                                        <div key={group} className="mb-4">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                                                {group}
                                            </h4>
                                            <div className="space-y-1">
                                                {vars.map(([key, desc]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => handleCopyVariable(key)}
                                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all group ${copiedVar === key
                                                                ? 'bg-emerald-500/10 border border-emerald-500/30'
                                                                : 'hover:bg-slate-800 border border-transparent'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <code className={`text-xs font-mono ${copiedVar === key ? 'text-emerald-400' : 'text-purple-400'
                                                                }`}>
                                                                {key}
                                                            </code>
                                                            <span className={`text-xs ${copiedVar === key ? 'text-emerald-400' : 'text-slate-500 opacity-0 group-hover:opacity-100'
                                                                } transition-opacity`}>
                                                                {copiedVar === key ? '✓ copié' : 'copier'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Side Panel: Version History ── */}
                    {showHistory && (
                        <div className="w-[360px] shrink-0">
                            <div className="sticky top-20 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        🕒 Historique des versions
                                    </h3>
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                                    {versionHistory.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-6">Aucun historique</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {versionHistory.map(t => (
                                                <div
                                                    key={t.id}
                                                    className={`p-3 rounded-xl border transition-all ${t.isActive
                                                            ? 'bg-purple-500/10 border-purple-500/30'
                                                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-white font-bold text-sm">
                                                            v{t.version}
                                                        </span>
                                                        {t.isActive ? (
                                                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleRestore(t.id)}
                                                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                                            >
                                                                Restaurer
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400">
                                                        {t.sections.length} sections •{' '}
                                                        {new Date(t.createdAt).toLocaleDateString('fr-FR', {
                                                            day: '2-digit', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </p>
                                                    {t.createdBy && t.createdBy !== 'SYSTEM' && (
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            par {t.createdBy}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ PDF Preview Modal ═══ */}
                {showPreview && editingTemplate && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
                        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{selectedType === 'CONTRACT' ? '📄' : '🛡️'}</span>
                                <div>
                                    <h2 className="text-white font-bold">Prévisualisation PDF</h2>
                                    <p className="text-xs text-slate-400">
                                        {editTitle} — v{activeTemplate?.version || 1}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
                                    ⚠️ Nécessite un partenaire existant pour les données réelles
                                </p>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-8 overflow-auto">
                            {/* Text rendered preview (no PDF needed — shows structure) */}
                            <div className="max-w-3xl mx-auto bg-white text-gray-900 rounded-lg shadow-2xl p-12">
                                <div className="border-b-2 border-purple-600 pb-4 mb-8">
                                    <h1 className="text-xl font-bold text-indigo-900">{editTitle}</h1>
                                    <p className="text-sm text-gray-500 italic mt-1">
                                        {'{{org.name}}'} — Généré le {'{{date.today}}'}
                                    </p>
                                </div>

                                {editSections.map((section, i) => (
                                    <div key={i} className="mb-6">
                                        <h2 className="text-sm font-bold uppercase text-purple-800 bg-gray-100 px-3 py-1.5 border-l-3 border-purple-600 mb-3">
                                            {section.title}
                                        </h2>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap pl-1">
                                            {section.content.split('\n').map((line, j) => {
                                                // Highlight variables in preview
                                                const parts = line.split(/(\{\{[^}]+\}\})/g);
                                                return (
                                                    <p key={j} className="mb-1">
                                                        {parts.map((part, k) =>
                                                            part.startsWith('{{') ? (
                                                                <span key={k} className="bg-purple-100 text-purple-700 px-1 rounded font-mono text-xs">
                                                                    {part}
                                                                </span>
                                                            ) : (
                                                                <span key={k}>{part}</span>
                                                            )
                                                        )}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                <div className="border-t border-gray-200 pt-3 mt-8 text-center text-xs text-gray-400">
                                    {editFooter || 'Document généré par Polyx ERP Compliance Engine'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

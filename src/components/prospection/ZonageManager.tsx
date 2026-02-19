/**
 * ZONAGE MANAGER — Composant client de configuration du zonage
 * ==============================================================
 * Tableau des mappings, formulaire d'ajout, test live, stats.
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Zone {
    id: string;
    prefix: string;
    label: string | null;
    isActive: boolean;
    siteId: string;
    siteName: string;
    siteCity: string;
    siteZipCode: string;
    createdAt: string;
}

interface SiteOption {
    id: string;
    name: string;
    city: string;
}

interface Props {
    zones: Zone[];
    sites: SiteOption[];
    stats: {
        totalLeads: number;
        dispatchedLeads: number;
        totalZones: number;
    };
}

export default function ZonageManager({ zones, sites, stats }: Props) {
    const router = useRouter();
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Add form
    const [newPrefix, setNewPrefix] = useState('');
    const [newSiteId, setNewSiteId] = useState('');
    const [newLabel, setNewLabel] = useState('');

    // Edit form
    const [editPrefix, setEditPrefix] = useState('');
    const [editSiteId, setEditSiteId] = useState('');
    const [editLabel, setEditLabel] = useState('');

    // Test CP
    const [testCp, setTestCp] = useState('');
    const [testResult, setTestResult] = useState<{
        matched: boolean;
        siteName?: string;
        prefix?: string;
        label?: string;
        message?: string;
    } | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    // Bulk import
    const [showBulk, setShowBulk] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    const clearMessages = () => { setError(''); setSuccess(''); };

    // ─── Handlers ────────────────────────────────────────────

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        setLoading(true);
        try {
            const res = await fetch('/api/zonage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prefix: newPrefix, siteId: newSiteId, label: newLabel || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(`Zone "${newPrefix}" → ${sites.find(s => s.id === newSiteId)?.name || '?'} créée`);
            setNewPrefix(''); setNewSiteId(''); setNewLabel('');
            setShowAddForm(false);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async (zoneId: string) => {
        clearMessages();
        setLoading(true);
        try {
            const res = await fetch(`/api/zonage/${zoneId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prefix: editPrefix, siteId: editSiteId, label: editLabel || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('Zone modifiée');
            setEditingId(null);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (zoneId: string, isActive: boolean) => {
        try {
            await fetch(`/api/zonage/${zoneId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });
            router.refresh();
        } catch { }
    };

    const handleDelete = async (zoneId: string, prefix: string) => {
        if (!confirm(`Supprimer la zone "${prefix}" ?`)) return;
        clearMessages();
        try {
            const res = await fetch(`/api/zonage/${zoneId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Erreur suppression');
            setSuccess(`Zone "${prefix}" supprimée`);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleTest = useCallback(async () => {
        if (!testCp.trim()) return;
        setTestLoading(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/zonage/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codePostal: testCp }),
            });
            setTestResult(await res.json());
        } catch {
            setTestResult({ matched: false, message: 'Erreur de test' });
        } finally {
            setTestLoading(false);
        }
    }, [testCp]);

    const handleBulkImport = async () => {
        if (!bulkText.trim()) return;
        setBulkLoading(true);
        clearMessages();
        const lines = bulkText.split('\n').filter(l => l.trim());
        let created = 0;
        let errors: string[] = [];

        for (const line of lines) {
            const [prefix, siteNameOrId] = line.split(/[;,\t]/).map(s => s.trim());
            if (!prefix || !siteNameOrId) {
                errors.push(`Ligne invalide : "${line}"`);
                continue;
            }

            // Chercher le site par nom ou ID
            const site = sites.find(s =>
                s.id === siteNameOrId ||
                s.name.toLowerCase() === siteNameOrId.toLowerCase() ||
                s.name.toLowerCase().includes(siteNameOrId.toLowerCase())
            );
            if (!site) {
                errors.push(`Site introuvable : "${siteNameOrId}" pour le préfixe ${prefix}`);
                continue;
            }

            try {
                const res = await fetch('/api/zonage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prefix, siteId: site.id }),
                });
                if (res.ok) created++;
                else {
                    const d = await res.json();
                    errors.push(`${prefix}: ${d.error}`);
                }
            } catch {
                errors.push(`${prefix}: Erreur réseau`);
            }
        }

        setBulkLoading(false);
        setShowBulk(false);
        setBulkText('');
        setSuccess(`${created} zone(s) importée(s)${errors.length > 0 ? `. Erreurs : ${errors.join(' | ')}` : ''}`);
        router.refresh();
    };

    const startEdit = (zone: Zone) => {
        setEditingId(zone.id);
        setEditPrefix(zone.prefix);
        setEditSiteId(zone.siteId);
        setEditLabel(zone.label || '');
    };

    // Compute unique departements covered
    const deptsCovered = new Set(zones.filter(z => z.isActive).map(z => z.prefix.substring(0, 2)));

    return (
        <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <p className="text-sm text-slate-400">Zones configurées</p>
                    <p className="text-2xl font-bold text-white">{stats.totalZones}</p>
                </div>
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                    <p className="text-sm text-emerald-400">Départements couverts</p>
                    <p className="text-2xl font-bold text-emerald-300">{deptsCovered.size}</p>
                </div>
                <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                    <p className="text-sm text-cyan-400">Leads dispatchés</p>
                    <p className="text-2xl font-bold text-cyan-300">{stats.dispatchedLeads}</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                    <p className="text-sm text-amber-400">Taux dispatch</p>
                    <p className="text-2xl font-bold text-amber-300">
                        {stats.totalLeads > 0 ? Math.round(stats.dispatchedLeads / stats.totalLeads * 100) : 0}%
                    </p>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center justify-between">
                    {error} <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center justify-between">
                    {success} <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-300">✕</button>
                </div>
            )}

            {/* Actions Header */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                {/* Test CP */}
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1.5 border border-slate-700/50 flex-1 max-w-md">
                    <span className="text-sm text-slate-400 pl-2">🔍</span>
                    <input
                        type="text"
                        placeholder="Tester un CP (ex: 75011)"
                        value={testCp}
                        onChange={(e) => setTestCp(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                        className="flex-1 px-2 py-1.5 bg-transparent text-white text-sm focus:outline-none"
                    />
                    <button
                        onClick={handleTest}
                        disabled={testLoading || !testCp.trim()}
                        className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-md text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
                    >
                        {testLoading ? '...' : 'Tester'}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBulk(true)}
                        className="px-3 py-2 text-sm text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition-colors"
                    >
                        📋 Import bulk
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Nouvelle zone
                    </button>
                </div>
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`mb-4 p-4 rounded-lg border ${testResult.matched
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                    {testResult.matched ? (
                        <div className="flex items-center gap-3">
                            <span className="text-xl">✅</span>
                            <div>
                                <p className="font-medium">CP {testCp} → <span className="text-white">{testResult.siteName}</span></p>
                                <p className="text-xs mt-0.5 opacity-70">
                                    Préfixe matché : {testResult.prefix}{testResult.label ? ` (${testResult.label})` : ''}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <p>{testResult.message}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Zone Table */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-800/70">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Préfixe CP</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Agence / Site</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Label</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Actif</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {zones.map((zone) => (
                            <tr key={zone.id} className="hover:bg-slate-800/30 transition-colors">
                                {editingId === zone.id ? (
                                    <>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={editPrefix}
                                                onChange={(e) => setEditPrefix(e.target.value)}
                                                className="w-20 px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={editSiteId}
                                                onChange={(e) => setEditSiteId(e.target.value)}
                                                className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                            >
                                                {sites.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={editLabel}
                                                onChange={(e) => setEditLabel(e.target.value)}
                                                placeholder="Optionnel"
                                                className="w-40 px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">—</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(zone.id)}
                                                    disabled={loading}
                                                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                                                >
                                                    ✓ OK
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="text-slate-400 hover:text-white text-sm"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3">
                                            <span className="px-2.5 py-1 bg-slate-700/60 rounded-md text-white font-mono text-sm font-medium">
                                                {zone.prefix}
                                            </span>
                                            <span className="text-xs text-slate-500 ml-2">
                                                ({zone.prefix.length === 2 ? 'Département' : zone.prefix.length === 3 ? 'Sous-zone' : zone.prefix.length >= 5 ? 'CP exact' : 'Zone'})
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm text-white font-medium">{zone.siteName}</p>
                                                <p className="text-xs text-slate-400">{zone.siteCity}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-slate-300">{zone.label || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleToggle(zone.id, zone.isActive)}
                                                className={`w-9 h-5 rounded-full relative transition-colors ${zone.isActive ? 'bg-emerald-500' : 'bg-slate-600'
                                                    }`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${zone.isActive ? 'right-1' : 'left-1'
                                                    }`} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => startEdit(zone)}
                                                    className="text-cyan-400 hover:text-cyan-300 text-sm"
                                                    title="Modifier"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(zone.id, zone.prefix)}
                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                    title="Supprimer"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {zones.length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-5xl mb-3">🗺️</p>
                        <p className="text-lg font-medium text-slate-400">Aucune zone configurée</p>
                        <p className="text-sm mt-1">Ajoutez des mappings pour activer le dispatch automatique des leads.</p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-sm transition-colors"
                        >
                            + Ajouter la première zone
                        </button>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
                        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Nouvelle zone</h2>
                            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Préfixe CP *</label>
                                <input
                                    type="text"
                                    required
                                    value={newPrefix}
                                    onChange={(e) => setNewPrefix(e.target.value)}
                                    placeholder="Ex: 75, 691, 13001"
                                    maxLength={5}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    {newPrefix.length === 0 ? '1 à 5 chiffres' :
                                        newPrefix.length === 2 ? '→ Département entier' :
                                            newPrefix.length === 3 ? '→ Sous-zone' :
                                                newPrefix.length >= 5 ? '→ Code postal exact' : `→ Zone (${newPrefix.length} chiffres)`}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Agence / Site *</label>
                                <select
                                    required
                                    value={newSiteId}
                                    onChange={(e) => setNewSiteId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="" className="bg-slate-800">-- Sélectionner une agence --</option>
                                    {sites.map(s => (
                                        <option key={s.id} value={s.id} className="bg-slate-800">
                                            {s.name} — {s.city}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Label (optionnel)</label>
                                <input
                                    type="text"
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    placeholder="Ex: Île-de-France, Rhône-Alpes"
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Annuler</button>
                                <button type="submit" disabled={loading || !newPrefix || !newSiteId}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50">
                                    {loading ? 'Création...' : 'Créer la zone'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulk && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
                        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Import bulk</h2>
                            <button onClick={() => setShowBulk(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-400">
                                Collez une liste au format <code className="text-cyan-400">préfixe;nom_agence</code> (une ligne par zone) :
                            </p>
                            <textarea
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                                placeholder={"75;Campus Paris\n69;Campus Lyon\n13;Campus Marseille\n33;Campus Bordeaux"}
                                rows={8}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
                                <p className="text-xs text-slate-400">
                                    <strong className="text-slate-300">Agences disponibles :</strong>{' '}
                                    {sites.map(s => s.name).join(', ')}
                                </p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Annuler</button>
                                <button
                                    onClick={handleBulkImport}
                                    disabled={bulkLoading || !bulkText.trim()}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50"
                                >
                                    {bulkLoading ? 'Import...' : `Importer (${bulkText.split('\n').filter(l => l.trim()).length} lignes)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

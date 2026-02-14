/**
 * ROLES MANAGER - Composant client pour la gestion des rôles
 * ===========================================================
 * Affiche la liste des rôles avec :
 * - Actions CRUD (créer, modifier, supprimer)
 * - Panneau de configuration des permissions par module
 * - Checkboxes groupées par catégorie
 * Les rôles système sont protégés (lecture seule sur le CRUD mais permissions modifiables).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface RoleData {
    id: string;
    name: string;
    code: string;
    description: string;
    isSystem: boolean;
    usageCount: number;
    createdAt: string;
}

interface PermissionItem {
    id: string;
    code: string;
    description: string;
    active: boolean;
}

interface PermissionsData {
    roleId: string;
    roleName: string;
    roleCode: string;
    isSystem: boolean;
    categories: Record<string, PermissionItem[]>;
    totalActive: number;
    totalPermissions: number;
}

interface Props {
    initialRoles: RoleData[];
}

export default function RolesManager({ initialRoles }: Props) {
    const router = useRouter();
    const [roles, setRoles] = useState<RoleData[]>(initialRoles);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Permission panel state
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [permissionsData, setPermissionsData] = useState<PermissionsData | null>(null);
    const [permLoading, setPermLoading] = useState(false);
    const [permSaving, setPermSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ name: '', code: '', description: '' });

    const resetForm = () => {
        setFormData({ name: '', code: '', description: '' });
        setError('');
    };

    // ─── Load Permissions for a Role ─────────────────────────

    const loadPermissions = useCallback(async (roleId: string) => {
        setPermLoading(true);
        try {
            const res = await fetch(`/api/roles/${roleId}/permissions`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPermissionsData(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPermLoading(false);
        }
    }, []);

    const handleSelectRole = (roleId: string) => {
        if (selectedRoleId === roleId) {
            setSelectedRoleId(null);
            setPermissionsData(null);
        } else {
            setSelectedRoleId(roleId);
            loadPermissions(roleId);
        }
    };

    // ─── Toggle Permission ───────────────────────────────────

    const togglePermission = (permId: string) => {
        if (!permissionsData) return;
        const updated = { ...permissionsData };
        let newActive = 0;
        for (const cat in updated.categories) {
            updated.categories[cat] = updated.categories[cat].map((p) => {
                const newP = p.id === permId ? { ...p, active: !p.active } : p;
                if (newP.active) newActive++;
                return newP;
            });
        }
        updated.totalActive = newActive;
        setPermissionsData(updated);
    };

    // Toggle entire category
    const toggleCategory = (category: string) => {
        if (!permissionsData) return;
        const perms = permissionsData.categories[category];
        const allActive = perms.every((p) => p.active);
        const updated = { ...permissionsData };
        updated.categories[category] = perms.map((p) => ({ ...p, active: !allActive }));
        // Recount
        let newActive = 0;
        for (const cat in updated.categories) {
            for (const p of updated.categories[cat]) {
                if (p.active) newActive++;
            }
        }
        updated.totalActive = newActive;
        setPermissionsData(updated);
    };

    // ─── Save Permissions ────────────────────────────────────

    const savePermissions = async () => {
        if (!permissionsData || !selectedRoleId) return;
        setPermSaving(true);
        setError('');

        const activeIds: string[] = [];
        for (const cat in permissionsData.categories) {
            for (const p of permissionsData.categories[cat]) {
                if (p.active) activeIds.push(p.id);
            }
        }

        try {
            const res = await fetch(`/api/roles/${selectedRoleId}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissionIds: activeIds }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(data.message);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPermSaving(false);
        }
    };

    // ─── Create Role ─────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShowCreateModal(false);
            resetForm();
            setSuccess(`Rôle "${data.role.name}" créé avec succès.`);
            router.refresh();
            setRoles([...roles, { ...data.role, usageCount: 0, createdAt: new Date().toISOString() }]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Update Role ─────────────────────────────────────────

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/roles/${editingRole.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.name, description: formData.description }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setEditingRole(null);
            resetForm();
            setSuccess(`Rôle "${data.role.name}" mis à jour.`);
            router.refresh();
            setRoles(roles.map((r) =>
                r.id === editingRole.id ? { ...r, name: formData.name, description: formData.description } : r
            ));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Delete Role ─────────────────────────────────────────

    const handleDelete = async (role: RoleData) => {
        if (!confirm(`Supprimer le rôle "${role.name}" ? Cette action est irréversible.`)) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(data.message);
            setRoles(roles.filter((r) => r.id !== role.id));
            if (selectedRoleId === role.id) {
                setSelectedRoleId(null);
                setPermissionsData(null);
            }
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Auto-generate code from name ────────────────────────

    const handleNameChange = (name: string) => {
        setFormData({
            ...formData,
            name,
            ...(showCreateModal && !editingRole ? {
                code: name
                    .toUpperCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^A-Z0-9]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '')
                    .substring(0, 30),
            } : {}),
        });
    };

    const systemCount = roles.filter(r => r.isSystem).length;
    const customCount = roles.filter(r => !r.isSystem).length;

    // Category icon map
    const categoryIcons: Record<string, string> = {
        'Vue d\'ensemble': '📊',
        'Gestion Opérationnelle': '📁',
        'Administration': '⚙️',
        'Conformité & Qualité': '🛡️',
        'Prospection': '🎯',
        'Réseau Franchise': '🏪',
    };

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        Rôles & Permissions
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {systemCount} rôle{systemCount > 1 ? 's' : ''} système · {customCount} rôle{customCount > 1 ? 's' : ''} personnalisé{customCount > 1 ? 's' : ''}
                        {' · '}
                        <span className="text-violet-400">Cliquez sur un rôle pour configurer ses accès</span>
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowCreateModal(true); }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-sm transition-all duration-200 flex items-center gap-2 shadow-lg shadow-violet-500/20"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nouveau rôle
                </button>
            </div>

            {/* Messages */}
            {success && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-emerald-400">{success}</p>
                    </div>
                    <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-300">✕</button>
                </div>
            )}

            {error && !showCreateModal && !editingRole && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Main Layout: Table + Permission Panel */}
            <div className="flex gap-6">
                {/* Roles Table */}
                <div className={`transition-all duration-300 ${selectedRoleId ? 'w-1/2' : 'w-full'}`}>
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rôle</th>
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Utilisateurs</th>
                                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {roles.map((role) => (
                                    <tr
                                        key={role.id}
                                        onClick={() => handleSelectRole(role.id)}
                                        className={`cursor-pointer transition-all duration-200 ${selectedRoleId === role.id
                                                ? 'bg-violet-500/10 border-l-2 border-l-violet-500'
                                                : 'hover:bg-slate-700/20 border-l-2 border-l-transparent'
                                            }`}
                                    >
                                        <td className="px-5 py-3.5">
                                            <div>
                                                <p className="text-sm font-medium text-white">{role.name}</p>
                                                <code className="text-xs text-violet-400/70 font-mono">{role.code}</code>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {role.isSystem ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    🔒 Système
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                    ✏️ Custom
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${role.usageCount > 0
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-slate-700/50 text-slate-500'
                                                }`}>
                                                {role.usageCount}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                {!role.isSystem && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setEditingRole(role);
                                                                setFormData({ name: role.name, code: role.code, description: role.description });
                                                                setError('');
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                                                            title="Modifier"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(role)}
                                                            disabled={role.usageCount > 0 || loading}
                                                            className={`p-1.5 rounded-lg transition-colors ${role.usageCount > 0
                                                                    ? 'text-slate-600 cursor-not-allowed'
                                                                    : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                                                                }`}
                                                            title={role.usageCount > 0 ? `Utilisé par ${role.usageCount} membre(s)` : 'Supprimer'}
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                                {role.isSystem && (
                                                    <span className="text-[10px] text-slate-600 italic">Protégé</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Permission Configuration Panel */}
                {selectedRoleId && (
                    <div className="w-1/2 transition-all duration-300">
                        <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden sticky top-6">
                            {permLoading ? (
                                <div className="p-8 text-center">
                                    <div className="animate-spin w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                                    <p className="text-sm text-slate-400">Chargement des permissions...</p>
                                </div>
                            ) : permissionsData ? (
                                <>
                                    {/* Panel Header */}
                                    <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                                🔐 Accès modules
                                                <code className="text-xs text-violet-400 font-mono bg-violet-500/10 px-2 py-0.5 rounded">
                                                    {permissionsData.roleCode}
                                                </code>
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {permissionsData.totalActive}/{permissionsData.totalPermissions} modules actifs
                                            </p>
                                        </div>
                                        <button
                                            onClick={savePermissions}
                                            disabled={permSaving}
                                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-medium transition-all disabled:opacity-60 flex items-center gap-1.5 shadow-lg shadow-violet-500/20"
                                        >
                                            {permSaving ? (
                                                <>
                                                    <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                                                    Enregistrement...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Enregistrer
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Permissions by Category */}
                                    <div className="p-4 max-h-[65vh] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                                        {Object.entries(permissionsData.categories).map(([category, perms]) => {
                                            const activeCount = perms.filter((p) => p.active).length;
                                            const allActive = perms.every((p) => p.active);
                                            const noneActive = perms.every((p) => !p.active);
                                            const icon = categoryIcons[category] || '📦';

                                            return (
                                                <div key={category} className="rounded-xl bg-slate-900/40 border border-slate-700/30 overflow-hidden">
                                                    {/* Category Header */}
                                                    <div
                                                        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-700/20 transition-colors"
                                                        onClick={() => toggleCategory(category)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">{icon}</span>
                                                            <span className="text-sm font-medium text-white">{category}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${allActive
                                                                    ? 'bg-emerald-500/15 text-emerald-400'
                                                                    : noneActive
                                                                        ? 'bg-slate-700/50 text-slate-500'
                                                                        : 'bg-amber-500/15 text-amber-400'
                                                                }`}>
                                                                {activeCount}/{perms.length}
                                                            </span>
                                                        </div>
                                                        {/* Select All Toggle */}
                                                        <div className={`w-9 h-5 rounded-full transition-colors relative ${allActive ? 'bg-violet-600' : 'bg-slate-700'
                                                            }`}>
                                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${allActive ? 'translate-x-4' : 'translate-x-0.5'
                                                                }`}></div>
                                                        </div>
                                                    </div>

                                                    {/* Permission Items */}
                                                    <div className="border-t border-slate-700/20">
                                                        {perms.map((perm) => (
                                                            <label
                                                                key={perm.id}
                                                                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/10 cursor-pointer transition-colors"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={perm.active}
                                                                    onChange={() => togglePermission(perm.id)}
                                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500/30 focus:ring-offset-0 cursor-pointer"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm transition-colors ${perm.active ? 'text-white' : 'text-slate-500'}`}>
                                                                        {perm.description}
                                                                    </p>
                                                                </div>
                                                                <code className="text-[10px] text-slate-600 font-mono hidden sm:block">
                                                                    {perm.code.replace('module:', '')}
                                                                </code>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Nouveau rôle personnalisé
                        </h2>

                        {error && (
                            <div className="mb-4 px-4 py-2 rounded-lg bg-red-950/50 border border-red-800/50">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom du rôle</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="Ex: Coordinateur Formation"
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Code technique</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="Ex: COORD_FORMAT"
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                />
                                <p className="mt-1 text-xs text-slate-500">Majuscules, chiffres et underscores uniquement.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Description du rôle (optionnel)"
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium text-sm transition-all disabled:opacity-60"
                                >
                                    {loading ? 'Création...' : 'Créer le rôle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingRole && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Modifier « {editingRole.code} »
                        </h2>

                        {error && (
                            <div className="mb-4 px-4 py-2 rounded-lg bg-red-950/50 border border-red-800/50">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Code technique</label>
                                <div className="px-4 py-2.5 rounded-xl bg-slate-900/40 border border-slate-700/30 text-slate-500 font-mono text-sm">
                                    {editingRole.code}
                                </div>
                                <p className="mt-1 text-xs text-slate-500">Le code ne peut pas être modifié.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom du rôle</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setEditingRole(null); resetForm(); }}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium text-sm transition-all disabled:opacity-60"
                                >
                                    {loading ? 'Mise à jour...' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

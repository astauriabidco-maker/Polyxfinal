/**
 * USER LIST - Composant client pour la liste des utilisateurs
 * ============================================================
 * Affiche la liste avec actions et formulaire modal de création.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    role: string;
    roleLabel: string;
    roleColor: string;
    scope: string;
    sites: { id: string; name: string }[];
    isActive: boolean;
    lastAccessedAt: Date;
    createdAt: Date;
}

interface Site {
    id: string;
    name: string;
}

interface Props {
    users: User[];
    sites: Site[];
    isAdmin: boolean;
    currentUserId: string;
}

const ROLES = [
    { value: 'ADMIN', label: 'Administrateur' },
    { value: 'RESP_PEDAGO', label: 'Responsable Pédagogique' },
    { value: 'RESP_ADMIN', label: 'Responsable Admin/Finance' },
    { value: 'REF_QUALITE', label: 'Référent Qualité' },
    { value: 'FORMAT', label: 'Formateur' },
];

export default function UserList({ users, sites, isAdmin, currentUserId }: Props) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        nom: '',
        prenom: '',
        telephone: '',
        role: 'FORMAT',
        scope: 'GLOBAL',
        siteIds: [] as string[],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors de la création');
            }

            setShowModal(false);
            setFormData({
                email: '',
                nom: '',
                prenom: '',
                telephone: '',
                role: 'FORMAT',
                scope: 'GLOBAL',
                siteIds: [],
            });
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async (userId: string) => {
        if (!confirm('Voulez-vous vraiment désactiver cet utilisateur ?')) return;

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            router.refresh();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <>
            {/* Action Bar */}
            {isAdmin && (
                <div className="mb-6 flex justify-end">
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Ajouter un utilisateur
                    </button>
                </div>
            )}

            {/* User Table */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-800/70">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Utilisateur
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Rôle
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Scope
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Statut
                            </th>
                            {isAdmin && (
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium">
                                            {user.prenom[0]}{user.nom[0]}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">
                                                {user.prenom} {user.nom}
                                            </p>
                                            <p className="text-sm text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${user.roleColor}`}>
                                        {user.roleLabel}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-300">
                                        {user.scope === 'GLOBAL' ? '🌐 Global' : `📍 ${user.sites.length} sites`}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs ${user.isActive
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {user.isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-6 py-4 text-right">
                                        {user.id !== currentUserId && (
                                            <button
                                                onClick={() => handleDeactivate(user.id)}
                                                className="text-red-400 hover:text-red-300 text-sm"
                                            >
                                                Désactiver
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {users.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <p>Aucun utilisateur trouvé</p>
                    </div>
                )}
            </div>

            {/* Modal de création */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
                        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Nouvel utilisateur</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Prénom</label>
                                    <input
                                        type="text"
                                        value={formData.prenom}
                                        onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Nom</label>
                                    <input
                                        type="text"
                                        value={formData.nom}
                                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Téléphone</label>
                                <input
                                    type="tel"
                                    value={formData.telephone}
                                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Rôle</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    {ROLES.map((role) => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Scope d'accès</label>
                                <select
                                    value={formData.scope}
                                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="GLOBAL">🌐 Global (tous les sites)</option>
                                    <option value="RESTRICTED">📍 Restreint (sites spécifiques)</option>
                                </select>
                            </div>

                            {formData.scope === 'RESTRICTED' && sites.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Sites accessibles</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {sites.map((site) => (
                                            <label key={site.id} className="flex items-center gap-2 text-sm text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.siteIds.includes(site.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, siteIds: [...formData.siteIds, site.id] });
                                                        } else {
                                                            setFormData({ ...formData, siteIds: formData.siteIds.filter(id => id !== site.id) });
                                                        }
                                                    }}
                                                    className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                                                />
                                                {site.name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Création...' : 'Créer l\'utilisateur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * USER LIST - Composant client pour la liste des utilisateurs
 * ============================================================
 * Affiche la liste avec actions et formulaire modal de création.
 * 
 * Workflow de création (step-by-step) :
 *   Étape 1 : Sélection du site (agence) → organisation déduite automatiquement
 *   Étape 2 : Rôle + Scope d'accès
 *   Étape 3 : Informations utilisateur (nom, email, etc.)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

interface Site {
    id: string;
    name: string;
}

interface UserData {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    role: string;
    roleLabel?: string;
    scope: string;
    sites: Site[];
    isActive: boolean;
    lastAccessedAt: Date;
    createdAt: Date;
}

interface Props {
    users: UserData[];
    sites: Site[];
    availableRoles: Role[];
    isAdmin: boolean;
    currentUserId: string;
    organizationId: string;
}

function getRoleColor(roleCode: string) {
    const colors: Record<string, string> = {
        'ADMIN': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
        'RESP_PEDAGO': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        'RESP_ADMIN': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        'REF_QUALITE': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        'FORMAT': 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    };
    return colors[roleCode] || colors['FORMAT'];
}

// ─── Constantes du wizard ─────────────────────────────────────

const STEPS = [
    { id: 1, label: 'Site', icon: '📍', description: 'Choisir l\'agence' },
    { id: 2, label: 'Rôle', icon: '🔑', description: 'Définir le rôle' },
    { id: 3, label: 'Utilisateur', icon: '👤', description: 'Informations' },
];

export default function UserList({ users, sites, availableRoles, isAdmin, currentUserId, organizationId }: Props) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        nom: '',
        prenom: '',
        telephone: '',
        role: 'FORMAT',
        scope: 'GLOBAL',
        siteIds: [] as string[],
        primarySiteId: '', // Site principal sélectionné à l'étape 1
    });

    const resetForm = () => {
        setFormData({
            email: '',
            nom: '',
            prenom: '',
            telephone: '',
            role: 'FORMAT',
            scope: 'GLOBAL',
            siteIds: [],
            primarySiteId: '',
        });
        setCurrentStep(1);
        setError('');
    };

    const openModal = () => {
        resetForm();
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Inclure le site principal dans siteIds si scope est RESTRICTED
            let finalSiteIds = formData.siteIds;
            if (formData.scope === 'RESTRICTED') {
                const allSiteIds = new Set([formData.primarySiteId, ...formData.siteIds]);
                finalSiteIds = Array.from(allSiteIds);
            }

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    nom: formData.nom,
                    prenom: formData.prenom,
                    telephone: formData.telephone,
                    role: formData.role,
                    scope: formData.scope,
                    siteIds: finalSiteIds,
                    organizationId,
                    primarySiteId: formData.primarySiteId,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors de la création');
            }

            setShowModal(false);
            resetForm();
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

    // ─── Validation par étape ─────────────────────────────────

    const canProceedToStep2 = formData.primarySiteId !== '';
    const canProceedToStep3 = formData.role !== '';
    const canSubmit = formData.email && formData.nom && formData.prenom;

    // Infos du site sélectionné
    const selectedSite = sites.find(s => s.id === formData.primarySiteId);
    const selectedRole = availableRoles.find(r => r.code === formData.role);

    return (
        <>
            {/* Action Bar */}
            {isAdmin && (
                <div className="mb-6 flex justify-end">
                    {sites.length === 0 ? (
                        <div className="flex items-center gap-3">
                            <span className="text-amber-400 text-sm">⚠️ Créez d&apos;abord un site pour pouvoir ajouter des utilisateurs</span>
                            <button
                                onClick={() => router.push('/sites')}
                                className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium rounded-lg hover:bg-amber-500/30 transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Créer un site
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={openModal}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Ajouter un utilisateur
                        </button>
                    )}
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
                                        <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                            {user.prenom[0]}{user.nom[0]}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{user.prenom} {user.nom}</p>
                                            <p className="text-slate-400 text-sm">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                        {user.roleLabel || user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-slate-300 text-sm">
                                        {user.scope === 'GLOBAL' ? '🌐 Global' : `📍 ${user.sites.map(s => s.name).join(', ') || 'Restreint'}`}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                                        {user.isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-6 py-4 text-right">
                                        {user.id !== currentUserId && user.isActive && (
                                            <button
                                                onClick={() => handleDeactivate(user.id)}
                                                className="text-red-400 hover:text-red-300 text-sm transition-colors"
                                                title="Désactiver"
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

            {/* ─── Modal Wizard de création ─────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
                        {/* Header + Stepper */}
                        <div className="px-6 py-4 border-b border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">Nouvel utilisateur</h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-2">
                                {STEPS.map((step, idx) => (
                                    <div key={step.id} className="flex items-center flex-1">
                                        <div className="flex items-center gap-2 flex-1">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentStep === step.id
                                                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                                    : currentStep > step.id
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-slate-700 text-slate-500'
                                                }`}>
                                                {currentStep > step.id ? '✓' : step.id}
                                            </div>
                                            <span className={`text-xs font-medium hidden sm:block ${currentStep === step.id ? 'text-cyan-400' : currentStep > step.id ? 'text-emerald-400' : 'text-slate-500'
                                                }`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < STEPS.length - 1 && (
                                            <div className={`h-px flex-1 mx-2 ${currentStep > step.id ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* ─── Étape 1 : Sélection du site ─────────── */}
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    <div className="text-center mb-2">
                                        <span className="text-2xl">📍</span>
                                        <h3 className="text-white font-semibold mt-1">Sélectionnez l&apos;agence</h3>
                                        <p className="text-slate-400 text-sm">L&apos;utilisateur sera rattaché à cette agence et son organisation</p>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {sites.map((site) => (
                                            <label
                                                key={site.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.primarySiteId === site.id
                                                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                                                        : 'bg-slate-700/30 border-slate-700 hover:border-slate-600 hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="primarySite"
                                                    value={site.id}
                                                    checked={formData.primarySiteId === site.id}
                                                    onChange={() => setFormData({ ...formData, primarySiteId: site.id })}
                                                    className="sr-only"
                                                />
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${formData.primarySiteId === site.id
                                                        ? 'border-cyan-500 bg-cyan-500'
                                                        : 'border-slate-500'
                                                    }`}>
                                                    {formData.primarySiteId === site.id && (
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-medium ${formData.primarySiteId === site.id ? 'text-cyan-300' : 'text-slate-300'}`}>
                                                        {site.name}
                                                    </p>
                                                </div>
                                                {formData.primarySiteId === site.id && (
                                                    <span className="text-xs text-cyan-400 font-medium">Sélectionné</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ─── Étape 2 : Rôle + Scope ─────────────── */}
                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="text-center mb-2">
                                        <span className="text-2xl">🔑</span>
                                        <h3 className="text-white font-semibold mt-1">Rôle et accès</h3>
                                        <p className="text-slate-400 text-sm">
                                            Agence : <span className="text-cyan-400 font-medium">{selectedSite?.name}</span>
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Rôle</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            {availableRoles.map((role) => (
                                                <option key={role.id} value={role.code}>
                                                    {role.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Scope d&apos;accès</label>
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
                                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                                Sites accessibles
                                                <span className="text-cyan-400 ml-1">(le site principal est inclus automatiquement)</span>
                                            </label>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {sites.map((site) => (
                                                    <label key={site.id} className="flex items-center gap-2 text-sm text-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={site.id === formData.primarySiteId || formData.siteIds.includes(site.id)}
                                                            disabled={site.id === formData.primarySiteId}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFormData({ ...formData, siteIds: [...formData.siteIds, site.id] });
                                                                } else {
                                                                    setFormData({ ...formData, siteIds: formData.siteIds.filter(id => id !== site.id) });
                                                                }
                                                            }}
                                                            className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                                                        />
                                                        <span className={site.id === formData.primarySiteId ? 'text-cyan-400 font-medium' : ''}>
                                                            {site.name}
                                                            {site.id === formData.primarySiteId && ' (principal)'}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Étape 3 : Informations utilisateur ──── */}
                            {currentStep === 3 && (
                                <div className="space-y-4">
                                    <div className="text-center mb-2">
                                        <span className="text-2xl">👤</span>
                                        <h3 className="text-white font-semibold mt-1">Informations utilisateur</h3>
                                        <p className="text-slate-400 text-sm">
                                            <span className="text-cyan-400">{selectedSite?.name}</span>
                                            {' · '}
                                            <span className="text-purple-400">{selectedRole?.name}</span>
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Prénom</label>
                                            <input
                                                type="text"
                                                value={formData.prenom}
                                                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                                                required
                                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                                placeholder="Jean"
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
                                                placeholder="Dupont"
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
                                            placeholder="jean.dupont@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Téléphone</label>
                                        <input
                                            type="tel"
                                            value={formData.telephone}
                                            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            placeholder="06 12 34 56 78"
                                        />
                                    </div>

                                    {/* Récapitulatif */}
                                    <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                                        <p className="text-xs text-slate-400 uppercase font-medium mb-2">Récapitulatif</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-slate-500">Agence :</span>
                                                <span className="text-cyan-400 ml-1">{selectedSite?.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Rôle :</span>
                                                <span className="text-purple-400 ml-1">{selectedRole?.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Scope :</span>
                                                <span className="text-slate-300 ml-1">
                                                    {formData.scope === 'GLOBAL' ? '🌐 Global' : '📍 Restreint'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── Navigation Buttons ──────────────────── */}
                            <div className="flex justify-between items-center pt-6 mt-4 border-t border-slate-700/50">
                                <div>
                                    {currentStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(currentStep - 1)}
                                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            Retour
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Annuler
                                    </button>

                                    {currentStep < 3 ? (
                                        <button
                                            type="button"
                                            disabled={
                                                (currentStep === 1 && !canProceedToStep2) ||
                                                (currentStep === 2 && !canProceedToStep3)
                                            }
                                            onClick={() => setCurrentStep(currentStep + 1)}
                                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                            Suivant
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={loading || !canSubmit}
                                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Création...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Créer l&apos;utilisateur
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

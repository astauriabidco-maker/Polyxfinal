/**
 * USER HEADER - Affiche l'utilisateur connecté (Multi-Tenant + Multi-Membership)
 * ===============================================================================
 * Composant serveur qui affiche le nom, rôle, organisation et bouton de déconnexion.
 * Intègre OrganizationSwitcher pour les utilisateurs multi-orgs.
 */

import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import OrganizationSwitcherWrapper from './OrganizationSwitcherWrapper';

// Couleurs par rôle
const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-emerald-600',
    RESP_PEDAGO: 'bg-blue-600',
    RESP_ADMIN: 'bg-amber-600',
    REF_QUALITE: 'bg-cyan-600',
    FORMAT: 'bg-purple-600',
};

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Super Admin',
    RESP_PEDAGO: 'Resp. Pédagogique',
    RESP_ADMIN: 'Resp. Administratif',
    REF_QUALITE: 'Réf. Qualité',
    FORMAT: 'Formateur',
};

// Types d'organisation
const ORG_TYPE_LABELS: Record<string, string> = {
    OF_STANDARD: 'OF',
    CFA: 'CFA',
    BILAN: 'Bilan',
    VAE: 'VAE',
};

const ORG_TYPE_COLORS: Record<string, string> = {
    OF_STANDARD: 'bg-slate-500',
    CFA: 'bg-orange-500',
    BILAN: 'bg-pink-500',
    VAE: 'bg-indigo-500',
};

export default async function UserHeader() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    const { nom, prenom, role, email, organizationName, organizationType, memberships } = session.user as any;
    const siteName = (session.user as any).siteName;
    // role is now a Role model object with {id, code, name, ...}, not a string enum
    const roleCode = typeof role === 'string' ? role : role?.code || 'UNKNOWN';
    const roleColor = ROLE_COLORS[roleCode] || 'bg-slate-600';
    const roleLabel = ROLE_LABELS[roleCode] || (typeof role === 'string' ? role : role?.name || roleCode);
    const orgTypeLabel = ORG_TYPE_LABELS[organizationType] || organizationType;
    const orgTypeColor = ORG_TYPE_COLORS[organizationType] || 'bg-slate-500';

    // Déterminer si l'utilisateur a plusieurs memberships
    const hasMultipleMemberships = memberships && memberships.length > 1;

    async function handleSignOut() {
        'use server';
        await signOut({ redirectTo: '/login' });
    }

    return (
        <div className="bg-slate-800/60 backdrop-blur-sm border-b border-slate-700/50 px-6 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                {/* Titre + Organisation (avec Switcher si multi-membership) */}
                <div className="flex items-center gap-3">
                    <span className="text-xl">📚</span>

                    {hasMultipleMemberships ? (
                        /* Multi-Membership: Afficher le Switcher */
                        <OrganizationSwitcherWrapper />
                    ) : (
                        /* Single Membership: Affichage statique */
                        <div>
                            <h1 className="text-lg font-semibold text-white">
                                {organizationName}
                                {siteName && (
                                    <span className="text-slate-400 font-normal">
                                        {' '} — {siteName}
                                    </span>
                                )}
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${orgTypeColor}`}>
                                    {orgTypeLabel}
                                </span>
                                {siteName ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-600 text-white">
                                        📍 Site
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-600 text-white">
                                        🌐 National
                                    </span>
                                )}
                                <span className="text-xs text-slate-400">
                                    Polyx ERP Formation
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Info */}
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-medium text-white">
                            {prenom} {nom}
                        </div>
                        <div className="text-xs text-slate-400">
                            {email}
                        </div>
                    </div>

                    {/* Role Badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${roleColor}`}>
                        {roleLabel}
                    </span>

                    {/* Sign Out Button */}
                    <form action={handleSignOut}>
                        <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 
                                     text-slate-300 hover:bg-red-900/50 hover:text-red-400 
                                     transition-all border border-slate-600/50"
                        >
                            Déconnexion
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { switchOrganization } from '@/app/actions/switchOrganization';
import { SystemRoleCode } from '@/lib/constants/roles';

// Couleurs par type d'organisation
const ORG_TYPE_COLORS: Record<string, string> = {
    OF_STANDARD: 'bg-slate-500',
    CFA: 'bg-orange-500',
    BILAN: 'bg-pink-500',
    VAE: 'bg-indigo-500',
};

const ORG_TYPE_LABELS: Record<string, string> = {
    OF_STANDARD: 'OF',
    CFA: 'CFA',
    BILAN: 'Bilan',
    VAE: 'VAE',
};

// Couleurs par rôle
const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    RESP_PEDAGO: 'Resp. Péda',
    RESP_ADMIN: 'Resp. Admin',
    REF_QUALITE: 'Qualité',
    FORMAT: 'Formateur',
};

export default function OrganizationSwitcher() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    if (!session?.user?.memberships || session.user.memberships.length <= 1) {
        // Un seul membership, pas besoin de switcher
        return null;
    }

    const currentOrg = {
        id: session.user.organizationId,
        name: session.user.organizationName,
        type: session.user.organizationType,
        siteName: (session.user as any).siteName,
    };

    const otherMemberships = session.user.memberships.filter(
        m => m.organizationId !== currentOrg.id
    );

    const handleSwitch = async (targetOrgId: string) => {
        setIsOpen(false);

        startTransition(async () => {
            const result = await switchOrganization(targetOrgId);

            if (result.success) {
                // Mettre à jour le token JWT avec le nouveau contexte
                await update({ switchToOrgId: targetOrgId });
                // Forcer le refresh de la page pour recharger les données
                router.refresh();
            } else {
                console.error('Switch failed:', result.error);
            }
        });
    };

    const currentTypeColor = ORG_TYPE_COLORS[currentOrg.type] || 'bg-slate-500';
    const currentTypeLabel = ORG_TYPE_LABELS[currentOrg.type] || currentOrg.type;

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg
                    bg-slate-700/50 hover:bg-slate-600/50
                    border border-slate-600/50 hover:border-slate-500/50
                    transition-all duration-200
                    ${isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                `}
            >
                {/* Org Icon */}
                <span className="text-lg">🏢</span>

                {/* Current Org Info */}
                <div className="text-left">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                        {currentOrg.name}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${currentTypeColor}`}>
                            {currentTypeLabel}
                        </span>
                    </div>
                    {currentOrg.siteName && (
                        <div className="text-xs text-slate-400">
                            📍 {currentOrg.siteName}
                        </div>
                    )}
                </div>

                {/* Chevron */}
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="
                        absolute top-full left-0 mt-2 z-50
                        w-72 p-2 rounded-xl
                        bg-slate-800 border border-slate-700/50
                        shadow-2xl shadow-black/50
                        animate-in fade-in slide-in-from-top-2 duration-200
                    ">
                        {/* Header */}
                        <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Changer d'organisation
                        </div>

                        {/* Other Organizations */}
                        {otherMemberships.map((membership) => {
                            const typeColor = ORG_TYPE_COLORS[membership.organizationType] || 'bg-slate-500';
                            const typeLabel = ORG_TYPE_LABELS[membership.organizationType] || membership.organizationType;
                            const roleLabel = ROLE_LABELS[membership.role.code as SystemRoleCode] || { label: membership.role.name };

                            return (
                                <button
                                    key={membership.organizationId}
                                    onClick={() => handleSwitch(membership.organizationId)}
                                    className="
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                        hover:bg-slate-700/50 transition-colors
                                        text-left
                                    "
                                >
                                    {/* Org Icon */}
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-lg">
                                        🏢
                                    </div>

                                    {/* Org Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">
                                                {membership.organizationName}
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${typeColor}`}>
                                                {typeLabel}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span>{typeof roleLabel === 'string' ? roleLabel : roleLabel.label}</span>
                                            {(membership as any).siteName && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                                                    <span>📍 {(membership as any).siteName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Divider */}
                        <div className="my-2 border-t border-slate-700/50" />

                        {/* Current Org (checked) */}
                        <div className="px-3 py-2 flex items-center gap-3 bg-emerald-900/20 rounded-lg border border-emerald-700/30">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-lg">
                                ✓
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-medium text-emerald-300">
                                    {currentOrg.name}
                                </div>
                                <div className="text-xs text-emerald-400/70">
                                    Organisation actuelle
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

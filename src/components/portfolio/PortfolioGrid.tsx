'use client';

/**
 * PORTFOLIO GRID - Grille de Cartes Organisation
 * ===============================================
 * Composant client pour afficher les organisations avec métriques et actions.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { switchOrganization } from '@/app/actions/switchOrganization';
import type { PortfolioItem } from '@/lib/dashboard/portfolio';
import { SystemRoleCode } from '@/lib/constants/roles';

interface PortfolioGridProps {
    items: PortfolioItem[];
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    ADMIN: { label: 'Administrateur', color: 'bg-purple-500' },
    RESP_PEDAGO: { label: 'Resp. Pédagogique', color: 'bg-blue-500' },
    RESP_ADMIN: { label: 'Resp. Administratif', color: 'bg-green-500' },
    REF_QUALITE: { label: 'Réf. Qualité', color: 'bg-amber-500' },
    FORMAT: { label: 'Formateur', color: 'bg-slate-500' },
};

export function PortfolioGrid({ items }: PortfolioGridProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);

    const handleAccess = async (orgId: string) => {
        setLoading(orgId);
        try {
            const result = await switchOrganization(orgId);
            if (result.success) {
                router.push('/dashboard');
            } else {
                console.error('Switch failed:', result.error);
                setLoading(null);
            }
        } catch (error) {
            console.error('Switch error:', error);
            setLoading(null);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
                const roleInfo = ROLE_LABELS[item.role as SystemRoleCode] || {
                    label: item.roleLabel || item.role,
                    color: 'bg-slate-500',
                };
                const hasBlockingAlerts = item.alertesBloquantes > 0;
                const isLoading = loading === item.organizationId;

                return (
                    <div
                        key={item.organizationId}
                        className={`
                            relative bg-slate-900/80 border rounded-xl overflow-hidden transition-all duration-300
                            ${hasBlockingAlerts
                                ? 'border-red-500/50 shadow-lg shadow-red-500/10'
                                : 'border-slate-700 hover:border-slate-600'}
                            ${isLoading ? 'opacity-70' : 'hover:scale-[1.02]'}
                        `}
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`
                                            w-12 h-12 rounded-lg flex items-center justify-center
                                            ${item.organizationType === 'CFA'
                                                ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                                : 'bg-gradient-to-br from-purple-500 to-pink-500'}
                                        `}
                                    >
                                        <span className="text-white font-bold text-lg">
                                            {item.organizationName.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            {item.organizationName}
                                        </h3>
                                        <span className="text-xs text-slate-400 uppercase tracking-wider">
                                            {item.organizationType}
                                        </span>
                                    </div>
                                </div>
                                <span
                                    className={`px-2 py-1 text-xs font-medium text-white rounded-full ${roleInfo.color}`}
                                >
                                    {roleInfo.label}
                                </span>
                            </div>
                        </div>

                        {/* Body - Metrics */}
                        <div className="p-5 space-y-4">
                            {/* Dossiers en cours */}
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Dossiers en cours</span>
                                <span className="text-3xl font-bold text-white">
                                    {item.dossiersEnCours}
                                    <span className="text-sm text-slate-500 font-normal ml-1">
                                        / {item.dossiersTotal}
                                    </span>
                                </span>
                            </div>

                            {/* Alertes bloquantes */}
                            {hasBlockingAlerts && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <div className="relative flex items-center justify-center">
                                        <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75 animate-ping" />
                                        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                                    </div>
                                    <span className="text-red-400 text-sm font-medium">
                                        {item.alertesBloquantes} blocage{item.alertesBloquantes > 1 ? 's' : ''} critique{item.alertesBloquantes > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}

                            {/* Tout vert */}
                            {!hasBlockingAlerts && item.dossiersTotal > 0 && (
                                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <span className="inline-flex h-3 w-3 rounded-full bg-green-500" />
                                    <span className="text-green-400 text-sm font-medium">
                                        Aucun blocage
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer - Action */}
                        <div className="p-5 pt-0">
                            <button
                                onClick={() => handleAccess(item.organizationId)}
                                disabled={isLoading}
                                className={`
                                    w-full py-3 px-4 rounded-lg font-medium transition-all
                                    ${isLoading
                                        ? 'bg-slate-700 text-slate-400 cursor-wait'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white'}
                                `}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                        Chargement...
                                    </span>
                                ) : (
                                    'Accéder au tableau de bord'
                                )}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

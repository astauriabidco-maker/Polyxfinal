'use client';

import { useState, useTransition } from 'react';
import { updateCandidateStatus, finalizeFranchiseOnboarding } from './actions';
import { CandidateStatus } from '@prisma/client';

const NEXT_STATUS: Record<string, CandidateStatus> = {
    'NEW': 'CONTACTED',
    'CONTACTED': 'DIP_SENT',
    'DIP_SENT': 'DIP_SIGNED',
    'DIP_SIGNED': 'CONTRACT_SENT',
    'CONTRACT_SENT': 'SIGNED',
};

const STATUS_LABELS: Record<string, string> = {
    'NEW': 'Nouveau',
    'CONTACTED': 'Contacté',
    'DIP_SENT': 'Envoyer DIP',
    'DIP_SIGNED': 'DIP Signé',
    'CONTRACT_SENT': 'Envoyer Contrat',
    'SIGNED': 'Finaliser Signature',
};

interface Props {
    candidateId: string;
    currentStatus: string;
    dipSentAt?: string | null;
    dipSignedAt?: string | null;
    createdOrgId?: string | null;
    doubinDelayDays?: number;
}

export default function CandidateActionButtons({
    candidateId,
    currentStatus,
    dipSentAt,
    dipSignedAt,
    createdOrgId,
    doubinDelayDays = 20
}: Props) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const nextStatus = NEXT_STATUS[currentStatus];

    // Calcul Loi Doubin (délai configurable)
    const dipDate = dipSentAt || dipSignedAt;
    let daysRemaining = 0;
    let isLocked = false;

    if (nextStatus === 'SIGNED' && dipDate) {
        const d = new Date(dipDate);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < doubinDelayDays) {
            daysRemaining = doubinDelayDays - diffDays;
            isLocked = true;
        }
    }

    if (!nextStatus || currentStatus === 'REJECTED' || currentStatus === 'WITHDRAWN') {
        return null; // Pas d'action suivante définie
    }

    const handlePromote = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Éviter d'ouvrir la modale d'édition
        setError(null);

        const formData = new FormData();
        formData.append('candidateId', candidateId);
        formData.append('newStatus', nextStatus);

        startTransition(async () => {
            const result = await updateCandidateStatus(formData);
            if (result.error) {
                setError(result.error);
            }
        });
    };

    const handleReject = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Voulez-vous vraiment rejeter cette candidature ?')) return;

        setError(null);
        const formData = new FormData();
        formData.append('candidateId', candidateId);
        formData.append('newStatus', 'REJECTED');

        startTransition(async () => {
            const result = await updateCandidateStatus(formData);
            if (result.error) {
                setError(result.error);
            }
        });
    };

    const handleGenerateDIP = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(`/api/network/candidates/${candidateId}/dip`, '_blank');
    };

    const handleOnboard = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Créer l\'organisation et le compte administrateur du franchisé ?')) return;

        setError(null);
        startTransition(async () => {
            const result = await finalizeFranchiseOnboarding(candidateId);
            if (result.error) {
                setError(result.error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-2 mt-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
                <button
                    onClick={handlePromote}
                    disabled={isPending || isLocked}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${isPending || isLocked
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40'
                        }`}
                >
                    {isPending ? (
                        <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    ) : isLocked ? (
                        '🔒'
                    ) : (
                        '→'
                    )}
                    {STATUS_LABELS[currentStatus] || 'Suivant'}
                </button>

                <button
                    onClick={handleReject}
                    disabled={isPending}
                    className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-500/20 transition-all"
                    title="Rejeter"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* DIP Action */}
            {(currentStatus === 'CONTACTED' || currentStatus === 'DIP_SENT') && (
                <button
                    onClick={handleGenerateDIP}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {currentStatus === 'DIP_SENT' ? 'Régénérer DIP' : 'Générer DIP (Loi Doubin)'}
                </button>
            )}

            {/* Onboarding Action */}
            {currentStatus === 'SIGNED' && !createdOrgId && (
                <button
                    onClick={handleOnboard}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/40 hover:text-white transition-all animate-pulse"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Onboarder le Franchisé
                </button>
            )}

            {createdOrgId && (
                <div className="w-full p-2 rounded bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">✅ Franchisé Onboardé</span>
                    <span className="text-[8px] text-emerald-500/70 font-mono">{createdOrgId}</span>
                </div>
            )}

            {isLocked && (
                <div className="flex items-center gap-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
                    <span className="text-[10px] text-orange-400 font-medium">
                        ⚖️ Loi Doubin : Attente légale de {doubinDelayDays} jours ({daysRemaining}j restants)
                    </span>
                </div>
            )}

            {error && (
                <p className="text-[10px] text-red-400 italic font-medium">{error}</p>
            )}
        </div>
    );
}

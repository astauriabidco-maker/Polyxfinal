/**
 * ACTION BUTTONS - Client Component
 * ==================================
 * Boutons d'action pour la transition de statut des dossiers.
 * 
 * Logique :
 * - Si non-conforme → Bouton désactivé avec cadenas 🔒
 * - Si conforme → Bouton actif pour passer à l'étape suivante
 */
'use client';

import { useState, useTransition } from 'react';
import { promoteDossier } from '@/app/actions/workflow';

// Mapping des transitions pour affichage
const NEXT_STATUS_LABEL: Record<string, string> = {
    'BROUILLON': 'Soumettre',
    'EN_ATTENTE_VALIDATION': 'Admettre',
    'ADMIS': 'Contractualiser',
    'CONTRACTUALISE': 'Démarrer',
    'ACTIF': 'Démarrer',
    'EN_COURS': 'Clôturer',
    'TERMINE': 'Clôturer',
    'CLOTURE': 'Facturer',
};

interface ActionButtonsProps {
    dossierId: string;
    currentStatus: string;
    isCompliant: boolean;
    nextStatus: string;
}

export default function ActionButtons({
    dossierId,
    currentStatus,
    isCompliant,
    nextStatus,
}: ActionButtonsProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handlePromote = () => {
        setError(null);
        startTransition(async () => {
            try {
                await promoteDossier(dossierId, nextStatus);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur inconnue');
            }
        });
    };

    // Dossier déjà à l'état final (CLOTURE ou ABANDONNE)
    if (currentStatus === 'CLOTURE' || currentStatus === 'ABANDONNE') {
        return (
            <span className="text-xs text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                ✅ Terminé
            </span>
        );
    }

    const actionLabel = NEXT_STATUS_LABEL[currentStatus] || 'Avancer';

    // ========================================
    // BOUTON DÉSACTIVÉ (Non-conforme)
    // ========================================
    if (!isCompliant) {
        return (
            <button
                disabled
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-slate-700/50 text-slate-500 border border-slate-600/50
                           cursor-not-allowed opacity-60"
                title="Conformité requise avant progression"
            >
                <svg width="12" height="12" className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                🔒 {actionLabel}
            </button>
        );
    }

    // ========================================
    // BOUTON ACTIF (Conforme)
    // ========================================
    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handlePromote}
                disabled={isPending}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
                           transition-all duration-200
                           ${isPending
                        ? 'bg-blue-800/50 text-blue-300 cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-500/20'
                    }`}
            >
                {isPending ? (
                    <>
                        <svg className="animate-spin w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        En cours...
                    </>
                ) : (
                    <>
                        <svg width="12" height="12" className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        {actionLabel}
                    </>
                )}
            </button>

            {/* Message d'erreur */}
            {error && (
                <span className="text-xs text-red-400 max-w-[200px] text-right">
                    ⚠️ {error.replace('[Conformité] ', '').slice(0, 60)}...
                </span>
            )}
        </div>
    );
}

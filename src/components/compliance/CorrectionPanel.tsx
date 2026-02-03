/**
 * CORRECTION PANEL - Client Component
 * ====================================
 * Panneau pour ajouter des preuves et débloquer les dossiers.
 * S'affiche uniquement si le dossier est BLOQUÉ (badge rouge).
 */
'use client';

import { useState, useTransition } from 'react';
import { addProof } from '@/app/actions/evidence';

// Types de preuves disponibles (correspondant à l'enum Prisma)
const PROOF_TYPES = [
    { value: 'JUSTIFICATIF_ABSENCE', label: '🏥 Justificatif d\'absence' },
    { value: 'CERTIFICAT_REALISATION', label: '📜 Certificat de réalisation' },
    { value: 'CONTRAT_SIGNE', label: '✍️ Contrat signé' },
    { value: 'ACCORD_FINANCEMENT', label: '💰 Accord de financement' },
    { value: 'EMARGEMENT', label: '📋 Feuille d\'émargement' },
    { value: 'EVALUATION_CHAUD', label: '⭐ Évaluation à chaud' },
] as const;

interface CorrectionPanelProps {
    dossierId: string;
    errors: string[];
}

export default function CorrectionPanel({
    dossierId,
    errors,
}: CorrectionPanelProps) {
    const [isPending, startTransition] = useTransition();
    const [selectedType, setSelectedType] = useState<string>('JUSTIFICATIF_ABSENCE');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        startTransition(async () => {
            try {
                await addProof(
                    dossierId,
                    selectedType as any,
                    `Justificatif ajouté via dashboard`
                );
                setSuccess(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur inconnue');
            }
        });
    };

    return (
        <div className="px-5 py-4 bg-amber-950/20 border-t border-amber-900/30">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold text-amber-400">
                    Action requise : Ajoutez une preuve pour débloquer
                </span>
            </div>

            {/* Success message */}
            {success && (
                <div className="mb-3 px-3 py-2 bg-emerald-950/50 border border-emerald-700/50 rounded-lg">
                    <p className="text-xs text-emerald-400">
                        ✅ Justificatif ajouté ! La page va se recharger...
                    </p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="mb-3 px-3 py-2 bg-red-950/50 border border-red-700/50 rounded-lg">
                    <p className="text-xs text-red-400">⚠️ {error}</p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                {/* Type selector */}
                <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/50 
                               text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50
                               disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {PROOF_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={isPending}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium
                               transition-all duration-200
                               ${isPending
                            ? 'bg-amber-800/50 text-amber-300 cursor-wait'
                            : 'bg-amber-600 text-white hover:bg-amber-500 active:scale-95'
                        }`}
                >
                    {isPending ? (
                        <>
                            <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Ajout...
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Ajouter le justificatif
                        </>
                    )}
                </button>
            </form>

            {/* Suggested actions based on errors */}
            <div className="mt-3 pt-3 border-t border-slate-700/30">
                <p className="text-xs text-slate-500 mb-2">💡 Suggestion basée sur les blocages :</p>
                <div className="space-y-1">
                    {errors.some(e => e.includes('ASSIDUITE')) && (
                        <p className="text-xs text-slate-400">
                            → Ajoutez un <span className="text-amber-400">Justificatif d'absence</span> pour valider l'assiduité
                        </p>
                    )}
                    {errors.some(e => e.includes('CONTRAT')) && (
                        <p className="text-xs text-slate-400">
                            → Ajoutez un <span className="text-amber-400">Contrat signé</span> pour débloquer
                        </p>
                    )}
                    {errors.some(e => e.includes('FINANCEMENT')) && (
                        <p className="text-xs text-slate-400">
                            → Ajoutez un <span className="text-amber-400">Accord de financement</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useTransition } from 'react';
import { qualifyRdv, handleRdvNonHonoreAction } from '@/app/actions/rdv-qualification';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface LeadInfo {
    id: string;
    nom: string;
    prenom: string;
    status: string;
    relanceCount?: number;
}

// ─────────────────────────────────────────────────────────
// 1. MODALE — Qualifier un RDV (lead en RDV_PLANIFIE)
// ─────────────────────────────────────────────────────────

interface QualifyRdvModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { newStatus: string; nextStep?: string | null; message?: string }) => void;
}

type QualifyStep = 'choice' | 'not_honored' | 'honored_intent';

export function QualifyRdvModal({ lead, performedBy, onClose, onSuccess }: QualifyRdvModalProps) {
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<QualifyStep>('choice');
    const [honored, setHonored] = useState<boolean | null>(null);
    const [absenceReason, setAbsenceReason] = useState('');
    const [intent, setIntent] = useState<'poursuivre' | 'reporter' | 'abandon' | null>(null);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const ABSENCE_REASONS = [
        'Absent sans prévenir',
        'A annulé au dernier moment',
        'Problème de transport',
        'Raison personnelle / familiale',
        'Oubli du RDV',
        'Autre',
    ];

    const handleSubmit = () => {
        setError('');

        if (honored === false && !absenceReason.trim()) {
            setError('La raison d\'absence est obligatoire.');
            return;
        }
        if (honored === true && !intent) {
            setError('Veuillez choisir l\'intention du prospect.');
            return;
        }

        startTransition(async () => {
            const result = await qualifyRdv({
                leadId: lead.id,
                honored: honored!,
                absenceReason: honored === false ? absenceReason : undefined,
                intent: honored === true ? intent! : undefined,
                notes: notes.trim() || undefined,
                performedBy,
            });

            if (result.success) {
                onSuccess({
                    newStatus: result.newStatus!,
                    nextStep: result.nextStep,
                    message: result.message,
                });
            } else {
                setError(result.error || 'Erreur inconnue');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            🎯 Qualification du RDV
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* ═══ ÉTAPE 1 : Le prospect s'est-il présenté ? ═══ */}
                {step === 'choice' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300 font-medium">Le prospect s'est-il présenté au RDV ?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setHonored(true); setStep('honored_intent'); }}
                                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-green-500/30 bg-green-500/5 
                                           hover:bg-green-500/15 hover:border-green-500/60 transition-all group"
                            >
                                <span className="text-3xl group-hover:scale-110 transition-transform">✅</span>
                                <span className="text-green-400 font-semibold text-sm">Oui, présent</span>
                                <span className="text-[10px] text-slate-500">RDV honoré</span>
                            </button>
                            <button
                                onClick={() => { setHonored(false); setStep('not_honored'); }}
                                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-red-500/30 bg-red-500/5 
                                           hover:bg-red-500/15 hover:border-red-500/60 transition-all group"
                            >
                                <span className="text-3xl group-hover:scale-110 transition-transform">❌</span>
                                <span className="text-red-400 font-semibold text-sm">Non, absent</span>
                                <span className="text-[10px] text-slate-500">RDV non honoré</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ ÉTAPE 2A : RDV Non Honoré — Raison d'absence ═══ */}
                {step === 'not_honored' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setStep('choice'); setHonored(null); setAbsenceReason(''); }}
                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                            ← Retour
                        </button>

                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                            <p className="text-red-400 font-medium text-sm">❌ RDV non honoré</p>
                            <p className="text-red-400/70 text-xs mt-1">Le lead passera en suivi « RDV Non Honoré » pour action de relance.</p>
                        </div>

                        <div>
                            <label className="text-sm text-slate-300 block mb-2 font-medium">
                                Raison de l'absence <span className="text-red-400">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {ABSENCE_REASONS.map(reason => (
                                    <button
                                        key={reason}
                                        onClick={() => setAbsenceReason(reason)}
                                        className={`text-xs px-3 py-2.5 rounded-lg border transition-all text-left ${absenceReason === reason
                                            ? 'border-red-500 bg-red-500/15 text-red-300 shadow-sm shadow-red-500/10'
                                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-slate-300 block mb-1.5">Notes complémentaires</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Détails supplémentaires..."
                                rows={2}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                            <button
                                onClick={handleSubmit}
                                disabled={isPending || !absenceReason.trim()}
                                className="px-5 py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {isPending ? '⏳ En cours...' : '❌ Confirmer l\'absence'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ ÉTAPE 2B : RDV Honoré — Intention ═══ */}
                {step === 'honored_intent' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setStep('choice'); setHonored(null); setIntent(null); }}
                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                            ← Retour
                        </button>

                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                            <p className="text-green-400 font-medium text-sm">✅ RDV honoré — Quelle est la décision du prospect ?</p>
                        </div>

                        <div className="space-y-2">
                            {/* Poursuivre */}
                            <button
                                onClick={() => setIntent('poursuivre')}
                                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${intent === 'poursuivre'
                                    ? 'border-green-500/60 bg-green-500/10 shadow-sm shadow-green-500/10'
                                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                    }`}
                            >
                                <span className="text-2xl mt-0.5">🚀</span>
                                <div>
                                    <span className="text-green-400 font-semibold text-sm block">Poursuivre</span>
                                    <span className="text-[11px] text-slate-400 leading-tight">Prospect motivé → Passage au choix de financement</span>
                                </div>
                            </button>

                            {/* Reporter */}
                            <button
                                onClick={() => setIntent('reporter')}
                                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${intent === 'reporter'
                                    ? 'border-yellow-500/60 bg-yellow-500/10 shadow-sm shadow-yellow-500/10'
                                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                    }`}
                            >
                                <span className="text-2xl mt-0.5">⏳</span>
                                <div>
                                    <span className="text-yellow-400 font-semibold text-sm block">Reporter la décision</span>
                                    <span className="text-[11px] text-slate-400 leading-tight">Le prospect veut réfléchir → Décision en attente</span>
                                </div>
                            </button>

                            {/* Abandon */}
                            <button
                                onClick={() => setIntent('abandon')}
                                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${intent === 'abandon'
                                    ? 'border-red-500/60 bg-red-500/10 shadow-sm shadow-red-500/10'
                                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                    }`}
                            >
                                <span className="text-2xl mt-0.5">🚫</span>
                                <div>
                                    <span className="text-red-400 font-semibold text-sm block">Pas intéressé / Abandon</span>
                                    <span className="text-[11px] text-slate-400 leading-tight">Le prospect n'est pas convaincu → Lead perdu</span>
                                </div>
                            </button>
                        </div>

                        <div>
                            <label className="text-sm text-slate-300 block mb-1.5">Notes du RDV</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Résumé de la discussion, points importants..."
                                rows={2}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                            <button
                                onClick={handleSubmit}
                                disabled={isPending || !intent}
                                className={`px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ${intent === 'poursuivre' ? 'bg-green-600 hover:bg-green-500'
                                    : intent === 'reporter' ? 'bg-yellow-600 hover:bg-yellow-500'
                                        : intent === 'abandon' ? 'bg-red-600 hover:bg-red-500'
                                            : 'bg-slate-600'
                                    }`}
                            >
                                {isPending ? '⏳ En cours...'
                                    : intent === 'poursuivre' ? '🚀 Valider et continuer'
                                        : intent === 'reporter' ? '⏳ Mettre en attente'
                                            : intent === 'abandon' ? '🚫 Marquer comme perdu'
                                                : 'Sélectionnez une option'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 2. MODALE — Suivi RDV Non Honoré (lead en RDV_NON_HONORE)
// ─────────────────────────────────────────────────────────

interface RdvNonHonoreModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { newStatus: string; relanceCount?: number; message?: string }) => void;
}

type NonHonoreStep = 'action_choice' | 'call_result' | 'relance_confirm';

const CALL_RESULT_OPTIONS = [
    { value: 'rdv_refixe' as const, icon: '📅', label: 'Nouveau RDV fixé', desc: 'On a convenu d\'un nouveau créneau', color: 'green' },
    { value: 'interesse' as const, icon: '🤔', label: 'Intéressé, pas de RDV', desc: 'Veut réfléchir, à recontacter', color: 'yellow' },
    { value: 'hors_ligne' as const, icon: '📵', label: 'Hors ligne / Pas de réponse', desc: 'Injoignable — relance comptée', color: 'orange' },
    { value: 'pas_interesse' as const, icon: '🚫', label: 'Pas intéressé', desc: 'Refuse catégoriquement → Lead perdu', color: 'red' },
    { value: 'numero_invalide' as const, icon: '⚠️', label: 'Numéro invalide', desc: 'Numéro erroné ou inexistant → Lead perdu', color: 'red' },
];

export function RdvNonHonoreModal({ lead, performedBy, onClose, onSuccess }: RdvNonHonoreModalProps) {
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<NonHonoreStep>('action_choice');
    const [action, setAction] = useState<'call' | 'relance' | null>(null);
    const [callResult, setCallResult] = useState<typeof CALL_RESULT_OPTIONS[number]['value'] | null>(null);
    const [dateRdv, setDateRdv] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const relanceCount = lead.relanceCount || 0;
    const maxRelances = 3;
    const remainingAttempts = maxRelances - relanceCount;

    const handleSubmit = () => {
        setError('');

        if (!notes.trim()) {
            setError('Les notes sont obligatoires.');
            return;
        }

        if (action === 'call' && !callResult) {
            setError('Sélectionnez le résultat de l\'appel.');
            return;
        }

        if (callResult === 'rdv_refixe' && !dateRdv) {
            setError('La date du nouveau RDV est obligatoire.');
            return;
        }

        startTransition(async () => {
            const result = await handleRdvNonHonoreAction({
                leadId: lead.id,
                action: action!,
                callResult: action === 'call' ? callResult! : undefined,
                dateRdv: callResult === 'rdv_refixe' ? new Date(dateRdv).toISOString() : undefined,
                notes: notes.trim(),
                performedBy,
            });

            if (result.success) {
                onSuccess({
                    newStatus: result.newStatus!,
                    relanceCount: result.relanceCount,
                    message: result.message,
                });
            } else {
                setError(result.error || 'Erreur inconnue');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            📞 Suivi — RDV non honoré
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Relance counter badge */}
                <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border text-xs font-medium ${relanceCount >= 2
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : relanceCount >= 1
                        ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                    <span>🔄 Relances effectuées :</span>
                    <span className="font-bold text-sm">{relanceCount} / {maxRelances}</span>
                    {relanceCount >= 2 && (
                        <span className="ml-auto text-[10px] opacity-80">⚠️ Dernière chance avant perte automatique</span>
                    )}
                    {remainingAttempts > 0 && relanceCount < 2 && (
                        <span className="ml-auto text-[10px] opacity-60">{remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''}</span>
                    )}
                </div>

                {/* ═══ ÉTAPE 1 : Choix d'action ═══ */}
                {step === 'action_choice' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300 font-medium">Quelle action souhaitez-vous effectuer ?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setAction('call'); setStep('call_result'); }}
                                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-cyan-500/30 bg-cyan-500/5 
                                           hover:bg-cyan-500/15 hover:border-cyan-500/60 transition-all group"
                            >
                                <span className="text-3xl group-hover:scale-110 transition-transform">📞</span>
                                <span className="text-cyan-400 font-semibold text-sm">Appeler</span>
                                <span className="text-[10px] text-slate-500 text-center leading-tight">Passer un appel et noter le résultat</span>
                            </button>
                            <button
                                onClick={() => { setAction('relance'); setStep('relance_confirm'); }}
                                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 
                                           hover:bg-amber-500/15 hover:border-amber-500/60 transition-all group"
                            >
                                <span className="text-3xl group-hover:scale-110 transition-transform">🔄</span>
                                <span className="text-amber-400 font-semibold text-sm">Relancer</span>
                                <span className="text-[10px] text-slate-500 text-center leading-tight">
                                    SMS, email ou rappel {relanceCount >= 2 && '(⚠️ dernière)'}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ ÉTAPE 2A : Résultat de l'appel ═══ */}
                {step === 'call_result' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setStep('action_choice'); setCallResult(null); setAction(null); }}
                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                            ← Retour
                        </button>

                        <p className="text-sm text-slate-300 font-medium">Résultat de l'appel :</p>

                        <div className="space-y-2">
                            {CALL_RESULT_OPTIONS.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => setCallResult(option.value)}
                                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${callResult === option.value
                                        ? option.color === 'green' ? 'border-green-500/60 bg-green-500/10'
                                            : option.color === 'yellow' ? 'border-yellow-500/60 bg-yellow-500/10'
                                                : option.color === 'orange' ? 'border-orange-500/60 bg-orange-500/10'
                                                    : 'border-red-500/60 bg-red-500/10'
                                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                        }`}
                                >
                                    <span className="text-xl">{option.icon}</span>
                                    <div>
                                        <span className={`font-semibold text-sm block ${callResult === option.value
                                            ? option.color === 'green' ? 'text-green-400'
                                                : option.color === 'yellow' ? 'text-yellow-400'
                                                    : option.color === 'orange' ? 'text-orange-400'
                                                        : 'text-red-400'
                                            : 'text-white'
                                            }`}>{option.label}</span>
                                        <span className="text-[10px] text-slate-500 leading-tight">{option.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Date picker si rdv_refixe */}
                        {callResult === 'rdv_refixe' && (
                            <div>
                                <label className="text-sm text-slate-300 block mb-1.5 font-medium">
                                    📅 Date du nouveau RDV <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={dateRdv}
                                    onChange={(e) => setDateRdv(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        )}

                        {/* Warning si hors_ligne et presque au max */}
                        {callResult === 'hors_ligne' && relanceCount >= 2 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                <p className="text-red-400 font-medium text-xs">⚠️ Attention : dernière tentative !</p>
                                <p className="text-red-400/70 text-[11px] mt-1">
                                    C'est la 3ème tentative sans réponse. Le lead sera automatiquement marqué comme <strong>PERDU (hors ligne)</strong>.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="text-sm text-slate-300 block mb-1.5 font-medium">
                                Notes <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Détails de l'appel, réponse du prospect..."
                                rows={2}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                            <button
                                onClick={handleSubmit}
                                disabled={isPending || !callResult || !notes.trim() || (callResult === 'rdv_refixe' && !dateRdv)}
                                className="px-5 py-2.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {isPending ? '⏳ En cours...' : '📞 Valider le résultat'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ ÉTAPE 2B : Confirmation de relance ═══ */}
                {step === 'relance_confirm' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setStep('action_choice'); setAction(null); }}
                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                            ← Retour
                        </button>

                        <div className={`rounded-xl p-3 border ${relanceCount >= 2
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-amber-500/10 border-amber-500/20'
                            }`}>
                            <p className={`font-medium text-sm ${relanceCount >= 2 ? 'text-red-400' : 'text-amber-400'}`}>
                                🔄 Relance #{relanceCount + 1} / {maxRelances}
                            </p>
                            {relanceCount >= 2 ? (
                                <p className="text-red-400/70 text-xs mt-1">
                                    ⚠️ C'est la dernière relance autorisée. Si le prospect ne répond pas, il passera automatiquement en <strong>PERDU</strong>.
                                </p>
                            ) : (
                                <p className="text-amber-400/70 text-xs mt-1">
                                    Enregistrez cette relance. {remainingAttempts - 1} tentative{remainingAttempts - 1 > 1 ? 's' : ''} restera{remainingAttempts - 1 > 1 ? 'ont' : ''} après celle-ci.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="text-sm text-slate-300 block mb-1.5 font-medium">
                                Description de la relance <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Exemple : SMS envoyé, email de rappel, message vocal laissé..."
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                            <button
                                onClick={handleSubmit}
                                disabled={isPending || !notes.trim()}
                                className={`px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ${relanceCount >= 2
                                    ? 'bg-red-600 hover:bg-red-500'
                                    : 'bg-amber-600 hover:bg-amber-500'
                                    }`}
                            >
                                {isPending ? '⏳ En cours...'
                                    : relanceCount >= 2 ? '⚠️ Dernière relance'
                                        : `🔄 Enregistrer la relance #${relanceCount + 1}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 3. Toast de succès (notification inline)
// ─────────────────────────────────────────────────────────

interface SuccessToastProps {
    message: string;
    nextStep?: string | null;
    onDismiss: () => void;
}

export function WorkflowSuccessToast({ message, nextStep, onDismiss }: SuccessToastProps) {
    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 max-w-md">
            <div className="bg-slate-800 border border-green-500/30 rounded-xl px-5 py-4 shadow-2xl shadow-green-500/10">
                <div className="flex items-start gap-3">
                    <span className="text-xl">✅</span>
                    <div className="flex-1">
                        <p className="text-sm text-white font-medium">{message}</p>
                        {nextStep === 'CHOIX_FINANCEMENT' && (
                            <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1.5">
                                🚀 Prochaine étape : choix du financement
                            </p>
                        )}
                        {nextStep === 'HANDLE_NON_HONORE' && (
                            <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1.5">
                                📞 Planifiez une action de suivi (appel ou relance)
                            </p>
                        )}
                        {nextStep === 'SUBMIT_TEST' && (
                            <p className="text-xs text-teal-400 mt-1.5 flex items-center gap-1.5">
                                📝 Prochaine étape : saisir le test / devis
                            </p>
                        )}
                        {nextStep === 'GENERATE_FACTURE' && (
                            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1.5">
                                ✅ Test validé — prêt pour la facturation
                            </p>
                        )}
                        {nextStep === 'CPF_INFO_SCREEN' && (
                            <p className="text-xs text-blue-400 mt-1.5 flex items-center gap-1.5">
                                🏛️ Guidez le prospect pour créer son compte CPF
                            </p>
                        )}
                    </div>
                    <button onClick={onDismiss} className="text-slate-500 hover:text-white text-sm transition-colors">✕</button>
                </div>
            </div>
        </div>
    );
}

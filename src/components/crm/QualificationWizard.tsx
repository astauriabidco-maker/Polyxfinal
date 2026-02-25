'use client';

import { useState, useTransition } from 'react';
import {
    planifierRelance,
    marquerNonHonore,
    enregistrerResultatAppel,
    choisirFinancement,
    genererLienTest,
} from '@/app/actions/qualification-wizard';
import FinancementCPFWizard from './FinancementCPFWizard';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface QualificationLead {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    status: string;
    dateRdv: string | null;
    notes: string | null;
    formationSouhaitee: string | null;
    assignedTo: { id: string; nom: string; prenom: string } | null;
}

interface QualificationWizardProps {
    lead: QualificationLead;
    performedBy: string;
    onClose: () => void;
    onComplete: (result: { newStatus: string; message: string }) => void;
    initialStep?: WizardStep;
    initialCpfStep?: string;
}

// Les étapes du wizard
type WizardStep =
    | 'rdv_honore'              // Étape 1 : Le lead a-t-il honoré le RDV ?
    | 'non_honore_actions'      // Branche A : Choix PLANIFIER RELANCE / APPELER
    | 'planifier_relance'       // A1 : Formulaire de planification de relance
    | 'appeler_lead'            // A2 : CallModal — choix du résultat d'appel
    | 'appel_confirm'           // A2 : Confirmation après choix du résultat
    | 'choix_financement'       // Branche B : Choix du mode de financement
    | 'financement_confirm'     // Branche B : Confirmation du financement choisi
    | 'perso_test_options'      // Financement Personnel : Test de positionnement
    | 'cpf_wizard';             // Financement CPF : sous-wizard dédié

// ─────────────────────────────────────────────────────────
// Composant principal — QualificationWizard
// ─────────────────────────────────────────────────────────

export default function QualificationWizard({
    lead,
    performedBy,
    onClose,
    onComplete,
    initialStep = 'rdv_honore',
    initialCpfStep,
}: QualificationWizardProps) {
    const [step, setStep] = useState<WizardStep>(initialStep);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // State pour le formulaire de planification de relance
    const [relanceDate, setRelanceDate] = useState('');
    const [relanceNotes, setRelanceNotes] = useState('');

    // State pour le CallModal (A2)
    type CallResult = 'REPONDU_INTERESSE' | 'REPONDU_NON_INTERESSE' | 'REPONDU_RAPPELER' | 'PAS_REPONSE_MESSAGE' | 'PAS_REPONSE_HORS_LIGNE' | 'NUMERO_INCORRECT';
    const [callResult, setCallResult] = useState<CallResult | null>(null);
    const [callDate, setCallDate] = useState('');
    const [callNotes, setCallNotes] = useState('');
    const [callLostReason, setCallLostReason] = useState('');

    // State pour le choix de financement (B)
    type FinancementType = 'CPF' | 'PERSONNEL' | 'POLE_EMPLOI' | 'OPCO';
    const [selectedFinancement, setSelectedFinancement] = useState<FinancementType | null>(null);
    const [financementNotes, setFinancementNotes] = useState('');

    // State pour le lien de test généré
    const [generatedTestLink, setGeneratedTestLink] = useState<string | null>(null);

    // ══════════════════════════════════════════════════════
    // Étape 1 : Le lead a-t-il honoré le RDV ?
    // ══════════════════════════════════════════════════════
    if (step === 'rdv_honore') {
        return (
            <WizardShell lead={lead} onClose={onClose} title="Qualification du RDV">
                <div className="text-center py-4">
                    {/* Info RDV */}
                    {lead.dateRdv && (
                        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 mb-6 inline-block">
                            <span className="text-xs text-slate-500">📅 RDV prévu le</span>
                            <p className="text-white font-medium text-sm mt-0.5">
                                {new Date(lead.dateRdv).toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                    )}

                    {/* Question */}
                    <h3 className="text-lg font-semibold text-white mb-2">
                        Le lead a-t-il honoré le rendez-vous ?
                    </h3>
                    <p className="text-sm text-slate-400 mb-8">
                        {lead.prenom} {lead.nom}
                        {lead.formationSouhaitee && (
                            <span className="text-slate-500"> — {lead.formationSouhaitee}</span>
                        )}
                    </p>

                    {/* Boutons Oui / Non */}
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => setStep('non_honore_actions')}
                            className="flex-1 max-w-[200px] flex flex-col items-center gap-3 px-6 py-5 rounded-xl border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/60 transition-all group"
                        >
                            <span className="text-4xl group-hover:scale-110 transition-transform">❌</span>
                            <span className="text-red-400 font-semibold text-sm">Non</span>
                            <span className="text-[11px] text-slate-500 leading-tight">
                                Le lead ne s&apos;est pas présenté
                            </span>
                        </button>

                        <button
                            onClick={() => setStep('choix_financement')}
                            className="flex-1 max-w-[200px] flex flex-col items-center gap-3 px-6 py-5 rounded-xl border-2 border-green-500/30 bg-green-500/5 hover:bg-green-500/15 hover:border-green-500/60 transition-all group"
                        >
                            <span className="text-4xl group-hover:scale-110 transition-transform">✅</span>
                            <span className="text-green-400 font-semibold text-sm">Oui</span>
                            <span className="text-[11px] text-slate-500 leading-tight">
                                Le lead a honoré le rendez-vous
                            </span>
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Branche A : RDV Non Honoré — Choix d'action
    // ══════════════════════════════════════════════════════
    if (step === 'non_honore_actions') {
        return (
            <WizardShell lead={lead} onClose={onClose} title="RDV Non Honoré">
                <div className="py-2">
                    {/* Message */}
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                            <span className="text-3xl">😞</span>
                        </div>
                        <h3 className="text-base font-semibold text-white mb-1">
                            {lead.prenom} {lead.nom} ne s&apos;est pas présenté(e)
                        </h3>
                        <p className="text-sm text-slate-400">
                            Que souhaitez-vous faire ?
                        </p>
                    </div>

                    {/* 2 Boutons d'action */}
                    <div className="space-y-3">
                        <button
                            onClick={() => setStep('planifier_relance')}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all group text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                <span className="text-2xl">📅</span>
                            </div>
                            <div>
                                <p className="text-amber-400 font-semibold text-sm">Planifier une relance</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Fixer une date pour rappeler le lead
                                </p>
                            </div>
                            <span className="ml-auto text-slate-600 group-hover:text-amber-400 transition-colors">→</span>
                        </button>

                        <button
                            onClick={() => setStep('appeler_lead')}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all group text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                <span className="text-2xl">📞</span>
                            </div>
                            <div>
                                <p className="text-cyan-400 font-semibold text-sm">Appeler le lead</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Passer un appel maintenant et enregistrer le résultat
                                </p>
                            </div>
                            <span className="ml-auto text-slate-600 group-hover:text-cyan-400 transition-colors">→</span>
                        </button>
                    </div>

                    {/* Retour */}
                    <div className="mt-5 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => setStep('rdv_honore')}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                        >
                            ← Retour
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // A1 : Planifier une relance
    // ══════════════════════════════════════════════════════
    if (step === 'planifier_relance') {
        const handlePlanifierRelance = () => {
            if (!relanceDate) {
                setError('Veuillez sélectionner une date de relance');
                return;
            }
            setError(null);
            startTransition(async () => {
                const result = await planifierRelance({
                    leadId: lead.id,
                    dateRelance: relanceDate,
                    notes: relanceNotes.trim() || undefined,
                    performedBy,
                });
                if (result.success) {
                    onComplete({
                        newStatus: result.newStatus || 'RDV_NON_HONORE',
                        message: result.message || 'Relance planifiée',
                    });
                } else {
                    setError(result.error || 'Erreur inconnue');
                }
            });
        };

        return (
            <WizardShell lead={lead} onClose={onClose} title="Planifier une relance">
                <div className="py-2">
                    {/* Icône */}
                    <div className="text-center mb-5">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">📅</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Planifier une relance téléphonique pour <span className="text-white font-medium">{lead.prenom} {lead.nom}</span>
                        </p>
                    </div>

                    {/* Formulaire */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                📅 Date et heure de la relance *
                            </label>
                            <input
                                type="datetime-local"
                                value={relanceDate}
                                onChange={(e) => setRelanceDate(e.target.value)}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                                min={new Date().toISOString().slice(0, 16)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                📝 Notes (optionnel)
                            </label>
                            <textarea
                                value={relanceNotes}
                                onChange={(e) => setRelanceNotes(e.target.value)}
                                placeholder="Ex: Le lead n'a pas répondu, essayer le matin..."
                                rows={3}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors resize-none"
                            />
                        </div>
                    </div>

                    {/* Erreur */}
                    {error && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                        <button
                            onClick={() => { setStep('non_honore_actions'); setError(null); }}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                            disabled={isPending}
                        >
                            ← Retour
                        </button>
                        <button
                            onClick={handlePlanifierRelance}
                            disabled={isPending || !relanceDate}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {isPending ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    En cours...
                                </>
                            ) : (
                                <>📅 Planifier la relance</>
                            )}
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // A2 : Appeler le lead — Résultat de l'appel
    // ══════════════════════════════════════════════════════
    if (step === 'appeler_lead') {
        const CALL_OPTIONS: { value: CallResult; icon: string; label: string; sublabel: string; color: string; borderColor: string; needsDate: boolean; needsReason: boolean }[] = [
            { value: 'REPONDU_INTERESSE', icon: '✅', label: 'Répondu — Intéressé', sublabel: 'Fixer un nouveau RDV', color: 'text-green-400', borderColor: 'border-green-500/30 hover:border-green-500/60 bg-green-500/5', needsDate: true, needsReason: false },
            { value: 'REPONDU_NON_INTERESSE', icon: '❌', label: 'Répondu — Non intéressé', sublabel: 'Marquer comme Perdu', color: 'text-red-400', borderColor: 'border-red-500/30 hover:border-red-500/60 bg-red-500/5', needsDate: false, needsReason: true },
            { value: 'REPONDU_RAPPELER', icon: '🔄', label: 'Répondu — Rappeler plus tard', sublabel: 'Planifier une relance', color: 'text-amber-400', borderColor: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5', needsDate: true, needsReason: false },
            { value: 'PAS_REPONSE_MESSAGE', icon: '📞', label: 'Pas de réponse — Message laissé', sublabel: 'Planifier une relance', color: 'text-blue-400', borderColor: 'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5', needsDate: true, needsReason: false },
            { value: 'PAS_REPONSE_HORS_LIGNE', icon: '📵', label: 'Pas de réponse — Hors ligne', sublabel: 'Relance ou Perdu (après 3 essais)', color: 'text-purple-400', borderColor: 'border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5', needsDate: true, needsReason: false },
            { value: 'NUMERO_INCORRECT', icon: '⚠️', label: 'Numéro incorrect', sublabel: 'Marquer comme Perdu + Envoyer email', color: 'text-orange-400', borderColor: 'border-orange-500/30 hover:border-orange-500/60 bg-orange-500/5', needsDate: false, needsReason: true },
        ];

        return (
            <WizardShell lead={lead} onClose={onClose} title="Résultat de l'appel">
                <div className="py-1">
                    {/* Info lead + téléphone */}
                    <div className="text-center mb-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">📞</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Appel à <span className="text-white font-medium">{lead.prenom} {lead.nom}</span>
                        </p>
                        {lead.telephone && (
                            <p className="text-xs text-cyan-400 mt-0.5 font-mono">{lead.telephone}</p>
                        )}
                    </div>

                    {/* 6 résultats d'appel */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {CALL_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setCallResult(opt.value);
                                    setCallDate('');
                                    setCallNotes('');
                                    setCallLostReason('');
                                    setError(null);
                                    setStep('appel_confirm');
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group text-left ${opt.borderColor}`}
                            >
                                <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{opt.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-semibold text-sm ${opt.color}`}>{opt.label}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{opt.sublabel}</p>
                                </div>
                                <span className="text-slate-600 group-hover:text-slate-400 transition-colors">→</span>
                            </button>
                        ))}
                    </div>

                    {/* Retour */}
                    <div className="mt-4 pt-3 border-t border-slate-800">
                        <button
                            onClick={() => setStep('non_honore_actions')}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                        >
                            ← Retour
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // A2 bis : Confirmation du résultat d'appel
    // ══════════════════════════════════════════════════════
    if (step === 'appel_confirm' && callResult) {
        const needsDate = ['REPONDU_INTERESSE', 'REPONDU_RAPPELER', 'PAS_REPONSE_MESSAGE', 'PAS_REPONSE_HORS_LIGNE'].includes(callResult);
        const needsReason = ['REPONDU_NON_INTERESSE', 'NUMERO_INCORRECT'].includes(callResult);
        const isInterested = callResult === 'REPONDU_INTERESSE';

        const RESULT_LABELS: Record<string, { icon: string; title: string; color: string }> = {
            REPONDU_INTERESSE: { icon: '✅', title: 'Intéressé — Fixer un RDV', color: 'from-green-500 to-emerald-500' },
            REPONDU_NON_INTERESSE: { icon: '❌', title: 'Non intéressé — Perdu', color: 'from-red-500 to-rose-500' },
            REPONDU_RAPPELER: { icon: '🔄', title: 'Rappeler plus tard', color: 'from-amber-500 to-orange-500' },
            PAS_REPONSE_MESSAGE: { icon: '📞', title: 'Message laissé — Relance', color: 'from-blue-500 to-cyan-500' },
            PAS_REPONSE_HORS_LIGNE: { icon: '📵', title: 'Hors ligne — Relance', color: 'from-purple-500 to-violet-500' },
            NUMERO_INCORRECT: { icon: '⚠️', title: 'Numéro incorrect — Perdu', color: 'from-orange-500 to-red-500' },
        };

        const meta = RESULT_LABELS[callResult];

        const handleSubmitCall = () => {
            if (needsDate && !callDate) {
                setError(isInterested ? 'Veuillez sélectionner la date du RDV' : 'Veuillez sélectionner la date de relance');
                return;
            }
            setError(null);
            startTransition(async () => {
                const result = await enregistrerResultatAppel({
                    leadId: lead.id,
                    performedBy,
                    resultat: callResult,
                    dateRelance: callDate || undefined,
                    notes: callNotes.trim() || undefined,
                    lostReason: callLostReason.trim() || undefined,
                });
                if (result.success) {
                    onComplete({
                        newStatus: result.newStatus || 'RDV_NON_HONORE',
                        message: result.message || 'Appel enregistré',
                    });
                } else {
                    setError(result.error || 'Erreur inconnue');
                }
            });
        };

        return (
            <WizardShell lead={lead} onClose={onClose} title={meta?.title || 'Confirmer l\'appel'}>
                <div className="py-2">
                    {/* Icône du résultat */}
                    <div className="text-center mb-5">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">{meta?.icon}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Champ date (RDV ou relance) */}
                        {needsDate && (
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    {isInterested ? '📅 Date et heure du nouveau RDV *' : '📅 Date et heure de la relance *'}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={callDate}
                                    onChange={(e) => setCallDate(e.target.value)}
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>
                        )}

                        {/* Raison de perte */}
                        {needsReason && (
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    📝 Raison de la perte (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={callLostReason}
                                    onChange={(e) => setCallLostReason(e.target.value)}
                                    placeholder={callResult === 'NUMERO_INCORRECT' ? 'Ex: numéro erroné, messagerie pleine...' : 'Ex: pas intéressé par la formation...'}
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-colors"
                                />
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                📝 Notes (optionnel)
                            </label>
                            <textarea
                                value={callNotes}
                                onChange={(e) => setCallNotes(e.target.value)}
                                placeholder="Commentaires sur l'appel..."
                                rows={2}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-500/30 transition-colors resize-none"
                            />
                        </div>
                    </div>

                    {/* Alerte numéro incorrect */}
                    {callResult === 'NUMERO_INCORRECT' && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
                            📧 Un email de suivi devra être envoyé manuellement au lead.
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                        <button
                            onClick={() => { setStep('appeler_lead'); setError(null); }}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                            disabled={isPending}
                        >
                            ← Retour
                        </button>
                        <button
                            onClick={handleSubmitCall}
                            disabled={isPending || (needsDate && !callDate)}
                            className={`px-5 py-2.5 rounded-xl bg-gradient-to-r ${meta?.color || 'from-cyan-500 to-blue-500'} text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2`}
                        >
                            {isPending ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    En cours...
                                </>
                            ) : (
                                <>Confirmer {meta?.icon}</>
                            )}
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Branche B : RDV Honoré — Choix du financement
    // ══════════════════════════════════════════════════════
    if (step === 'choix_financement') {
        const FINANCEMENT_OPTIONS: { value: FinancementType; icon: string; label: string; sublabel: string; nextStep: string; color: string; borderColor: string; bgGradient: string }[] = [
            {
                value: 'CPF', icon: '💳', label: 'CPF',
                sublabel: 'Compte Personnel de Formation',
                nextStep: 'Vérification du compte CPF',
                color: 'text-blue-400', borderColor: 'border-blue-500/30 hover:border-blue-500/60',
                bgGradient: 'bg-gradient-to-br from-blue-500/5 to-blue-600/10',
            },
            {
                value: 'PERSONNEL', icon: '💰', label: 'Fonds Personnel',
                sublabel: 'Paiement direct par le lead',
                nextStep: 'Test de positionnement + Devis',
                color: 'text-emerald-400', borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
                bgGradient: 'bg-gradient-to-br from-emerald-500/5 to-emerald-600/10',
            },
            {
                value: 'POLE_EMPLOI', icon: '🏛️', label: 'Pôle Emploi',
                sublabel: 'Demande AIF (Aide Individuelle à la Formation)',
                nextStep: 'Constitution du dossier AIF',
                color: 'text-violet-400', borderColor: 'border-violet-500/30 hover:border-violet-500/60',
                bgGradient: 'bg-gradient-to-br from-violet-500/5 to-violet-600/10',
            },
            {
                value: 'OPCO', icon: '🏢', label: 'OPCO',
                sublabel: 'Plan de formation entreprise',
                nextStep: 'Demande de prise en charge',
                color: 'text-amber-400', borderColor: 'border-amber-500/30 hover:border-amber-500/60',
                bgGradient: 'bg-gradient-to-br from-amber-500/5 to-amber-600/10',
            },
        ];

        return (
            <WizardShell lead={lead} onClose={onClose} title="Choix du financement">
                <div className="py-1">
                    {/* Header */}
                    <div className="text-center mb-5">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">✅</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            RDV honoré par <span className="text-white font-medium">{lead.prenom} {lead.nom}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Quel mode de financement le lead a-t-il choisi ?
                        </p>
                    </div>

                    {/* 4 options de financement */}
                    <div className="grid grid-cols-2 gap-3">
                        {FINANCEMENT_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setSelectedFinancement(opt.value);
                                    setFinancementNotes('');
                                    setError(null);
                                    setStep('financement_confirm');
                                }}
                                className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl border transition-all group text-center ${opt.borderColor} ${opt.bgGradient}`}
                            >
                                <span className="text-3xl group-hover:scale-110 transition-transform">{opt.icon}</span>
                                <p className={`font-semibold text-sm ${opt.color}`}>{opt.label}</p>
                                <p className="text-[10px] text-slate-500 leading-tight">{opt.sublabel}</p>
                                <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-800/50 border border-slate-700/50">
                                    <p className="text-[9px] text-slate-400">→ {opt.nextStep}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Retour */}
                    <div className="mt-5 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => setStep('rdv_honore')}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                        >
                            ← Retour
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Branche B bis : Confirmation du financement choisi
    // ══════════════════════════════════════════════════════
    if (step === 'financement_confirm' && selectedFinancement) {
        const FIN_META: Record<string, { icon: string; label: string; color: string; gradient: string; nextStepDetail: string }> = {
            CPF: {
                icon: '💳', label: 'CPF', color: 'text-blue-400', gradient: 'from-blue-500 to-cyan-500',
                nextStepDetail: 'Le lead sera redirigé vers la vérification de son compte CPF. Vous pourrez vérifier le solde disponible et lancer la procédure d\'inscription.',
            },
            PERSONNEL: {
                icon: '💰', label: 'Fonds Personnel', color: 'text-emerald-400', gradient: 'from-emerald-500 to-green-500',
                nextStepDetail: 'Un test de positionnement sera proposé au lead, suivi de l\'envoi d\'un devis personnalisé et d\'une facture.',
            },
            POLE_EMPLOI: {
                icon: '🏛️', label: 'Pôle Emploi (AIF)', color: 'text-violet-400', gradient: 'from-violet-500 to-purple-500',
                nextStepDetail: 'Le dossier AIF sera constitué avec les pièces justificatives.  Le lead sera accompagné dans sa demande auprès de Pôle Emploi.',
            },
            OPCO: {
                icon: '🏢', label: 'OPCO', color: 'text-amber-400', gradient: 'from-amber-500 to-orange-500',
                nextStepDetail: 'La demande de prise en charge sera soumise à l\'OPCO du lead. Les documents entreprise seront collectés.',
            },
        };

        const meta = FIN_META[selectedFinancement];

        const handleSubmitFinancement = () => {
            setError(null);
            startTransition(async () => {
                const result = await choisirFinancement({
                    leadId: lead.id,
                    performedBy,
                    financementType: selectedFinancement,
                    notes: financementNotes.trim() || undefined,
                });
                if (result.success) {
                    if (selectedFinancement === 'PERSONNEL') {
                        setStep('perso_test_options');
                        return;
                    }
                    if (selectedFinancement === 'CPF') {
                        setStep('cpf_wizard');
                        return;
                    }
                    onComplete({
                        newStatus: result.newStatus || 'NEGOCIATION',
                        message: result.message || 'Financement choisi',
                    });
                } else {
                    setError(result.error || 'Erreur inconnue');
                }
            });
        };

        return (
            <WizardShell lead={lead} onClose={onClose} title={`Financement : ${meta?.label}`}>
                <div className="py-2">
                    {/* Icône */}
                    <div className="text-center mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                            <span className="text-3xl">{meta?.icon}</span>
                        </div>
                        <h3 className={`text-base font-bold ${meta?.color}`}>{meta?.label}</h3>
                    </div>

                    {/* Détail prochaine étape */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 mb-5">
                        <p className="text-xs text-slate-500 mb-1 font-medium">📋 Prochaine étape :</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{meta?.nextStepDetail}</p>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            📝 Notes complémentaires (optionnel)
                        </label>
                        <textarea
                            value={financementNotes}
                            onChange={(e) => setFinancementNotes(e.target.value)}
                            placeholder="Informations spécifiques sur le financement..."
                            rows={2}
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-500/30 transition-colors resize-none"
                        />
                    </div>

                    {/* Erreur */}
                    {error && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                        <button
                            onClick={() => { setStep('choix_financement'); setError(null); }}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                            disabled={isPending}
                        >
                            ← Retour
                        </button>
                        <button
                            onClick={handleSubmitFinancement}
                            disabled={isPending}
                            className={`px-5 py-2.5 rounded-xl bg-gradient-to-r ${meta?.gradient || 'from-green-500 to-emerald-500'} text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2`}
                        >
                            {isPending ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    En cours...
                                </>
                            ) : (
                                <>Valider {meta?.icon}</>
                            )}
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Financement CPF : sous-wizard dédié
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_wizard') {
        return (
            <FinancementCPFWizard
                lead={lead}
                performedBy={performedBy}
                onClose={onClose}
                onComplete={onComplete}
                initialStep={initialCpfStep as any}
            />
        );
    }

    // ══════════════════════════════════════════════════════
    // Financement Personnel : Test de positionnement
    // ══════════════════════════════════════════════════════
    if (step === 'perso_test_options') {
        const handleEnvoyerLien = () => {
            setError(null);
            startTransition(async () => {
                const result = await genererLienTest({
                    leadId: lead.id,
                    performedBy,
                });
                if (result.success) {
                    setGeneratedTestLink(result.testLink || null);
                } else {
                    setError(result.error || 'Erreur inconnue');
                }
            });
        };

        return (
            <WizardShell lead={lead} onClose={onClose} title="Test de positionnement">
                <div className="py-2">
                    {/* Header */}
                    <div className="text-center mb-5">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">📝</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Test de positionnement pour <span className="text-white font-medium">{lead.prenom} {lead.nom}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Choisissez comment effectuer le test
                        </p>
                    </div>

                    {/* 2 options */}
                    <div className="space-y-3">
                        {/* Démarrer le test en direct */}
                        <button
                            onClick={() => {
                                // TODO: Intégration avec module test
                                window.open(`/admin/tests/nouveau?leadId=${lead.id}`, '_blank');
                            }}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 transition-all group text-left"
                        >
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <span className="text-xl">🚀</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-emerald-400">Démarrer le test</p>
                                <p className="text-[11px] text-slate-500">Lancer le module de test directement</p>
                            </div>
                            <span className="text-slate-600 group-hover:text-emerald-400 transition-colors">→</span>
                        </button>

                        {/* Envoyer un lien */}
                        <button
                            onClick={handleEnvoyerLien}
                            disabled={isPending || !!generatedTestLink}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-blue-500/5 to-blue-600/10 transition-all group text-left disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <span className="text-xl">🔗</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-blue-400">Envoyer un lien</p>
                                <p className="text-[11px] text-slate-500">
                                    {isPending ? 'Génération en cours...' : 'Générer un lien de test à envoyer au lead'}
                                </p>
                            </div>
                            {isPending ? (
                                <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                            ) : (
                                <span className="text-slate-600 group-hover:text-blue-400 transition-colors">→</span>
                            )}
                        </button>
                    </div>

                    {/* Lien généré */}
                    {generatedTestLink && (
                        <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
                            <p className="text-xs text-emerald-400 font-medium mb-1">✅ Lien généré avec succès</p>
                            <div className="flex items-center gap-2">
                                <code className="text-xs text-slate-300 bg-slate-800 rounded-lg px-3 py-1.5 flex-1 overflow-hidden text-ellipsis">
                                    {generatedTestLink}
                                </code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.origin + generatedTestLink);
                                    }}
                                    className="flex-shrink-0 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors"
                                >
                                    📋 Copier
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    onComplete({
                                        newStatus: 'TEST_EN_COURS_PERSO',
                                        message: 'Lien de test envoyé. En attente du résultat.',
                                    });
                                }}
                                className="mt-3 w-full px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                            >
                                ✅ Terminé — Fermer le wizard
                            </button>
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Retour */}
                    <div className="mt-5 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => { setStep('financement_confirm'); setGeneratedTestLink(null); setError(null); }}
                            className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                        >
                            ← Retour
                        </button>
                    </div>
                </div>
            </WizardShell>
        );
    }

    return null;
}

// ─────────────────────────────────────────────────────────
// Shell du Wizard (conteneur réutilisable)
// ─────────────────────────────────────────────────────────

function WizardShell({
    lead,
    onClose,
    title,
    children,
}: {
    lead: QualificationLead;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                            <span className="text-lg">🎯</span>
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base">{title}</h2>
                            <p className="text-xs text-slate-500">
                                {lead.prenom} {lead.nom}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-white text-xl transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    {children}
                </div>
            </div>
        </div>
    );
}

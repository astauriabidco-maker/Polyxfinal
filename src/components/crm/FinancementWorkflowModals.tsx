'use client';

import { useState, useTransition } from 'react';
import {
    chooseFinancement,
    submitTestResultOrManual,
    validateFactureManuelle,
    recordPaiement,
    relancePaiement,
} from '@/app/actions/financement';

// ─────────────────────────────────────────────────────────
// Types communs
// ─────────────────────────────────────────────────────────

interface LeadInfo {
    id: string;
    nom: string;
    prenom: string;
    status: string;
    financementType?: string | null;
    testVolume?: number | null;
    testTarif?: number | null;
    montantTotal?: number | null;
    montantPaye?: number | null;
    factureManuelleValidee?: boolean;
    relancePaiementCount?: number;
    dateFacture?: string | null;
}


// ─────────────────────────────────────────────────────────
// 1. MODALE — Choix du Financement
// ─────────────────────────────────────────────────────────

interface ChoixFinancementModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { newStatus: string; financementType: string; nextStep?: string; message?: string }) => void;
}

export function ChoixFinancementModal({ lead, performedBy, onClose, onSuccess }: ChoixFinancementModalProps) {
    const [isPending, startTransition] = useTransition();
    const [selectedType, setSelectedType] = useState<'PERSONNEL' | 'CPF' | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!selectedType) {
            setError('Veuillez choisir un mode de financement.');
            return;
        }

        setError('');
        startTransition(async () => {
            const result = await chooseFinancement({
                leadId: lead.id,
                type: selectedType,
                chosenBy: performedBy,
            });

            if (result.success) {
                onSuccess({
                    newStatus: result.newStatus!,
                    financementType: result.financementType!,
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
                            💰 Choix du Financement
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Info contextuelle */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-5">
                    <p className="text-green-400 font-medium text-sm">✅ RDV qualifié positivement</p>
                    <p className="text-green-400/70 text-xs mt-1">Le prospect souhaite poursuivre. Sélectionnez le mode de financement.</p>
                </div>

                {/* Options de financement */}
                <div className="space-y-3">
                    <p className="text-sm text-slate-300 font-medium">Comment le prospect souhaite-t-il financer sa formation ?</p>

                    {/* Financement Personnel */}
                    <button
                        onClick={() => setSelectedType('PERSONNEL')}
                        className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 transition-all text-left ${selectedType === 'PERSONNEL'
                            ? 'border-emerald-500/60 bg-emerald-500/10 shadow-sm shadow-emerald-500/10'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }`}
                    >
                        <span className="text-3xl mt-0.5">💳</span>
                        <div className="flex-1">
                            <span className="text-emerald-400 font-semibold text-sm block">Financement Personnel</span>
                            <span className="text-[11px] text-slate-400 leading-tight block mt-1">
                                Paiement direct par le prospect (carte, virement, chèque).
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Test / Devis</span>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Facture</span>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Paiement</span>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Inscription</span>
                            </div>
                        </div>
                    </button>

                    {/* Financement CPF */}
                    <button
                        onClick={() => setSelectedType('CPF')}
                        className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 transition-all text-left ${selectedType === 'CPF'
                            ? 'border-blue-500/60 bg-blue-500/10 shadow-sm shadow-blue-500/10'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }`}
                    >
                        <span className="text-3xl mt-0.5">🏛️</span>
                        <div className="flex-1">
                            <span className="text-blue-400 font-semibold text-sm block">Compte Personnel de Formation (CPF)</span>
                            <span className="text-[11px] text-slate-400 leading-tight block mt-1">
                                Mobilisation du solde CPF via Mon Compte Formation.
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">Création compte CPF</span>
                                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">Inscription en ligne</span>
                                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">Validation CDC</span>
                            </div>
                        </div>
                    </button>
                </div>

                {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mt-4">{error}</p>}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-5">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || !selectedType}
                        className={`px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium ${selectedType === 'PERSONNEL' ? 'bg-emerald-600 hover:bg-emerald-500'
                            : selectedType === 'CPF' ? 'bg-blue-600 hover:bg-blue-500'
                                : 'bg-slate-600'
                            }`}
                    >
                        {isPending ? '⏳ En cours...' : selectedType === 'PERSONNEL'
                            ? '💳 Financement Personnel' : selectedType === 'CPF'
                                ? '🏛️ Financement CPF' : 'Sélectionnez une option'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 2. MODALE — Saisie Test / Devis (Parcours Personnel)
// ─────────────────────────────────────────────────────────

interface TestDevisModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { montantTotal: number; isManual: boolean; nextStep?: string; message?: string }) => void;
}

export function TestDevisModal({ lead, performedBy, onClose, onSuccess }: TestDevisModalProps) {
    const [isPending, startTransition] = useTransition();
    const [volume, setVolume] = useState<string>(lead.testVolume?.toString() || '');
    const [tarif, setTarif] = useState<string>(lead.testTarif?.toString() || '');
    const [isManual, setIsManual] = useState(true);
    const [error, setError] = useState('');

    const volumeNum = parseInt(volume) || 0;
    const tarifNum = parseFloat(tarif) || 0;
    const montantTotal = volumeNum * tarifNum;

    const handleSubmit = () => {
        setError('');

        if (volumeNum <= 0) {
            setError('Le volume horaire doit être supérieur à 0.');
            return;
        }
        if (tarifNum <= 0) {
            setError('Le tarif doit être supérieur à 0.');
            return;
        }

        startTransition(async () => {
            const result = await submitTestResultOrManual({
                leadId: lead.id,
                volume: volumeNum,
                tarif: tarifNum,
                isManual,
                submittedBy: performedBy,
            });

            if (result.success) {
                onSuccess({
                    montantTotal: result.montantTotal!,
                    isManual: result.isManual!,
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
                            📝 Test / Devis
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom} — Financement Personnel
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2 mb-5">
                    <button
                        onClick={() => setIsManual(false)}
                        className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all ${!isManual
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                            }`}
                    >
                        ✅ Test automatique
                    </button>
                    <button
                        onClick={() => setIsManual(true)}
                        className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all ${isManual
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                            }`}
                    >
                        📝 Saisie manuelle
                    </button>
                </div>

                {isManual && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                        <p className="text-amber-400 font-medium text-xs">⚠️ Saisie manuelle</p>
                        <p className="text-amber-400/70 text-[11px] mt-1">Le devis nécessitera une validation avant facturation.</p>
                    </div>
                )}

                {/* Formulaire */}
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-300 block mb-1.5 font-medium">
                            Volume horaire (heures) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={volume}
                            onChange={(e) => setVolume(e.target.value)}
                            placeholder="Ex: 35"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-slate-300 block mb-1.5 font-medium">
                            Tarif horaire (€/h) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={tarif}
                            onChange={(e) => setTarif(e.target.value)}
                            placeholder="Ex: 25.00"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                    </div>

                    {/* Montant calculé */}
                    {volumeNum > 0 && tarifNum > 0 && (
                        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                            <div className="text-xs text-slate-500 mb-1">Montant total calculé</div>
                            <div className="text-2xl font-bold text-white">{montantTotal.toFixed(2)} €</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {volumeNum}h × {tarifNum.toFixed(2)}€/h
                            </div>
                        </div>
                    )}
                </div>

                {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mt-4">{error}</p>}

                <div className="flex justify-end gap-3 pt-5">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || volumeNum <= 0 || tarifNum <= 0}
                        className="px-5 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isPending ? '⏳ En cours...' : isManual ? '📝 Soumettre le devis' : '✅ Valider le test'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 3. MODALE — Validation Facture Manuelle
// ─────────────────────────────────────────────────────────

interface ValidateFactureModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { newStatus: string; montantTotal: number; message?: string }) => void;
}

export function ValidateFactureModal({ lead, performedBy, onClose, onSuccess }: ValidateFactureModalProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const handleValidate = () => {
        setError('');

        startTransition(async () => {
            const result = await validateFactureManuelle({
                leadId: lead.id,
                validatedBy: performedBy,
            });

            if (result.success) {
                onSuccess({
                    newStatus: result.newStatus!,
                    montantTotal: result.montantTotal!,
                    message: result.message,
                });
            } else {
                setError(result.error || 'Erreur inconnue');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            ✅ Valider la Facture
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Récapitulatif */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-5 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Volume</span>
                        <span className="text-white font-medium">{lead.testVolume || 0}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Tarif horaire</span>
                        <span className="text-white font-medium">{(lead.testTarif || 0).toFixed(2)}€/h</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between text-sm">
                        <span className="text-slate-300 font-semibold">Montant Total</span>
                        <span className="text-emerald-400 font-bold text-lg">{(lead.montantTotal || 0).toFixed(2)}€</span>
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                    <p className="text-amber-400 font-medium text-xs">⚠️ Validation requise</p>
                    <p className="text-amber-400/70 text-[11px] mt-1">
                        Cette facture a été saisie manuellement. En validant, vous confirmez les montants
                        et le lead passera en &quot;En attente de paiement&quot;.
                    </p>
                </div>

                {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                <div className="flex justify-end gap-3 pt-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                    <button
                        onClick={handleValidate}
                        disabled={isPending}
                        className="px-5 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isPending ? '⏳ En cours...' : '✅ Valider la facture'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 4. MODALE — Enregistrement Paiement
// ─────────────────────────────────────────────────────────

interface PaiementModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { newStatus: string; montantPaye: number; seuilAtteint: boolean; message?: string }) => void;
}

export function PaiementModal({ lead, performedBy, onClose, onSuccess }: PaiementModalProps) {
    const [isPending, startTransition] = useTransition();
    const [montant, setMontant] = useState<string>('');
    const [error, setError] = useState('');

    const montantNum = parseFloat(montant) || 0;
    const montantTotal = lead.montantTotal || 0;
    const montantDejaPaye = lead.montantPaye || 0;
    const resteAPayer = montantTotal - montantDejaPaye;
    const newTotalPaye = montantDejaPaye + montantNum;
    const pourcentage = montantTotal > 0 ? ((newTotalPaye / montantTotal) * 100) : 0;

    const handleSubmit = () => {
        setError('');

        if (montantNum <= 0) {
            setError('Le montant doit être supérieur à 0.');
            return;
        }

        startTransition(async () => {
            const result = await recordPaiement({
                leadId: lead.id,
                montant: montantNum,
                recordedBy: performedBy,
            });

            if (result.success) {
                onSuccess({
                    newStatus: result.newStatus!,
                    montantPaye: result.montantPaye!,
                    seuilAtteint: result.seuilAtteint!,
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
                            💳 Enregistrer un Paiement
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Résumé financier */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <div className="text-xs text-slate-500">Montant total</div>
                            <div className="text-white font-bold text-lg">{montantTotal.toFixed(2)}€</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500">Déjà payé</div>
                            <div className="text-emerald-400 font-bold text-lg">{montantDejaPaye.toFixed(2)}€</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500">Reste à payer</div>
                            <div className="text-amber-400 font-bold text-lg">{resteAPayer.toFixed(2)}€</div>
                        </div>
                    </div>

                    {/* Barre de progression */}
                    <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>Progression</span>
                            <span>{Math.min(pourcentage, 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-500 ${pourcentage >= 100 ? 'bg-green-500'
                                    : pourcentage >= 30 ? 'bg-emerald-500'
                                        : 'bg-amber-500'
                                    }`}
                                style={{ width: `${Math.min(pourcentage, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                            <span>0€</span>
                            <span className="text-amber-500/60">Seuil 30%</span>
                            <span>{montantTotal.toFixed(0)}€</span>
                        </div>
                    </div>
                </div>

                {/* Saisie du montant */}
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-300 block mb-1.5 font-medium">
                            Montant reçu (€) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            max={resteAPayer}
                            value={montant}
                            onChange={(e) => setMontant(e.target.value)}
                            placeholder={`Ex: ${resteAPayer.toFixed(2)}`}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                    </div>

                    {/* Boutons de montant rapide */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMontant(resteAPayer.toFixed(2))}
                            className="flex-1 px-2 py-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
                        >
                            💯 Totalité ({resteAPayer.toFixed(2)}€)
                        </button>
                        {resteAPayer > 100 && (
                            <button
                                onClick={() => setMontant((resteAPayer / 2).toFixed(2))}
                                className="flex-1 px-2 py-1.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                            >
                                ½ Moitié ({(resteAPayer / 2).toFixed(2)}€)
                            </button>
                        )}
                        {montantTotal > 0 && (
                            <button
                                onClick={() => setMontant((montantTotal * 0.3 - montantDejaPaye > 0 ? montantTotal * 0.3 - montantDejaPaye : montantTotal * 0.3).toFixed(2))}
                                className="flex-1 px-2 py-1.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors"
                            >
                                📊 Seuil 30% ({(montantTotal * 0.3).toFixed(2)}€)
                            </button>
                        )}
                    </div>

                    {/* Aperçu après paiement */}
                    {montantNum > 0 && (
                        <div className={`rounded-xl p-3 border ${pourcentage >= 30
                            ? 'bg-green-500/10 border-green-500/20'
                            : 'bg-amber-500/10 border-amber-500/20'
                            }`}>
                            <p className={`font-medium text-xs ${pourcentage >= 30 ? 'text-green-400' : 'text-amber-400'}`}>
                                {pourcentage >= 100 ? '🎉 Paiement total — le lead sera INSCRIT'
                                    : pourcentage >= 30 ? '✅ Seuil de 30% atteint — le lead sera INSCRIT'
                                        : `⏳ Seuil de 30% non atteint (${pourcentage.toFixed(1)}%) — reste en attente`}
                            </p>
                        </div>
                    )}
                </div>

                {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mt-4">{error}</p>}

                <div className="flex justify-end gap-3 pt-5">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || montantNum <= 0}
                        className="px-5 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isPending ? '⏳ En cours...' : `💳 Enregistrer ${montantNum > 0 ? montantNum.toFixed(2) + '€' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 5. MODALE — Relance Paiement
// ─────────────────────────────────────────────────────────

interface RelancePaiementModalProps {
    lead: LeadInfo;
    performedBy: string;
    onClose: () => void;
    onSuccess: (result: { newStatus: string; relanceCount: number; message?: string }) => void;
}

export function RelancePaiementModal({ lead, performedBy, onClose, onSuccess }: RelancePaiementModalProps) {
    const [isPending, startTransition] = useTransition();
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const relanceCount = lead.relancePaiementCount || 0;
    const daysSinceFacture = lead.dateFacture
        ? Math.floor((Date.now() - new Date(lead.dateFacture).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const handleSubmit = () => {
        setError('');
        startTransition(async () => {
            const result = await relancePaiement({
                leadId: lead.id,
                performedBy,
                notes: notes.trim() || undefined,
            });

            if (result.success) {
                onSuccess({
                    newStatus: result.newStatus!,
                    relanceCount: result.relanceCount!,
                    message: result.message,
                });
            } else {
                setError(result.error || 'Erreur inconnue');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            🔔 Relance Paiement
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Info */}
                <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border text-xs font-medium ${daysSinceFacture >= 7
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : daysSinceFacture >= 3
                        ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                    <span>📅 J+{daysSinceFacture} depuis l&apos;envoi de la facture</span>
                    <span className="ml-auto">🔄 Relances : {relanceCount}</span>
                </div>

                {daysSinceFacture >= 14 && (lead.montantPaye || 0) === 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                        <p className="text-red-400 font-medium text-xs">⚠️ Attention : archivage imminent !</p>
                        <p className="text-red-400/70 text-[11px] mt-1">
                            J+14 dépassé sans aucun paiement. Cette relance déclenchera l&apos;archivage automatique (Lead → PERDU).
                        </p>
                    </div>
                )}

                <div>
                    <label className="text-sm text-slate-300 block mb-1.5 font-medium">Notes de relance</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Appel effectué, mail de rappel envoyé..."
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    />
                </div>

                {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className="px-5 py-2.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isPending ? '⏳ En cours...' : `🔔 Envoyer la relance #${relanceCount + 1}`}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────
// 6. INFO — Écran CPF (Information / guidage)
// ─────────────────────────────────────────────────────────

interface CpfInfoModalProps {
    lead: LeadInfo;
    onClose: () => void;
}

export function CpfInfoModal({ lead, onClose }: CpfInfoModalProps) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            🏛️ Parcours CPF
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {lead.prenom} {lead.nom}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
                </div>

                {/* Statut actuel */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-5">
                    <p className="text-blue-400 font-medium text-sm">📋 Financement CPF sélectionné</p>
                    <p className="text-blue-400/70 text-xs mt-1">Le prospect doit créer ou activer son compte CPF sur moncompteformation.gouv.fr</p>
                </div>

                {/* Étapes pour le prospect */}
                <div className="space-y-3 mb-5">
                    <p className="text-sm text-slate-300 font-medium">Étapes à communiquer au prospect :</p>
                    <div className="space-y-2">
                        {[
                            { step: 1, text: 'Créer un compte sur moncompteformation.gouv.fr', icon: '🔑' },
                            { step: 2, text: 'Vérifier le solde CPF disponible', icon: '💰' },
                            { step: 3, text: 'Rechercher la formation sur la plateforme', icon: '🔍' },
                            { step: 4, text: 'Soumettre la demande d\'inscription', icon: '📝' },
                            { step: 5, text: 'Attendre la validation par la Caisse des Dépôts', icon: '⏳' },
                        ].map(item => (
                            <div key={item.step} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                    {item.step}
                                </div>
                                <span className="text-sm text-slate-300">{item.icon} {item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 mb-4">
                    <p className="text-[11px] text-slate-400">
                        <strong className="text-slate-300">💡 Conseil :</strong> Le lead restera en &quot;CPF — Compte à demander&quot; jusqu&apos;à ce que
                        vous le déplaciez manuellement dans le Kanban (vers &quot;Convention Signée&quot; ou &quot;Montage Dossier&quot;)
                        une fois le processus CPF enclenché.
                    </p>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
                    >
                        Compris, fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

'use client';

/**
 * COMPOSANT — Formulaire Candidat Franchise (Création + Édition)
 * ===============================================================
 * Modal dual : création d'un nouveau candidat ou édition d'un existant.
 * Supporte personne morale (société + représentant) et type OF/CFA.
 */

import { useState, useRef, useEffect } from 'react';
import { createCandidate, updateCandidate } from './actions';

// Type des données candidat pour pré-remplir en édition
export interface CandidateData {
    id: string;
    franchiseType: string;
    companyName: string;
    siret: string | null;
    email: string;
    phone: string | null;
    representantNom: string;
    representantPrenom: string;
    representantFonction: string | null;
    targetZone: string | null;
    targetZipCodes: string[];
    investmentBudget: number | string | null;
    notes: string | null;
}

interface CandidateFormProps {
    candidate?: CandidateData | null;
    onClose?: () => void;
    triggerButton?: boolean; // true = affiche le bouton "Nouveau Candidat"
}

export default function CandidateForm({ candidate, onClose, triggerButton = true }: CandidateFormProps) {
    const [isOpen, setIsOpen] = useState(!triggerButton); // Auto-ouvert si pas de trigger
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const isEdit = !!candidate;

    // Auto-ouvrir quand on passe un candidat
    useEffect(() => {
        if (candidate) setIsOpen(true);
    }, [candidate]);

    function handleClose() {
        if (isSubmitting) return;
        setIsOpen(false);
        setError(null);
        onClose?.();
    }

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        setError(null);

        if (isEdit && candidate) {
            formData.set('candidateId', candidate.id);
        }

        const action = isEdit ? updateCandidate : createCandidate;
        const result = await action(formData);

        if (result.error) {
            setError(result.error);
            setIsSubmitting(false);
            return;
        }

        // Succès — fermer
        setIsOpen(false);
        setIsSubmitting(false);
        formRef.current?.reset();
        onClose?.();
    }

    const inputClass = "w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm";

    return (
        <>
            {/* Bouton d'ouverture — seulement en mode création */}
            {triggerButton && (
                <button
                    onClick={() => { setIsOpen(true); setError(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nouveau Candidat
                </button>
            )}

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-700">
                            <div>
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    🏢 {isEdit ? 'Modifier le Candidat' : 'Nouveau Candidat Franchise'}
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {isEdit
                                        ? 'Modifiez les informations du candidat'
                                        : 'Ajoutez une personne morale au pipeline de recrutement'}
                                </p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mx-5 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Form */}
                        <form ref={formRef} action={handleSubmit} className="p-5 space-y-5">

                            {/* ═══ Type de franchise ═══ */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Type de franchise <span className="text-red-400">*</span>
                                </label>
                                <div className="flex gap-3">
                                    <label className="flex-1 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="franchiseType"
                                            value="OF"
                                            defaultChecked={candidate?.franchiseType === 'OF' || !candidate}
                                            className="sr-only peer"
                                        />
                                        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-600 peer-checked:border-blue-500 peer-checked:bg-blue-500/10 transition-all">
                                            <span className="text-lg">🏫</span>
                                            <div>
                                                <span className="text-sm font-semibold text-white">OF</span>
                                                <p className="text-xs text-slate-400">Organisme de Formation</p>
                                            </div>
                                        </div>
                                    </label>
                                    <label className="flex-1 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="franchiseType"
                                            value="CFA"
                                            defaultChecked={candidate?.franchiseType === 'CFA'}
                                            className="sr-only peer"
                                        />
                                        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-600 peer-checked:border-emerald-500 peer-checked:bg-emerald-500/10 transition-all">
                                            <span className="text-lg">🎓</span>
                                            <div>
                                                <span className="text-sm font-semibold text-white">CFA</span>
                                                <p className="text-xs text-slate-400">Centre de Formation d&apos;Apprentis</p>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* ═══ Société ═══ */}
                            <fieldset className="border border-slate-700/50 rounded-lg p-4 space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                                    🏢 Société candidate
                                </legend>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Raison sociale */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Raison sociale <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            name="companyName"
                                            type="text"
                                            required
                                            defaultValue={candidate?.companyName || ''}
                                            placeholder="Ex: SARL Formation Express"
                                            className={inputClass}
                                        />
                                    </div>

                                    {/* SIRET */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            N° SIRET
                                        </label>
                                        <input
                                            name="siret"
                                            type="text"
                                            defaultValue={candidate?.siret || ''}
                                            placeholder="123 456 789 00012"
                                            maxLength={17}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Email de contact <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            defaultValue={candidate?.email || ''}
                                            placeholder="contact@societe.fr"
                                            className={inputClass}
                                        />
                                    </div>

                                    {/* Téléphone */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Téléphone
                                        </label>
                                        <input
                                            name="phone"
                                            type="tel"
                                            defaultValue={candidate?.phone || ''}
                                            placeholder="01 23 45 67 89"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </fieldset>

                            {/* ═══ Représentant ═══ */}
                            <fieldset className="border border-slate-700/50 rounded-lg p-4 space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                                    👤 Représentant légal
                                </legend>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Nom */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Nom <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            name="representantNom"
                                            type="text"
                                            required
                                            defaultValue={candidate?.representantNom || ''}
                                            placeholder="Dupont"
                                            className={inputClass}
                                        />
                                    </div>

                                    {/* Prénom */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Prénom <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            name="representantPrenom"
                                            type="text"
                                            required
                                            defaultValue={candidate?.representantPrenom || ''}
                                            placeholder="Jean"
                                            className={inputClass}
                                        />
                                    </div>

                                    {/* Fonction */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Fonction
                                        </label>
                                        <input
                                            name="representantFonction"
                                            type="text"
                                            defaultValue={candidate?.representantFonction || ''}
                                            placeholder="Gérant, DG..."
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </fieldset>

                            {/* ═══ Projet ═══ */}
                            <fieldset className="border border-slate-700/50 rounded-lg p-4 space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                                    📍 Projet territorial
                                </legend>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Zone cible */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Zone géographique visée
                                        </label>
                                        <input
                                            name="targetZone"
                                            type="text"
                                            defaultValue={candidate?.targetZone || ''}
                                            placeholder="Ex: Lyon Est, Marseille Nord..."
                                            className={inputClass}
                                        />
                                    </div>

                                    {/* Budget investissement */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Budget d&apos;investissement (€)
                                        </label>
                                        <input
                                            name="investmentBudget"
                                            type="number"
                                            min="0"
                                            step="1000"
                                            defaultValue={candidate?.investmentBudget ? String(candidate.investmentBudget) : ''}
                                            placeholder="50000"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                {/* Codes postaux */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                        Codes postaux visés
                                    </label>
                                    <input
                                        name="targetZipCodes"
                                        type="text"
                                        defaultValue={candidate?.targetZipCodes?.join(', ') || ''}
                                        placeholder="69001, 69002, 69003"
                                        className={inputClass}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Séparés par des virgules</p>
                                </div>
                            </fieldset>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Notes internes
                                </label>
                                <textarea
                                    name="notes"
                                    rows={3}
                                    defaultValue={candidate?.notes || ''}
                                    placeholder="Commentaires, contexte, remarques..."
                                    className={`${inputClass} resize-none`}
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            {isEdit ? 'Mise à jour...' : 'Création...'}
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d={isEdit ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                                            </svg>
                                            {isEdit ? 'Enregistrer' : 'Ajouter au pipeline'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

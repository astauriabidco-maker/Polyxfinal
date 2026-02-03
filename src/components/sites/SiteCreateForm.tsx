/**
 * SITE CREATE FORM - Client Component
 * ====================================
 * Formulaire de création de site avec validation CFA (UAI).
 * 
 * Caractéristiques :
 * - Validation UAI en temps réel pour les CFA
 * - Format UAI : 7 chiffres + 1 lettre (ex: 0751234A)
 * - Feedback visuel immédiat
 * - Integration avec le moteur de compliance
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SiteCreateFormProps {
    organizationId: string;
    organizationType: 'CFA' | 'OF_STANDARD' | 'BILAN' | 'VAE';
    organizationName: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface ValidationState {
    isValid: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

// Regex UAI: 7 chiffres + 1 lettre majuscule
const UAI_REGEX = /^[0-9]{7}[A-Z]$/;

/**
 * Valide le format du code UAI
 */
function validateUAI(code: string): ValidationState {
    if (!code) {
        return { isValid: false, message: 'Code UAI requis pour les CFA', type: 'error' };
    }

    if (code.length < 8) {
        return { isValid: false, message: `${8 - code.length} caractères restants`, type: 'info' };
    }

    if (code.length > 8) {
        return { isValid: false, message: 'Le code UAI fait 8 caractères maximum', type: 'error' };
    }

    if (!UAI_REGEX.test(code)) {
        // Détail de l'erreur
        const digits = code.slice(0, 7);
        const letter = code.slice(7);

        if (!/^[0-9]{7}$/.test(digits)) {
            return { isValid: false, message: 'Les 7 premiers caractères doivent être des chiffres', type: 'error' };
        }
        if (!/^[A-Z]$/.test(letter)) {
            return { isValid: false, message: 'Le 8ème caractère doit être une lettre majuscule', type: 'error' };
        }
    }

    return { isValid: true, message: 'Format UAI valide ✓', type: 'success' };
}

export default function SiteCreateForm({
    organizationId,
    organizationType,
    organizationName,
    onSuccess,
    onCancel,
}: SiteCreateFormProps) {
    const router = useRouter();
    const isCFA = organizationType === 'CFA';

    // Form state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [uaiCode, setUaiCode] = useState('');

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uaiValidation, setUaiValidation] = useState<ValidationState | null>(null);

    // Validation UAI en temps réel
    useEffect(() => {
        if (isCFA) {
            if (uaiCode) {
                setUaiValidation(validateUAI(uaiCode.toUpperCase()));
            } else {
                setUaiValidation({ isValid: false, message: 'Code UAI obligatoire pour les CFA', type: 'warning' });
            }
        }
    }, [uaiCode, isCFA]);

    // Handler pour le code UAI (auto-uppercase)
    const handleUaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
        setUaiCode(value);
    };

    // Soumission du formulaire
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation CFA
        if (isCFA && (!uaiValidation?.isValid)) {
            setError('Le code UAI est invalide. Format attendu: 7 chiffres + 1 lettre (ex: 0751234A)');
            return;
        }

        if (!name.trim()) {
            setError('Le nom du site est obligatoire');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId,
                    name: name.trim(),
                    address: address.trim() || null,
                    city: city.trim() || null,
                    postalCode: postalCode.trim() || null,
                    uaiCode: isCFA ? uaiCode.toUpperCase() : null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création du site');
            }

            // Succès
            if (onSuccess) {
                onSuccess();
            } else {
                router.refresh();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Classes pour le statut de validation UAI
    const getUaiInputClasses = () => {
        if (!uaiValidation) return 'border-gray-600 focus:border-blue-500';

        switch (uaiValidation.type) {
            case 'success':
                return 'border-emerald-500 focus:border-emerald-400 bg-emerald-500/10';
            case 'error':
                return 'border-red-500 focus:border-red-400 bg-red-500/10';
            case 'warning':
                return 'border-amber-500 focus:border-amber-400 bg-amber-500/10';
            default:
                return 'border-gray-600 focus:border-blue-500';
        }
    };

    const getUaiMessageClasses = () => {
        if (!uaiValidation) return 'text-gray-400';

        switch (uaiValidation.type) {
            case 'success':
                return 'text-emerald-400';
            case 'error':
                return 'text-red-400';
            case 'warning':
                return 'text-amber-400';
            default:
                return 'text-gray-400';
        }
    };

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Nouveau Site
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Ajouter un site à <span className="text-white font-medium">{organizationName}</span>
                </p>

                {/* Badge CFA */}
                {isCFA && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        CFA - Code UAI obligatoire
                    </div>
                )}
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nom du site */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Nom du site <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Campus Paris 15ème"
                        className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        required
                    />
                </div>

                {/* Code UAI (CFA uniquement) */}
                {isCFA && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Code UAI <span className="text-red-400">*</span>
                            <span className="text-gray-500 font-normal ml-2">(Unité Administrative Immatriculée)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={uaiCode}
                                onChange={handleUaiChange}
                                placeholder="Ex: 0751234A"
                                maxLength={8}
                                className={`
                                    w-full bg-gray-900/50 border rounded-lg px-4 py-2.5 text-white 
                                    placeholder-gray-500 focus:outline-none focus:ring-1 
                                    transition-colors font-mono text-lg tracking-wider
                                    ${getUaiInputClasses()}
                                `}
                            />
                            {/* Indicateur de validation */}
                            {uaiValidation && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {uaiValidation.type === 'success' && (
                                        <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {uaiValidation.type === 'error' && (
                                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Message de validation */}
                        {uaiValidation && (
                            <p className={`mt-1.5 text-sm ${getUaiMessageClasses()}`}>
                                {uaiValidation.message}
                            </p>
                        )}
                        {/* Aide */}
                        <p className="mt-2 text-xs text-gray-500">
                            Le code UAI est attribué par le Rectorat. Vous pouvez le trouver sur le site de l'académie.
                        </p>
                    </div>
                )}

                {/* Adresse */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Adresse
                    </label>
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Ex: 123 rue de la Formation"
                        className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                </div>

                {/* Ville + Code Postal */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Code Postal
                        </label>
                        <input
                            type="text"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            placeholder="75015"
                            maxLength={5}
                            className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Ville
                        </label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Paris"
                            className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Erreur globale */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-300 text-sm">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Annuler
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || (isCFA && !uaiValidation?.isValid)}
                        className={`
                            px-6 py-2 rounded-lg font-medium transition-all
                            flex items-center gap-2
                            ${isSubmitting || (isCFA && !uaiValidation?.isValid)
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/25'
                            }
                        `}
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Création...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Créer le site
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

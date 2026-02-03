/**
 * ORGANIZATION CREATE FORM - Client Component
 * ============================================
 * Formulaire de création d'organisation avec validation compliance.
 * 
 * Validations:
 * - SIRET: 14 chiffres obligatoire
 * - NDA: 11 chiffres (recommandé)
 * - Qualiopi: recommandé pour financements publics
 * - Avertissements spécifiques CFA
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Types d'organisation
const ORG_TYPES = [
    { value: 'OF_STANDARD', label: 'Organisme de Formation (OF)', description: 'Formation professionnelle continue' },
    { value: 'CFA', label: 'Centre de Formation d\'Apprentis (CFA)', description: 'Formation par apprentissage' },
    { value: 'BILAN', label: 'Bilan de Compétences', description: 'Accompagnement et évaluation' },
    { value: 'VAE', label: 'VAE', description: 'Validation des Acquis de l\'Expérience' },
];

interface ValidationState {
    isValid: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

// Regex validations
const SIRET_REGEX = /^[0-9]{14}$/;
const NDA_REGEX = /^[0-9]{11}$/;

/**
 * Valide le format SIRET (14 chiffres)
 */
function validateSiret(siret: string): ValidationState {
    const cleaned = siret.replace(/\s/g, '');

    if (!cleaned) {
        return { isValid: false, message: 'SIRET obligatoire', type: 'error' };
    }

    if (cleaned.length < 14) {
        return { isValid: false, message: `${14 - cleaned.length} chiffres restants`, type: 'info' };
    }

    if (cleaned.length > 14) {
        return { isValid: false, message: 'Le SIRET fait 14 chiffres maximum', type: 'error' };
    }

    if (!SIRET_REGEX.test(cleaned)) {
        return { isValid: false, message: 'Le SIRET ne doit contenir que des chiffres', type: 'error' };
    }

    return { isValid: true, message: 'SIRET valide ✓', type: 'success' };
}

/**
 * Valide le format NDA (11 chiffres)
 */
function validateNda(nda: string): ValidationState | null {
    if (!nda) return null; // Optionnel

    const cleaned = nda.replace(/\s/g, '');

    if (cleaned.length < 11) {
        return { isValid: false, message: `${11 - cleaned.length} chiffres restants`, type: 'info' };
    }

    if (cleaned.length > 11) {
        return { isValid: false, message: 'Le NDA fait 11 chiffres', type: 'error' };
    }

    if (!NDA_REGEX.test(cleaned)) {
        return { isValid: false, message: 'Format invalide', type: 'error' };
    }

    return { isValid: true, message: 'NDA valide ✓', type: 'success' };
}

interface OrganizationCreateFormProps {
    onSuccess?: (org: { id: string; name: string }) => void;
    onCancel?: () => void;
}

export default function OrganizationCreateForm({
    onSuccess,
    onCancel,
}: OrganizationCreateFormProps) {
    const router = useRouter();

    // Form state
    const [name, setName] = useState('');
    const [responsableName, setResponsableName] = useState('');
    const [type, setType] = useState('OF_STANDARD');
    const [siret, setSiret] = useState('');
    const [ndaNumber, setNdaNumber] = useState('');
    const [qualiopiCertified, setQualiopiCertified] = useState(false);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [siretValidation, setSiretValidation] = useState<ValidationState | null>(null);
    const [ndaValidation, setNdaValidation] = useState<ValidationState | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    // Validation SIRET en temps réel
    useEffect(() => {
        if (siret) {
            setSiretValidation(validateSiret(siret));
        } else {
            setSiretValidation(null);
        }
    }, [siret]);

    // Validation NDA en temps réel
    useEffect(() => {
        setNdaValidation(validateNda(ndaNumber));
    }, [ndaNumber]);

    // Générer les avertissements basés sur le type et les champs
    useEffect(() => {
        const newWarnings: string[] = [];

        // CFA: NDA recommandé
        if (type === 'CFA' && !ndaNumber) {
            newWarnings.push('Un Numéro de Déclaration d\'Activité (NDA) est requis pour opérer légalement.');
        }

        setWarnings(newWarnings);
    }, [type, ndaNumber]);

    // Handler SIRET (auto-format avec espaces)
    const handleSiretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 14);
        // Format: XXX XXX XXX XXXXX
        const formatted = value.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        setSiret(formatted);
    };

    // Handler NDA
    const handleNdaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 11);
        setNdaNumber(value);
    };

    // Soumission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validations
        if (!name.trim()) {
            setError('Le nom de l\'organisation est obligatoire');
            return;
        }

        if (!responsableName.trim()) {
            setError('Le nom du responsable est obligatoire');
            return;
        }

        if (!siretValidation?.isValid) {
            setError('Le SIRET est invalide');
            return;
        }

        if (ndaNumber && !ndaValidation?.isValid) {
            setError('Le NDA est invalide');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    responsableName: responsableName.trim(),
                    type,
                    siret: siret.replace(/\s/g, ''),
                    ndaNumber: ndaNumber || null,
                    qualiopiCertified,
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    address: address.trim() || null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création');
            }

            // Succès
            if (onSuccess) {
                onSuccess(data.organization);
            } else {
                router.push('/portfolio');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInputClasses = (validation: ValidationState | null) => {
        if (!validation) return 'border-gray-600 focus:border-blue-500';

        switch (validation.type) {
            case 'success':
                return 'border-emerald-500 focus:border-emerald-400 bg-emerald-500/10';
            case 'error':
                return 'border-red-500 focus:border-red-400 bg-red-500/10';
            case 'warning':
                return 'border-amber-500 focus:border-amber-400';
            default:
                return 'border-gray-600 focus:border-blue-500';
        }
    };

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Nouvelle Organisation
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Créez un nouvel organisme de formation
                </p>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nom */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Nom de l'organisation <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Centre de Formation Excellence"
                        className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        required
                    />
                </div>

                {/* Responsable */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Nom du responsable <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={responsableName}
                        onChange={(e) => setResponsableName(e.target.value)}
                        placeholder="Ex: Jean Dupont"
                        className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        required
                    />
                    <p className="mt-1 text-xs text-gray-500">Dirigeant ou responsable pédagogique</p>
                </div>

                {/* Type d'organisation */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Type d'organisation <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {ORG_TYPES.map((orgType) => (
                            <label
                                key={orgType.value}
                                className={`
                                    relative flex items-start p-3 rounded-lg border cursor-pointer transition-all
                                    ${type === orgType.value
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-gray-600 hover:border-gray-500 bg-gray-900/30'
                                    }
                                `}
                            >
                                <input
                                    type="radio"
                                    name="orgType"
                                    value={orgType.value}
                                    checked={type === orgType.value}
                                    onChange={(e) => setType(e.target.value)}
                                    className="sr-only"
                                />
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${type === orgType.value ? 'text-blue-400' : 'text-white'}`}>
                                        {orgType.label}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">{orgType.description}</p>
                                </div>
                                {type === orgType.value && (
                                    <svg className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* SIRET */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        SIRET <span className="text-red-400">*</span>
                        <span className="text-gray-500 font-normal ml-2">(14 chiffres)</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={siret}
                            onChange={handleSiretChange}
                            placeholder="123 456 789 01234"
                            className={`
                                w-full bg-gray-900/50 border rounded-lg px-4 py-2.5 text-white 
                                placeholder-gray-500 focus:outline-none focus:ring-1 
                                transition-colors font-mono tracking-wider
                                ${getInputClasses(siretValidation)}
                            `}
                        />
                        {siretValidation && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {siretValidation.type === 'success' && (
                                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {siretValidation.type === 'error' && (
                                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        )}
                    </div>
                    {siretValidation && (
                        <p className={`mt-1.5 text-sm ${siretValidation.type === 'success' ? 'text-emerald-400' :
                            siretValidation.type === 'error' ? 'text-red-400' : 'text-gray-400'
                            }`}>
                            {siretValidation.message}
                        </p>
                    )}
                </div>

                {/* NDA + Qualiopi */}
                <div className="grid grid-cols-2 gap-4">
                    {/* NDA */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            NDA
                            <span className="text-gray-500 font-normal ml-2">(11 chiffres)</span>
                        </label>
                        <input
                            type="text"
                            value={ndaNumber}
                            onChange={handleNdaChange}
                            placeholder="12345678901"
                            className={`
                                w-full bg-gray-900/50 border rounded-lg px-4 py-2.5 text-white 
                                placeholder-gray-500 focus:outline-none focus:ring-1 
                                transition-colors font-mono
                                ${getInputClasses(ndaValidation)}
                            `}
                        />
                        {ndaValidation && (
                            <p className={`mt-1 text-xs ${ndaValidation.type === 'success' ? 'text-emerald-400' :
                                ndaValidation.type === 'error' ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                {ndaValidation.message}
                            </p>
                        )}
                    </div>

                    {/* Qualiopi - OBLIGATOIRE */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Certification Qualiopi <span className="text-red-400">*</span>
                        </label>
                        <label className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                            ${qualiopiCertified
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-red-500/50 hover:border-red-500 bg-red-500/5'
                            }
                        `}>
                            <input
                                type="checkbox"
                                checked={qualiopiCertified}
                                onChange={(e) => setQualiopiCertified(e.target.checked)}
                                className="sr-only"
                            />
                            <div className={`
                                w-10 h-6 rounded-full transition-colors relative
                                ${qualiopiCertified ? 'bg-emerald-500' : 'bg-red-500/50'}
                            `}>
                                <div className={`
                                    absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                    ${qualiopiCertified ? 'translate-x-5' : 'translate-x-1'}
                                `} />
                            </div>
                            <span className={`text-sm ${qualiopiCertified ? 'text-emerald-400' : 'text-red-400'}`}>
                                {qualiopiCertified ? 'Certifié Qualiopi ✓' : 'Obligatoire'}
                            </span>
                        </label>
                        {!qualiopiCertified && (
                            <p className="mt-1.5 text-xs text-red-400">
                                La certification Qualiopi est obligatoire (Loi du 5 septembre 2018)
                            </p>
                        )}
                    </div>
                </div>

                {/* Warnings */}
                {warnings.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-amber-300 mb-1">Avertissements Conformité</p>
                                <ul className="space-y-1">
                                    {warnings.map((warning, idx) => (
                                        <li key={idx} className="text-xs text-amber-200/80 flex items-start gap-2">
                                            <span className="text-amber-400">•</span>
                                            {warning}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Contact (optionnel) */}
                <div className="border-t border-gray-700 pt-5">
                    <p className="text-sm text-gray-400 mb-4">Informations de contact (optionnel)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contact@organisme.fr"
                                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Téléphone</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="01 23 45 67 89"
                                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
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
                        disabled={isSubmitting || !siretValidation?.isValid || !qualiopiCertified}
                        className={`
                            px-6 py-2 rounded-lg font-medium transition-all
                            flex items-center gap-2
                            ${isSubmitting || !siretValidation?.isValid || !qualiopiCertified
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/25'
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
                                Créer l'organisation
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

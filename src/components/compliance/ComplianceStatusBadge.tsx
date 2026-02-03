/**
 * COMPLIANCE STATUS BADGE - Server Component
 * ===========================================
 * Indicateur visuel de conformité pour un dossier.
 * 
 * Affiche l'état de conformité en temps réel :
 * - 🟢 Vert : Conforme, prêt pour l'étape suivante
 * - 🟠 Orange : Warnings (non bloquants)
 * - 🔴 Rouge : Bloqué (règles BLOCKING violées)
 * 
 * @Compliance: Ce composant est le "témoin visuel" du moteur de règles.
 */

import { validateStateChange } from '@/lib/compliance/engine';
import { PrismaClient, PhaseStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping des statuts vers l'étape suivante
const NEXT_STATUS_MAP: Record<string, string> = {
    'BROUILLON': 'ACTIF',
    'EN_ATTENTE_VALIDATION': 'ADMIS',
    'ADMIS': 'CONTRACTUALISE',
    'ACTIF': 'EN_COURS',
    'CONTRACTUALISE': 'EN_COURS',
    'EN_COURS': 'CLOTURE',
    'TERMINE': 'CLOTURE',
    'CLOTURE': 'FACTURE',
};

interface ComplianceStatusBadgeProps {
    dossierId: string;
    /** Afficher les détails des erreurs/warnings */
    showDetails?: boolean;
    /** Taille du badge */
    size?: 'sm' | 'md' | 'lg';
}

type ComplianceStatus = 'CONFORME' | 'WARNING' | 'BLOQUE';

interface ComplianceResult {
    status: ComplianceStatus;
    errors: string[];
    warnings: string[];
    nextStatus: string;
    currentStatus: string;
}

/**
 * Évalue la conformité d'un dossier pour sa prochaine transition
 * 
 * Stratégie : On teste toujours vers CLOTURE pour identifier tous les blocages potentiels.
 * Les règles bloquantes sont déclenchées sur les transitions vers les états finaux.
 */
async function evaluateCompliance(dossierId: string): Promise<ComplianceResult> {
    // Récupérer le dossier complet avec ses relations
    const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
            contrats: true,
        },
    });

    if (!dossier) {
        return {
            status: 'BLOQUE',
            errors: ['Dossier introuvable'],
            warnings: [],
            nextStatus: 'INCONNU',
            currentStatus: 'INCONNU',
        };
    }

    const currentStatus = dossier.status;

    // Déterminer la cible de test selon le statut actuel
    // Pour une évaluation complète, on teste vers CLOTURE
    // sauf si le dossier est déjà en CLOTURE ou FACTURE
    let targetStatus = 'CLOTURE';
    if (currentStatus === 'CLOTURE') {
        targetStatus = 'FACTURE';
    } else if (currentStatus === 'EN_ATTENTE_VALIDATION' || currentStatus === 'ADMIS') {
        // Pour les dossiers en phase contractualisation, tester vers EN_COURS
        targetStatus = 'EN_COURS';
    }

    // Valider la transition vers l'état cible
    const result = await validateStateChange(dossierId, targetStatus);

    let status: ComplianceStatus = 'CONFORME';
    if (result.errors.length > 0) {
        status = 'BLOQUE';
    } else if (result.warnings.length > 0) {
        status = 'WARNING';
    }

    return {
        status,
        errors: result.errors,
        warnings: result.warnings,
        nextStatus: targetStatus,
        currentStatus,
    };
}

/**
 * Composant Badge de Conformité (Server Component)
 */
export default async function ComplianceStatusBadge({
    dossierId,
    showDetails = true,
    size = 'md',
}: ComplianceStatusBadgeProps) {
    const compliance = await evaluateCompliance(dossierId);

    // Classes Tailwind selon la taille
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-2 text-base',
    };

    // Classes selon le statut
    const statusClasses = {
        CONFORME: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        WARNING: 'bg-amber-100 text-amber-800 border-amber-300',
        BLOQUE: 'bg-red-100 text-red-800 border-red-300',
    };

    // Icônes selon le statut
    const statusIcons = {
        CONFORME: (
            <svg className="w-4 h-4 mr-1.5 shrink-0" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
        ),
        WARNING: (
            <svg className="w-4 h-4 mr-1.5 shrink-0" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        BLOQUE: (
            <svg className="w-4 h-4 mr-1.5 shrink-0" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
        ),
    };

    // Labels selon le statut
    const statusLabels = {
        CONFORME: `Conforme - Prêt pour ${compliance.nextStatus}`,
        WARNING: 'Attention - Vérifications recommandées',
        BLOQUE: 'Bloqué - Action requise',
    };

    return (
        <div className="inline-block">
            {/* Badge Principal */}
            <div className="group relative">
                <span
                    className={`
            inline-flex items-center font-medium rounded-full border
            ${sizeClasses[size]}
            ${statusClasses[compliance.status]}
            transition-all duration-200 hover:shadow-md
          `}
                >
                    {statusIcons[compliance.status]}
                    {statusLabels[compliance.status]}
                </span>

                {/* Tooltip avec détails */}
                {showDetails && (compliance.errors.length > 0 || compliance.warnings.length > 0) && (
                    <div className="
            absolute z-50 invisible group-hover:visible
            opacity-0 group-hover:opacity-100
            transition-all duration-200
            bottom-full left-1/2 -translate-x-1/2 mb-2
            w-80 max-w-sm
          ">
                        <div className="bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4">
                            {/* Flèche */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                                <div className="border-8 border-transparent border-t-gray-900" />
                            </div>

                            {/* Statut actuel */}
                            <div className="mb-3 pb-2 border-b border-gray-700">
                                <span className="text-gray-400 text-xs uppercase tracking-wider">
                                    Transition
                                </span>
                                <div className="flex items-center mt-1">
                                    <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">
                                        {compliance.currentStatus}
                                    </span>
                                    <svg className="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                    <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">
                                        {compliance.nextStatus}
                                    </span>
                                </div>
                            </div>

                            {/* Erreurs (Bloquantes) */}
                            {compliance.errors.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center text-red-400 mb-1">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span className="font-semibold text-xs uppercase">
                                            Règles Bloquantes ({compliance.errors.length})
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {compliance.errors.map((error, idx) => (
                                            <li key={idx} className="text-xs text-gray-300 pl-5 relative">
                                                <span className="absolute left-0 text-red-400">•</span>
                                                {error.replace('[Conformité] ', '')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Warnings */}
                            {compliance.warnings.length > 0 && (
                                <div>
                                    <div className="flex items-center text-amber-400 mb-1">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="font-semibold text-xs uppercase">
                                            Avertissements ({compliance.warnings.length})
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {compliance.warnings.map((warning, idx) => (
                                            <li key={idx} className="text-xs text-gray-300 pl-5 relative">
                                                <span className="absolute left-0 text-amber-400">•</span>
                                                {warning.replace('[Conformité] ', '')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

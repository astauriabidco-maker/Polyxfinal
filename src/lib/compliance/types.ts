/**
 * Types pour le Compliance Engine
 */

// Résultat d'évaluation
export interface ValidationResult {
    success: boolean;
    errors: string[];
    warnings: string[];
}

// Contexte enrichi pour évaluation des règles
export interface EvalContext {
    // Champs Dossier
    id: string;
    status: string;
    tauxAssiduite: number;
    testPositionnementComplete: boolean;
    declarationPSH: boolean | null;
    certificatGenere: boolean;

    // Gates calculées
    hasContratSigne: boolean;
    financeurAccord: boolean;
    hasPrerequis: boolean;
    retractationRespectee: boolean;

    // Relations aplaties
    financeur?: {
        type: string;
    };
    contrat?: {
        isSigned: boolean;
        accordFinancementRecu: boolean;
    };
    certification?: {
        statut: string;
    };

    // Accès dynamique
    [key: string]: unknown;
}

// Mapping des statuts aux phases CdCF
export const STATUS_TO_PHASE: Record<string, number> = {
    'BROUILLON': 1,
    'EN_ATTENTE_VALIDATION': 2,
    'ADMIS': 2,
    'ACTIF': 3,
    'CONTRACTUALISE': 3,
    'EN_COURS': 4,
    'SUSPENDU': 4,
    'ABANDONNE': 4,
    'TERMINE': 5,
    'CLOTURE': 5,
    'FACTURE': 5,
};

// Statuts valides pour DossierStatus (enum Prisma)
export const DOSSIER_STATUSES = [
    'PROSPECT',
    'ADMIS',
    'CONTRACTUALISE',
    'EN_COURS',
    'ABANDON',
    'TERMINE',
    'CLOTURE',
] as const;

export type DossierStatusType = typeof DOSSIER_STATUSES[number];

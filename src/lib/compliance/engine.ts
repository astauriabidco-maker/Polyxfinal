/**
 * COMPLIANCE ENGINE - ERP FORMATION
 * ==================================
 * Service TypeScript pur, découplé de l'UI.
 * Charge les règles depuis docs/compliance_rules.json
 * et valide les transitions d'état des dossiers.
 * 
 * @Compliance: Ce service est le "gardien" des règles Qualiopi.
 * Aucune transition ne peut contourner ce moteur.
 * 
 * IMPORTANT: Évaluateur "No-Code" basé sur opérateurs.
 * Aucun eval() ou Function() - 100% type-safe.
 */

import { PrismaClient } from '@prisma/client';
import { validateRulesFile, type ComplianceRule, type Logic } from './schemas';
import rulesData from '../../../docs/compliance_rules.json';

// Validation du fichier JSON au runtime (Zod)
const parsedRules = validateRulesFile(rulesData);

console.log(`[Compliance Engine] Loaded ${parsedRules.rules.length} rules`);

// Types pour les résultats
export interface ValidationResult {
    success: boolean;
    errors: string[];
    warnings: string[];
}

// Instance Prisma injectable (pour les tests)
let prismaInstance: PrismaClient | null = null;

/**
 * Configure l'instance Prisma (pour injection de dépendance)
 */
export function setPrismaInstance(instance: PrismaClient): void {
    prismaInstance = instance;
}

/**
 * Récupère l'instance Prisma
 */
function getPrisma(): PrismaClient {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient();
    }
    return prismaInstance;
}

/**
 * MOTEUR D'ÉVALUATION SÉCURISÉ
 * Vérifie si une condition de REJET est remplie pour un dossier donné.
 * 
 * @param dossier - Le dossier avec ses relations
 * @param logic - La logique de la règle (field/operator/value)
 * @returns true si la condition de VIOLATION est remplie
 */
function evaluateCondition(dossier: Record<string, unknown>, logic: Logic): boolean {
    const { field, operator, value, additionalCheck } = logic;

    // Récupération de la valeur (supporte notation pointée: "financeur.type")
    let actualValue: unknown = dossier;
    const fieldParts = field.split('.');

    for (const part of fieldParts) {
        if (actualValue === null || actualValue === undefined) {
            actualValue = null;
            break;
        }

        // Cas spécial: accès aux tableaux (prendre le premier élément)
        if (Array.isArray(actualValue)) {
            if (actualValue.length === 0) {
                actualValue = null;
                break;
            }
            actualValue = (actualValue[0] as Record<string, unknown>)[part];
        } else {
            actualValue = (actualValue as Record<string, unknown>)[part];
        }
    }

    // Évaluation basée sur l'opérateur
    let isViolation = false;

    switch (operator) {
        case 'EQUALS':
            isViolation = actualValue === value;
            break;
        case 'NOT_EQUALS':
            isViolation = actualValue !== value;
            break;
        case 'LT':
            isViolation = typeof actualValue === 'number' && actualValue < (value as number);
            break;
        case 'GT':
            isViolation = typeof actualValue === 'number' && actualValue > (value as number);
            break;
        case 'GTE':
            isViolation = typeof actualValue === 'number' && actualValue >= (value as number);
            break;
        case 'LTE':
            isViolation = typeof actualValue === 'number' && actualValue <= (value as number);
            break;
        case 'IS_TRUE':
            isViolation = actualValue === true;
            break;
        case 'IS_FALSE':
            isViolation = actualValue === false;
            break;
        case 'CONTAINS':
            isViolation = typeof actualValue === 'string' && actualValue.includes(value as string);
            break;
        case 'NOT_CONTAINS':
            isViolation = typeof actualValue === 'string' && !actualValue.includes(value as string);
            break;
        default:
            console.warn(`[Compliance Engine] Unknown operator: ${operator}`);
            isViolation = false;
    }

    // Check additionnel (ET logique)
    if (isViolation && additionalCheck) {
        isViolation = isViolation && evaluateCondition(dossier, additionalCheck);
    }

    return isViolation;
}

/**
 * FONCTION PRINCIPALE : VALIDATE STATE CHANGE (Multi-Tenant)
 * 
 * @param dossierId - ID du dossier à valider
 * @param targetStatus - Statut cible (ex: "EN_COURS", "CLOTURE")
 * @param userId - ID de l'utilisateur tentant l'action (pour audit)
 * @returns ValidationResult avec succès/erreurs
 */
export async function validateStateChange(
    dossierId: string,
    targetStatus: string,
    userId?: string
): Promise<ValidationResult> {
    const prisma = getPrisma();

    // 1. Récupération du Contexte Complet (Dossier + toutes relations + Organisation)
    const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
            organization: true, // TENANT CONTEXT
            company: true,      // Pour règle CFA
            session: {
                include: {
                    programme: {
                        include: {
                            certification: true,
                        },
                    },
                },
            },
            contrats: {
                include: {
                    financeur: true,
                },
            },
            preuves: true,
            emargements: true,
        },
    });

    if (!dossier) {
        throw new Error(`Dossier introuvable: ${dossierId}`);
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const org = dossier.organization;

    // ==========================================================================
    // RÈGLES TENANT-CONTEXTUELLES (Exécutées AVANT les règles JSON)
    // ==========================================================================

    // RÈGLE 1: NDA OBLIGATOIRE POUR FACTURATION
    // Si l'organisation n'a pas de NDA, interdire toute transition vers FACTURE/CLOTURE
    if (['FACTURE', 'CLOTURE', 'TERMINE'].includes(targetStatus)) {
        if (!org.ndaNumber) {
            const message = `[Réglementaire] Organisation "${org.name}" n'a pas de Numéro de Déclaration d'Activité (NDA). Impossible de facturer sans NDA.`;
            errors.push(message);

            await prisma.complianceAlert.create({
                data: {
                    dossierId: dossier.id,
                    ruleId: 'RULE_NDA_REQUIRED',
                    severity: 'BLOCKING',
                    context: 'TENANT_COMPLIANCE',
                    trigger: `TO_${targetStatus}`,
                    message,
                    details: {
                        organizationId: org.id,
                        organizationName: org.name,
                        missingField: 'ndaNumber'
                    },
                    isResolved: false,
                },
            });

            console.warn(`[BLOCAGE NDA] ${dossier.id} -> ${message}`);
        }
    }

    // RÈGLE 2: QUALIOPI OBLIGATOIRE POUR FINANCEMENT PUBLIC (CPF, OPCO)
    // Si le dossier utilise un financeur CPF ou OPCO, vérifier que l'org a Qualiopi
    const publicFundingTypes = ['CPF', 'OPCO'];
    const financeur = dossier.contrats[0]?.financeur;

    if (financeur && publicFundingTypes.includes(financeur.type)) {
        if (!org.qualiopiCertified) {
            const message = `[Réglementaire] Financement ${financeur.type} interdit sans certification Qualiopi. L'organisation "${org.name}" n'est pas certifiée.`;
            errors.push(message);

            await prisma.complianceAlert.create({
                data: {
                    dossierId: dossier.id,
                    ruleId: 'RULE_QUALIOPI_REQUIRED',
                    severity: 'BLOCKING',
                    context: 'TENANT_COMPLIANCE',
                    trigger: `TO_${targetStatus}`,
                    message,
                    details: {
                        organizationId: org.id,
                        qualiopiCertified: org.qualiopiCertified,
                        financeurType: financeur.type
                    },
                    isResolved: false,
                },
            });

            console.warn(`[BLOCAGE QUALIOPI] ${dossier.id} -> ${message}`);
        }
    }

    // RÈGLE 3: CFA REQUIERT EMPLOYEUR + TUTEUR
    // Si org type = CFA, le dossier doit avoir un employeur (companyId) et un tuteur (tutorName)
    if (org.type === 'CFA' && ['ADMIS', 'CONTRACTUALISE', 'EN_COURS', 'ACTIF'].includes(targetStatus)) {
        if (!dossier.companyId || !dossier.tutorName) {
            const missing = [];
            if (!dossier.companyId) missing.push('entreprise employeur');
            if (!dossier.tutorName) missing.push('maître d\'apprentissage');

            const message = `[CFA] Un dossier en alternance doit obligatoirement avoir: ${missing.join(' et ')}. Informations manquantes.`;
            errors.push(message);

            await prisma.complianceAlert.create({
                data: {
                    dossierId: dossier.id,
                    ruleId: 'RULE_CFA_TUTOR_REQUIRED',
                    severity: 'BLOCKING',
                    context: 'TENANT_COMPLIANCE',
                    trigger: `TO_${targetStatus}`,
                    message,
                    details: {
                        organizationType: org.type,
                        hasCompany: !!dossier.companyId,
                        hasTutor: !!dossier.tutorName,
                        missing
                    },
                    isResolved: false,
                },
            });

            console.warn(`[BLOCAGE CFA] ${dossier.id} -> ${message}`);
        }
    }

    // ==========================================================================
    // RÈGLES JSON (Compliance Engine standard)
    // ==========================================================================

    // 2. Préparer l'objet d'évaluation avec accès facilité aux relations
    const evalContext: Record<string, unknown> = {
        ...dossier,
        // Aplatir les relations pour accès simplifié
        financeur: dossier.contrats[0]?.financeur,
        contrat: dossier.contrats[0],
        certification: dossier.session.programme.certification,
        programme: dossier.session.programme,
        // Champs calculés / gates
        hasContratSigne: dossier.contrats.some(c => c.isSigned),
        financeurAccord: dossier.contrats.some(c => c.accordFinancementRecu),
        hasPrerequis: dossier.testPositionnementComplete && dossier.declarationPSH !== null,
        retractationRespectee: dossier.contrats.some(c => c.retractationRespectee),
        // Conversion Decimal -> number pour comparaison
        tauxAssiduite: Number(dossier.tauxAssiduite),
        // Preuves et justificatifs
        hasJustificatifAbsence: dossier.preuves.some(p => p.type === 'JUSTIFICATIF_ABSENCE'),
        nbPreuvesJustificatif: dossier.preuves.filter(p => p.type === 'JUSTIFICATIF_ABSENCE').length,
        nbPreuves: dossier.preuves.length,

        // ======================================================
        // CHAMPS SPÉCIFIQUES CFA (Apprentissage)
        // ======================================================
        isCFA: org.type === 'CFA',
        hasCompany: !!dossier.companyId,
        hasTutor: !!dossier.tutorName,
        // Contrat d'apprentissage enregistré (via preuve ou flag)
        contratApprentissageEnregistre: dossier.preuves.some(p =>
            p.type === 'CONTRAT_SIGNE' && org.type === 'CFA'
        ) && dossier.contrats.some(c => c.accordFinancementRecu),
        // Certification RNCP (commence par RNCP, pas RS)
        hasCertificationRNCP: dossier.session.programme.certification?.code?.startsWith('RNCP') ?? false,
        // Durée de formation annuelle (heures du programme)
        dureeFormationAnnuelle: dossier.session.programme.dureeHeures,
        // Âge apprenti (à calculer si date de naissance disponible - placeholder)
        ageApprenti: null, // TODO: Calculer depuis stagiaireNaissance si disponible
    };

    // 3. Filtrage des règles applicables à cette transition
    const triggerEvent = `TO_${targetStatus}`;
    const applicableRules = parsedRules.rules.filter(r => r.trigger === triggerEvent);

    // 4. Exécution des règles
    for (const rule of applicableRules) {
        const isViolation = evaluateCondition(evalContext, rule.logic);

        if (isViolation) {
            const message = `[Conformité] ${rule.message} (Règle: ${rule.id})`;

            if (rule.severity === 'BLOCKING') {
                errors.push(message);

                // Persistance de l'Alerte en BDD
                await prisma.complianceAlert.create({
                    data: {
                        dossierId: dossier.id,
                        ruleId: rule.id,
                        severity: rule.severity,
                        context: 'STATE_CHANGE',
                        trigger: triggerEvent,
                        message: rule.message,
                        details: { targetStatus, field: rule.logic.field },
                        isResolved: false,
                    },
                });

                console.warn(`[BLOCAGE COMPLIANCE] ${dossier.id} -> ${message}`);
            } else {
                warnings.push(message);
                console.info(`[WARNING COMPLIANCE] ${dossier.id} -> ${message}`);
            }
        }
    }

    // 5. Log d'audit si userId fourni
    if (userId && (errors.length > 0 || warnings.length > 0)) {
        await prisma.auditLog.create({
            data: {
                organizationId: org.id, // TENANT CONTEXT
                userId,
                userRole: 'RESP_ADMIN', // À récupérer du contexte auth réel
                action: `VALIDATE_TRANSITION_${targetStatus}`,
                niveauAction: errors.length > 0 ? 'VALIDATION' : 'LECTURE',
                entityType: 'Dossier',
                entityId: dossierId,
                phase: getPhaseFromStatus(targetStatus),
                isForced: false,
                previousState: { status: dossier.status },
                newState: { targetStatus, blocked: errors.length > 0 },
            },
        });
    }

    // 6. Verdict
    return {
        success: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Résout une alerte de conformité (après validation manuelle)
 */
export async function resolveAlert(
    alertId: string,
    resolvedById: string,
    resolution: string
): Promise<void> {
    const prisma = getPrisma();

    await prisma.complianceAlert.update({
        where: { id: alertId },
        data: {
            isResolved: true,
            resolvedById,
            resolvedAt: new Date(),
            resolution,
        },
    });

    console.log(`[Compliance Engine] Alert ${alertId} resolved by ${resolvedById}`);
}

/**
 * Récupère toutes les alertes non résolues pour un dossier
 */
export async function getUnresolvedAlerts(dossierId: string) {
    const prisma = getPrisma();

    return prisma.complianceAlert.findMany({
        where: {
            dossierId,
            isResolved: false,
        },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Récupère les règles applicables pour un trigger donné
 */
export function getRulesForTrigger(trigger: string): ComplianceRule[] {
    return parsedRules.rules.filter(r => r.trigger === trigger);
}

/**
 * Recharge les règles (utile en développement)
 */
export function reloadRules(): void {
    // Note: Nécessite un redémarrage du serveur en production
    console.log('[Compliance Engine] Rules reload requested (requires server restart)');
}

/**
 * VALIDATION CRÉATION SITE CFA
 * Vérifie que les sites CFA ont un code UAI valide
 */
export async function validateSiteCreation(
    organizationId: string,
    siteData: { name: string; uaiCode?: string | null }
): Promise<ValidationResult> {
    const prisma = getPrisma();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Récupérer l'organisation
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
    });

    if (!org) {
        errors.push('Organisation introuvable');
        return { success: false, errors, warnings };
    }

    // RÈGLE CFA: Code UAI obligatoire
    if (org.type === 'CFA') {
        if (!siteData.uaiCode) {
            const message = `[CFA] Le site "${siteData.name}" doit avoir un code UAI (Unité Administrative Immatriculée).`;
            errors.push(message);
        } else if (!/^[0-9]{7}[A-Z]$/.test(siteData.uaiCode)) {
            // Validation format UAI: 7 chiffres + 1 lettre majuscule
            const message = `[CFA] Le code UAI "${siteData.uaiCode}" est invalide. Format attendu: 7 chiffres + 1 lettre (ex: 0751234A).`;
            errors.push(message);
        }
    }

    return {
        success: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * VALIDATION CRÉATION ORGANIZATION
 * Vérifie les prérequis réglementaires selon le type
 */
export async function validateOrganizationCreation(
    orgData: {
        type: string;
        siret: string;
        ndaNumber?: string | null;
        qualiopiCertified?: boolean;
    }
): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation SIRET (14 chiffres)
    if (!/^[0-9]{14}$/.test(orgData.siret)) {
        errors.push('SIRET invalide. Format attendu: 14 chiffres.');
    }

    // Validation NDA si fourni (11 chiffres)
    if (orgData.ndaNumber && !/^[0-9]{11}$/.test(orgData.ndaNumber.replace(/\s/g, ''))) {
        warnings.push('Numéro de Déclaration d\'Activité (NDA) au format non standard.');
    }

    // =================================================================
    // RÈGLE BLOQUANTE: Qualiopi obligatoire pour TOUS les types
    // Conformément à la Loi du 5 septembre 2018 "Liberté de choisir 
    // son avenir professionnel", tout organisme de formation doit être
    // certifié Qualiopi pour bénéficier de financements publics.
    // =================================================================
    if (!orgData.qualiopiCertified) {
        errors.push('[Qualiopi] La certification Qualiopi est obligatoire pour créer un organisme de formation.');
    }

    // CFA spécifique: NDA recommandé
    if (orgData.type === 'CFA') {
        if (!orgData.ndaNumber) {
            warnings.push('[CFA] Un numéro de Déclaration d\'Activité (NDA) est requis pour opérer légalement.');
        }
    }

    return {
        success: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Détermine la phase CdCF à partir du statut
 */
function getPhaseFromStatus(status: string): number {
    const mapping: Record<string, number> = {
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

    return mapping[status] || 1;
}

// Export par défaut
export default {
    validateStateChange,
    resolveAlert,
    getUnresolvedAlerts,
    getRulesForTrigger,
    reloadRules,
    setPrismaInstance,
};

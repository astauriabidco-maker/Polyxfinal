/**
 * Barrel export pour le module Compliance
 */

// Export du moteur principal
export {
    validateStateChange,
    resolveAlert,
    getUnresolvedAlerts,
    getRulesForTrigger,
    reloadRules,
    validateSiteCreation,
    validateOrganizationCreation,
} from './engine';

// Export des schémas Zod
export {
    validateRulesFile,
    ComplianceRuleSchema,
    ComplianceRulesFileSchema,
    LogicSchema,
    OperatorSchema,
    SeveritySchema,
} from './schemas';

// Export des types
export type {
    ComplianceRule,
    ComplianceRulesFile,
    Logic,
    Operator,
    Severity,
} from './schemas';

export type {
    EvalContext,
    DossierStatusType,
} from './types';

export { STATUS_TO_PHASE, DOSSIER_STATUSES } from './types';

// Type ValidationResult exporté depuis engine
export type { ValidationResult } from './engine';

// ── Services de reporting conformité ──────────────────────────

// BPF (Bilan Pédagogique et Financier)
export { generateBPF, generateBPFTextExport } from './bpf';

// DRIEETS (Rapport annuel)
export { generateDRIEETSReport, generateDRIEETSTextExport } from './drieets-report';

// OPCO (Export dossiers de financement)
export { listOPCOContrats, generateOPCOExport, generateOPCOTextExport } from './opco-export';

// CPF / CDC (Conformité CPF)
export {
    checkCPFEligibilite,
    checkRetractation,
    generateEDOFDeclaration,
    generateCPFRecapitulatif,
    generateCPFTextExport,
} from './cpf-export';

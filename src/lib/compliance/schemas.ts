/**
 * Schéma Zod pour validation des règles compliance_rules.json
 * Format "No-Code" avec opérateurs typés
 * 
 * @Compliance: Ce schéma garantit la structure des règles
 */

import { z } from 'zod';

// Opérateurs disponibles pour l'évaluation
export const OperatorSchema = z.enum([
    'EQUALS',
    'NOT_EQUALS',
    'LT',        // Less Than
    'GT',        // Greater Than
    'GTE',       // Greater Than or Equal
    'LTE',       // Less Than or Equal
    'IS_TRUE',
    'IS_FALSE',
    'CONTAINS',
    'NOT_CONTAINS'
]);
export type Operator = z.infer<typeof OperatorSchema>;

// Sévérité des règles
export const SeveritySchema = z.enum(['BLOCKING', 'WARNING']);
export type Severity = z.infer<typeof SeveritySchema>;

// Type pour la logique (défini avant le schéma récursif)
export interface Logic {
    field: string;
    operator: Operator;
    value?: unknown;
    additionalCheck?: Logic;
}

// Logique de la règle (format opérateur) - sans récursion lazy
export const LogicSchema: z.ZodType<Logic> = z.object({
    field: z.string(),           // ex: "tauxAssiduite" ou "financeur.type"
    operator: OperatorSchema,    // ex: "LT", "EQUALS"
    value: z.any().optional(),   // Valeur de comparaison (optionnel pour IS_TRUE/IS_FALSE)
    additionalCheck: z.lazy(() => LogicSchema).optional(), // Check additionnel (AND implicite)
});

// Règle de conformité individuelle
export const ComplianceRuleSchema = z.object({
    id: z.string(),              // Ex: "RULE_CPF_RETRACTATION"
    description: z.string(),     // Description humaine
    trigger: z.string(),         // Ex: "TO_EN_COURS", "TO_CLOTURE"
    severity: SeveritySchema,    // BLOCKING ou WARNING
    message: z.string(),         // Message affiché si violation
    logic: LogicSchema,          // Condition de REJET (si vraie = blocage)
});
export type ComplianceRule = z.infer<typeof ComplianceRuleSchema>;

// Fichier complet compliance_rules.json
export const ComplianceRulesFileSchema = z.object({
    rules: z.array(ComplianceRuleSchema),
});
export type ComplianceRulesFile = z.infer<typeof ComplianceRulesFileSchema>;

/**
 * Valide la structure du fichier de règles
 * @throws ZodError si la structure est invalide
 */
export function validateRulesFile(data: unknown): ComplianceRulesFile {
    return ComplianceRulesFileSchema.parse(data);
}

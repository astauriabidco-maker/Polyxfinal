/**
 * VALIDATION SCHEMAS — Schémas Zod centralisés
 * ==============================================
 * Source unique pour la validation de toutes les mutations API.
 */

import { z } from 'zod';

// ─── Organizations ───────────────────────────────────────────

export const organizationPatchSchema = z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(200).optional(),
    responsableName: z.string().max(200).optional(),
    ndaNumber: z.string().max(50).optional().nullable(),
    qualiopiCertified: z.boolean().optional(),
    qualiopiExpiry: z.string().datetime().optional().nullable(),
    logoUrl: z.string().url('URL invalide').optional().nullable(),
    signatureUrl: z.string().url('URL invalide').optional().nullable(),
    cachetUrl: z.string().url('URL invalide').optional().nullable(),
    cgvUrl: z.string().url('URL invalide').optional().nullable(),
    livretAccueilUrl: z.string().url('URL invalide').optional().nullable(),
    reglementInterieurUrl: z.string().url('URL invalide').optional().nullable(),
}).strict();

// ─── Sites ───────────────────────────────────────────────────

export const siteCreateSchema = z.object({
    name: z.string().min(1, 'Le nom du site est requis').max(200),
    city: z.string().min(1, 'La ville est requise').max(100),
    zipCode: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres'),
    address: z.string().max(500).optional().nullable(),
    uaiCode: z.string()
        .regex(/^[0-9]{7}[A-Z]$/, 'Le code UAI doit contenir 7 chiffres suivis d\'une lettre majuscule')
        .optional()
        .nullable()
        .transform(v => v?.toUpperCase() ?? null),
    siretNic: z.string()
        .regex(/^\d{5}$/, 'Le NIC SIRET doit contenir 5 chiffres')
        .optional()
        .nullable(),
    isHeadquarters: z.boolean().default(false),
});

export const sitePatchSchema = siteCreateSchema.partial();

// ─── Users ───────────────────────────────────────────────────

export const userCreateSchema = z.object({
    email: z.string().email('Email invalide'),
    nom: z.string().min(1, 'Le nom est requis').max(100),
    prenom: z.string().min(1, 'Le prénom est requis').max(100),
    telephone: z.string().max(20).optional().nullable(),
    role: z.string().min(1, 'Le rôle est requis').max(50).default('FORMAT'),
    siteIds: z.array(z.string()).default([]),
    scope: z.enum(['GLOBAL', 'RESTRICTED']).default('RESTRICTED'),
    organizationId: z.string().min(1, 'L\'ID organisation est requis'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
});

// ─── Roles ───────────────────────────────────────────────────

export const roleCreateSchema = z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
    code: z.string()
        .regex(
            /^[A-Z][A-Z0-9_]{1,30}$/,
            'Le code doit être en majuscules, commencer par une lettre, et ne contenir que des lettres, chiffres et underscores (2-31 caractères).'
        ),
    description: z.string().max(500).optional().nullable(),
});

export const roleUpdateSchema = z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
    description: z.string().max(500).optional().nullable(),
});

export const rolePermissionsSchema = z.object({
    permissionIds: z.array(z.string().cuid('ID de permission invalide')),
});

// ─── Network / Franchise ─────────────────────────────────────

export const onboardFranchiseeSchema = z.object({
    adminPassword: z.string().min(8, 'Mot de passe min 8 caractères'),
    siret: z.string().length(14, 'SIRET doit contenir 14 caractères'),
    city: z.string().min(1, 'Ville requise'),
    zipCode: z.string().min(4, 'Code postal requis'),
    address: z.string().optional(),
});

export const createCandidateApiSchema = z.object({
    organizationId: z.string().min(1),
    companyName: z.string().min(2, 'Raison sociale requise'),
    email: z.string().email('Email invalide'),
    phone: z.string().optional(),
    representantNom: z.string().min(1, 'Nom requis'),
    representantPrenom: z.string().min(1, 'Prénom requis'),
    franchiseType: z.enum(['OF', 'CFA']).default('OF'),
    targetZone: z.string().optional(),
    targetZipCodes: z.array(z.string()).default([]),
    investmentBudget: z.number().positive().optional(),
    notes: z.string().optional(),
});

export const dispatchLeadSchema = z.object({
    dossierId: z.string().min(1, 'dossierId requis'),
    studentZipCode: z.string().min(4, 'Code postal requis'),
});

export const createTerritorySchema = z.object({
    organizationId: z.string().min(1),
    name: z.string().min(2, 'Nom requis'),
    zipCodes: z.array(z.string().min(4)).min(1, 'Au moins un code postal requis'),
    isExclusive: z.boolean().default(true),
});

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Parse un body avec un schéma Zod et retourne le résultat typé
 * ou une réponse d'erreur 400 formatée.
 */
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown):
    | { success: true; data: T }
    | { success: false; error: string; errors: string[] } {
    const result = schema.safeParse(body);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return {
        success: false,
        error: errors[0],
        errors,
    };
}


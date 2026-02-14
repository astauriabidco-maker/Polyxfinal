/**
 * NDA RULES — Règles de rattachement organisationnel
 * =====================================================
 * Les franchisés ET les agences intégrées (succursales) n'ont pas de NDA.
 * Les dossiers doivent toujours être rattachés à l'OF déclarant
 * (celui qui porte le NDA = HEAD_OFFICE ou OF_STANDARD parent).
 *
 * Règles :
 *   - Si l'org du site est FRANCHISE ou SUCCURSALE → remonter au parent
 *   - Si l'org est HEAD_OFFICE ou sans networkType (OF autonome) → elle porte le NDA
 */

import { prisma } from '@/lib/prisma';

// Types qui ne portent PAS le NDA et doivent remonter au parent
const NETWORK_TYPES_WITHOUT_NDA = ['FRANCHISE', 'SUCCURSALE'] as const;

/**
 * Résout l'organisation porteuse du NDA pour un site donné.
 *
 * @param siteId  ID du site (agence) qui crée le dossier
 * @returns       ID de l'organisation qui porte le NDA
 * @throws        Si le site n'existe pas ou si aucun org avec NDA n'est trouvée
 *
 * Exemples :
 *   Site d'un OF_STANDARD (pas de networkType)  → retourne cet OF_STANDARD
 *   Site d'un HEAD_OFFICE                       → retourne ce HEAD_OFFICE
 *   Site d'une FRANCHISE                        → retourne le parent (HEAD_OFFICE)
 *   Site d'une SUCCURSALE (agence intégrée)     → retourne le parent (HEAD_OFFICE)
 */
export async function resolveNdaOrganization(siteId: string): Promise<{
    organizationId: string;
    organizationName: string;
    ndaNumber: string | null;
    isResolved: boolean; // true si on a remonté au parent
    originalOrgId: string; // org directe du site (même si résolue)
    originalOrgName: string;
}> {
    const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    ndaNumber: true,
                    networkType: true,
                    parentId: true,
                },
            },
        },
    });

    if (!site) {
        throw new Error(`Site introuvable: ${siteId}`);
    }

    const org = site.organization;

    // Si l'organisation n'est NI franchise NI succursale → elle porte elle-même le NDA
    const needsResolution = org.networkType !== null
        && NETWORK_TYPES_WITHOUT_NDA.includes(org.networkType as any);

    if (!needsResolution) {
        return {
            organizationId: org.id,
            organizationName: org.name,
            ndaNumber: org.ndaNumber,
            isResolved: false,
            originalOrgId: org.id,
            originalOrgName: org.name,
        };
    }

    // C'est une FRANCHISE ou SUCCURSALE → remonter au parent
    if (!org.parentId) {
        throw new Error(
            `L'organisation "${org.name}" est de type ${org.networkType} mais n'a pas de parent. ` +
            `Impossible de déterminer l'OF déclarant.`
        );
    }

    const parentOrg = await prisma.organization.findUnique({
        where: { id: org.parentId },
        select: {
            id: true,
            name: true,
            ndaNumber: true,
            networkType: true,
        },
    });

    if (!parentOrg) {
        throw new Error(
            `Parent introuvable pour l'organisation "${org.name}" (parentId: ${org.parentId})`
        );
    }

    return {
        organizationId: parentOrg.id,
        organizationName: parentOrg.name,
        ndaNumber: parentOrg.ndaNumber,
        isResolved: true,
        originalOrgId: org.id,
        originalOrgName: org.name,
    };
}

// ─── Création de dossier avec résolution NDA ─────────────────

interface CreateDossierInput {
    siteId: string;
    sessionId: string;
    stagiaireNom: string;
    stagiairePrenom: string;
    stagiaireEmail: string;
    stagiaireTelephone?: string;
    stagiaireAdresse?: string;
    stagiaireCp?: string;
    companyId?: string;
    createdById: string;
}

/**
 * Crée un dossier en résolvant automatiquement l'OF déclarant.
 *
 * - Le `siteId` identifie l'agence qui gère le dossier
 * - L'`organizationId` est résolu automatiquement :
 *     → Si le site est franchise/succursale → parent (HEAD_OFFICE)
 *     → Sinon → org directe du site
 *
 * Utilisation :
 *   const result = await createDossierWithNda({ siteId, sessionId, ... });
 *   // result.dossier.organizationId = OF avec NDA
 *   // result.dossier.siteId = agence locale
 */
export async function createDossierWithNda(input: CreateDossierInput) {
    // 1. Résoudre l'org avec NDA
    const ndaResolution = await resolveNdaOrganization(input.siteId);

    if (ndaResolution.isResolved) {
        console.log(
            `[NDA] Dossier rattaché à "${ndaResolution.organizationName}" (NDA: ${ndaResolution.ndaNumber}) ` +
            `au lieu de "${ndaResolution.originalOrgName}" (${ndaResolution.isResolved ? 'résolu' : 'direct'})`
        );
    }

    // 2. Créer le dossier sous l'org NDA
    const dossier = await prisma.dossier.create({
        data: {
            organizationId: ndaResolution.organizationId, // ← OF avec NDA
            siteId: input.siteId, // ← Agence locale (peut être franchise/succursale)
            sessionId: input.sessionId,
            stagiaireNom: input.stagiaireNom,
            stagiairePrenom: input.stagiairePrenom,
            stagiaireEmail: input.stagiaireEmail,
            stagiaireTelephone: input.stagiaireTelephone,
            stagiaireAdresse: input.stagiaireAdresse,
            stagiaireCp: input.stagiaireCp,
            companyId: input.companyId,
            createdById: input.createdById,
        },
    });

    return {
        dossier,
        ndaResolution,
    };
}

// ─── Validation NDA ──────────────────────────────────────────

/**
 * Valide qu'un dossier est bien rattaché à une organisation avec NDA.
 * Utile pour les contrôles de conformité.
 */
export async function validateDossierNda(dossierId: string): Promise<{
    valid: boolean;
    organizationId: string;
    ndaNumber: string | null;
    message: string;
}> {
    const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    ndaNumber: true,
                    networkType: true,
                },
            },
        },
    });

    if (!dossier) {
        return {
            valid: false,
            organizationId: '',
            ndaNumber: null,
            message: `Dossier introuvable: ${dossierId}`,
        };
    }

    const org = dossier.organization;

    // Un dossier ne devrait JAMAIS être rattaché à une FRANCHISE ou SUCCURSALE
    if (org.networkType && NETWORK_TYPES_WITHOUT_NDA.includes(org.networkType as any)) {
        return {
            valid: false,
            organizationId: org.id,
            ndaNumber: null,
            message: `⚠️ Le dossier est rattaché à "${org.name}" (${org.networkType}) qui ne porte pas de NDA. Il devrait être rattaché à l'OF parent.`,
        };
    }

    if (!org.ndaNumber) {
        return {
            valid: false,
            organizationId: org.id,
            ndaNumber: null,
            message: `⚠️ L'organisation "${org.name}" n'a pas de NDA renseigné.`,
        };
    }

    return {
        valid: true,
        organizationId: org.id,
        ndaNumber: org.ndaNumber,
        message: `✅ Dossier correctement rattaché à "${org.name}" (NDA: ${org.ndaNumber})`,
    };
}

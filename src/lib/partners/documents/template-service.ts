/**
 * SERVICE DOCUMENT TEMPLATES — Gestion des modèles de documents
 * ==============================================================
 * Ce service gère le cycle de vie des templates :
 *   - Initialisation automatique (création des templates par défaut si absents)
 *   - Récupération du template actif par type et organisation
 *   - Mise à jour / versioning
 */

import { prisma } from '@/lib/prisma';
import { DEFAULT_TEMPLATES, AVAILABLE_VARIABLES } from './default-templates';

type DocumentTemplateType = 'CONTRACT' | 'DPA' | 'CGV';

// ─── Obtenir le template actif ────────────────────────────────

export async function getActiveTemplate(organizationId: string, type: DocumentTemplateType) {
    // Chercher le template actif pour cette org
    let template = await prisma.documentTemplate.findFirst({
        where: {
            organizationId,
            type,
            isActive: true,
        },
        orderBy: { version: 'desc' },
    });

    // Si pas de template → initialiser avec les défauts
    if (!template) {
        await initializeDefaultTemplates(organizationId);
        template = await prisma.documentTemplate.findFirst({
            where: {
                organizationId,
                type,
                isActive: true,
            },
            orderBy: { version: 'desc' },
        });
    }

    return template;
}

// ─── Obtenir tous les templates d'une org ─────────────────────

export async function getAllTemplates(organizationId: string) {
    // Vérifier que l'organisation existe
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) {
        console.warn(`[Documents] ⚠️ Organisation ${organizationId} non trouvée — pas d'initialisation`);
        return [];
    }

    // S'assurer qu'il y a des templates
    const count = await prisma.documentTemplate.count({
        where: { organizationId },
    });

    if (count === 0) {
        await initializeDefaultTemplates(organizationId);
    }

    return prisma.documentTemplate.findMany({
        where: { organizationId },
        orderBy: [{ type: 'asc' }, { version: 'desc' }],
    });
}

// ─── Initialiser les templates par défaut ─────────────────────

export async function initializeDefaultTemplates(organizationId: string) {
    // Vérifier que l'organisation existe avant de créer
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) {
        console.warn(`[Documents] ⚠️ Organisation ${organizationId} non trouvée — impossible d'initialiser les templates`);
        return;
    }

    for (const tpl of DEFAULT_TEMPLATES) {
        // Vérifier si un template de ce type existe déjà
        const existing = await prisma.documentTemplate.findFirst({
            where: { organizationId, type: tpl.type },
        });

        if (!existing) {
            await prisma.documentTemplate.create({
                data: {
                    organizationId,
                    type: tpl.type,
                    title: tpl.title,
                    version: 1,
                    isActive: true,
                    sections: tpl.sections as any,
                    variables: tpl.variables as any,
                    footerText: tpl.footerText,
                    createdBy: 'SYSTEM',
                },
            });
            console.log(`[Documents] ✅ Template "${tpl.type}" initialisé pour l'org ${organizationId}`);
        }
    }
}

// ─── Mettre à jour un template (crée une nouvelle version) ───

export async function updateTemplate(
    templateId: string,
    organizationId: string,
    updates: {
        title?: string;
        sections?: { title: string; content: string }[];
        footerText?: string;
    },
    userId: string,
) {
    // Charger l'existant
    const existing = await prisma.documentTemplate.findFirst({
        where: { id: templateId, organizationId },
    });

    if (!existing) {
        throw new Error('Template non trouvé');
    }

    // Désactiver l'ancien
    await prisma.documentTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
    });

    // Créer une nouvelle version
    const newTemplate = await prisma.documentTemplate.create({
        data: {
            organizationId,
            type: existing.type,
            title: updates.title || existing.title,
            version: existing.version + 1,
            isActive: true,
            sections: (updates.sections || existing.sections) as any,
            variables: existing.variables as any,
            footerText: updates.footerText ?? existing.footerText,
            createdBy: userId,
        },
    });

    // Audit
    await prisma.auditLog.create({
        data: {
            organizationId,
            userId,
            userRole: 'ADMIN',
            action: 'TEMPLATE_UPDATE',
            niveauAction: 'EDITION',
            entityType: 'DocumentTemplate',
            entityId: newTemplate.id,
            newState: {
                type: existing.type,
                oldVersion: existing.version,
                newVersion: newTemplate.version,
            },
        },
    });

    console.log(`[Documents] 📝 Template "${existing.type}" v${newTemplate.version} créé par ${userId}`);

    return newTemplate;
}

// ─── Restaurer une version précédente ─────────────────────────

export async function restoreTemplateVersion(
    templateId: string,
    organizationId: string,
    userId: string,
) {
    const target = await prisma.documentTemplate.findFirst({
        where: { id: templateId, organizationId },
    });

    if (!target) throw new Error('Template non trouvé');

    // Désactiver le template actif actuel
    await prisma.documentTemplate.updateMany({
        where: { organizationId, type: target.type, isActive: true },
        data: { isActive: false },
    });

    // Activer la version ciblée
    await prisma.documentTemplate.update({
        where: { id: templateId },
        data: { isActive: true },
    });

    return target;
}

// ─── Obtenir les variables disponibles ────────────────────────

export function getAvailableVariables() {
    return AVAILABLE_VARIABLES;
}

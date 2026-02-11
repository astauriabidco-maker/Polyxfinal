/**
 * API DOCUMENT TEMPLATES — CRUD des modèles de documents
 * =====================================================
 * GET  /api/document-templates           — Liste des templates de l'organisation
 * PUT  /api/document-templates           — Mise à jour d'un template (crée une nouvelle version)
 * 
 * Accessible uniquement aux ADMIN et RESP_ADMIN.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
    getAllTemplates,
    updateTemplate,
    getAvailableVariables,
    restoreTemplateVersion,
} from '@/lib/partners/documents/template-service';

// ─── GET: Liste des templates ─────────────────────────────────

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role } = session.user;

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès refusé. Rôle ADMIN ou RESP_ADMIN requis.' },
                { status: 403 }
            );
        }

        const templates = await getAllTemplates(organizationId);
        const variables = getAvailableVariables();

        return NextResponse.json({
            templates: templates.map((t: { id: string; type: string; title: string; version: number; isActive: boolean; sections: unknown; footerText: string | null; createdAt: Date; updatedAt: Date; createdBy: string | null }) => ({
                id: t.id,
                type: t.type,
                title: t.title,
                version: t.version,
                isActive: t.isActive,
                sections: t.sections,
                footerText: t.footerText,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                createdBy: t.createdBy,
            })),
            variables,
        });
    } catch (error) {
        console.error('[Document Templates GET] Error:', error instanceof Error ? error.message : error);
        console.error('[Document Templates GET] Stack:', error instanceof Error ? error.stack : 'no stack');
        return NextResponse.json({ error: `Erreur serveur: ${error instanceof Error ? error.message : 'Unknown'}` }, { status: 500 });
    }
}

// ─── PUT: Mise à jour d'un template ──────────────────────────

export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id: userId, organizationId, role } = session.user;

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès refusé. Rôle ADMIN ou RESP_ADMIN requis.' },
                { status: 403 }
            );
        }

        const body = await request.json();

        if (!body.templateId) {
            return NextResponse.json({ error: 'templateId requis' }, { status: 400 });
        }

        // Action: restaurer une version antérieure
        if (body.action === 'restore') {
            const restored = await restoreTemplateVersion(body.templateId, organizationId, userId);
            return NextResponse.json({
                success: true,
                template: restored,
                message: `Version ${restored.version} restaurée avec succès.`,
            });
        }

        // Action par défaut: mise à jour (crée une nouvelle version)
        if (!body.sections || !Array.isArray(body.sections)) {
            return NextResponse.json(
                { error: 'sections requises (array de {title, content})' },
                { status: 400 }
            );
        }

        // Valider la structure des sections
        for (const section of body.sections) {
            if (!section.title || typeof section.content !== 'string') {
                return NextResponse.json(
                    { error: 'Chaque section doit avoir un title et un content.' },
                    { status: 400 }
                );
            }
        }

        const updated = await updateTemplate(
            body.templateId,
            organizationId,
            {
                title: body.title,
                sections: body.sections,
                footerText: body.footerText,
            },
            userId
        );

        return NextResponse.json({
            success: true,
            template: {
                id: updated.id,
                type: updated.type,
                title: updated.title,
                version: updated.version,
                isActive: updated.isActive,
                sections: updated.sections,
                footerText: updated.footerText,
            },
            message: `Template "${updated.type}" mis à jour (v${updated.version}).`,
        });
    } catch (error) {
        console.error('[Document Templates PUT] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

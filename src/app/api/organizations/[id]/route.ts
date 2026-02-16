/**
 * API ROUTE: /api/organizations/[id]
 * ===================================
 * Récupération et mise à jour d'une organisation spécifique.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { organizationPatchSchema, parseBody } from '@/lib/validation';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/organizations/[id]
 * Récupérer les détails d'une organisation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Vérifier que l'utilisateur a accès à cette organisation
        const memberships = session.user.memberships || [];
        const hasAccess = memberships.some(m => m.organizationId === id);

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        const organization = await prisma.organization.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                type: true,
                siret: true,
                ndaNumber: true,
                qualiopiCertified: true,
                qualiopiExpiry: true,
                responsableName: true,
                logoUrl: true,
                signatureUrl: true,
                cachetUrl: true,
                cgvUrl: true,
                livretAccueilUrl: true,
                reglementInterieurUrl: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: {
                        members: true,
                        sites: true,
                        dossiers: true,
                    },
                },
            },
        });

        if (!organization) {
            return NextResponse.json(
                { error: 'Organisation non trouvée' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            organization,
        });

    } catch (error) {
        console.error('[API Organization GET] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/organizations/[id]
 * Mettre à jour une organisation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();

        // Vérifier que l'utilisateur est ADMIN via la DB (toujours à jour)
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id!,
                    organizationId: id,
                },
            },
            include: { role: true },
        });

        if (!currentMembership || currentMembership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants' },
                { status: 403 }
            );
        }

        // Validation Zod
        const parsed = parseBody(organizationPatchSchema, body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error, errors: parsed.errors },
                { status: 400 }
            );
        }

        const organization = await prisma.organization.update({
            where: { id },
            data: parsed.data,
        });

        return NextResponse.json({
            success: true,
            organization,
        });

    } catch (error) {
        console.error('[API Organization PATCH] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/organizations/[id]
 * Soft-delete : désactive l'organisation (isActive = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Vérifier que l'utilisateur est ADMIN via la DB (toujours à jour)
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id!,
                    organizationId: id,
                },
            },
            include: { role: true },
        });

        if (!currentMembership || currentMembership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants — seuls les administrateurs peuvent désactiver une organisation.' },
                { status: 403 }
            );
        }

        // Vérifier qu'il n'y a pas de dossiers actifs
        const activeDossiers = await prisma.dossier.count({
            where: { organizationId: id, NOT: { status: 'ABANDONNE' } },
        });

        if (activeDossiers > 0) {
            return NextResponse.json(
                { error: `Impossible de désactiver : ${activeDossiers} dossier(s) actif(s). Clôturez-les d'abord.` },
                { status: 409 }
            );
        }

        // Soft-delete
        const organization = await prisma.organization.update({
            where: { id },
            data: { isActive: false },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                organizationId: id,
                userId: session.user.id!,
                userRole: 'ADMIN',
                action: 'DEACTIVATE_ORGANIZATION',
                niveauAction: 'VALIDATION',
                entityType: 'Organization',
                entityId: id,
                newState: { isActive: false, name: organization.name },
            },
        });

        return NextResponse.json({
            success: true,
            message: `L'organisation "${organization.name}" a été désactivée.`,
        });

    } catch (error) {
        console.error('[API Organization DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * API ROUTE: /api/organizations/[id]/sites/[siteId]
 * ==================================================
 * Gestion d'un site spécifique (GET, PATCH, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: Promise<{ id: string; siteId: string }>;
}

/**
 * GET /api/organizations/[id]/sites/[siteId]
 * Récupérer un site spécifique
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

        const { id, siteId } = await params;

        // Vérifier accès
        const memberships = session.user.memberships || [];
        const hasAccess = memberships.some(m => m.organizationId === id);

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        const site = await prisma.site.findFirst({
            where: {
                id: siteId,
                organizationId: id,
            },
            include: {
                _count: {
                    select: {
                        sessions: true,
                        dossiers: true,
                    },
                },
            },
        });

        if (!site) {
            return NextResponse.json(
                { error: 'Site non trouvé' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            site,
        });

    } catch (error) {
        console.error('[API Site GET] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/organizations/[id]/sites/[siteId]
 * Modifier un site
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

        const { id, siteId } = await params;
        const body = await request.json();

        // Vérifier accès ADMIN
        const memberships = session.user.memberships || [];
        const membership = memberships.find(m => m.organizationId === id);

        if (!membership || membership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants' },
                { status: 403 }
            );
        }

        // Vérifier que le site existe
        const existingSite = await prisma.site.findFirst({
            where: { id: siteId, organizationId: id },
        });

        if (!existingSite) {
            return NextResponse.json(
                { error: 'Site non trouvé' },
                { status: 404 }
            );
        }

        const { name, city, zipCode, address, uaiCode, siretNic, isHeadquarters, isActive } = body;

        // Vérifier unicité du nom si modifié
        if (name && name.trim() !== existingSite.name) {
            const duplicate = await prisma.site.findFirst({
                where: {
                    organizationId: id,
                    name: name.trim(),
                    id: { not: siteId },
                },
            });

            if (duplicate) {
                return NextResponse.json(
                    { error: 'Un site avec ce nom existe déjà' },
                    { status: 400 }
                );
            }
        }

        // Validation code UAI si fourni
        if (uaiCode && !/^[0-9]{7}[A-Z]$/.test(uaiCode)) {
            return NextResponse.json(
                { error: 'Code UAI invalide (format: 7 chiffres + 1 lettre)' },
                { status: 400 }
            );
        }

        // Si on définit ce site comme siège, retirer le statut des autres
        if (isHeadquarters === true && !existingSite.isHeadquarters) {
            await prisma.site.updateMany({
                where: { organizationId: id, isHeadquarters: true },
                data: { isHeadquarters: false },
            });
        }

        const site = await prisma.site.update({
            where: { id: siteId },
            data: {
                ...(name && { name: name.trim() }),
                ...(city && { city: city.trim() }),
                ...(zipCode && { zipCode: zipCode.trim() }),
                ...(address !== undefined && { address: address?.trim() || null }),
                ...(uaiCode !== undefined && { uaiCode: uaiCode || null }),
                ...(siretNic !== undefined && { siretNic: siretNic || null }),
                ...(isHeadquarters !== undefined && { isHeadquarters }),
                ...(isActive !== undefined && { isActive }),
            },
            select: {
                id: true,
                name: true,
                isHeadquarters: true,
                address: true,
                city: true,
                zipCode: true,
                uaiCode: true,
                siretNic: true,
                isActive: true,
                _count: {
                    select: {
                        sessions: true,
                        dossiers: true,
                    },
                },
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                organizationId: id,
                userId: session.user.id!,
                userRole: membership.role.code,
                action: 'UPDATE_SITE',
                niveauAction: 'EDITION',
                entityType: 'Site',
                entityId: site.id,
                phase: 0,
                isForced: false,
                previousState: { name: existingSite.name },
                newState: { name: site.name },
            },
        });

        return NextResponse.json({
            success: true,
            site,
        });

    } catch (error) {
        console.error('[API Site PATCH] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/organizations/[id]/sites/[siteId]
 * Supprimer un site
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

        const { id, siteId } = await params;

        // Vérifier accès ADMIN
        const memberships = session.user.memberships || [];
        const membership = memberships.find(m => m.organizationId === id);

        if (!membership || membership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants' },
                { status: 403 }
            );
        }

        // Vérifier que le site existe
        const site = await prisma.site.findFirst({
            where: { id: siteId, organizationId: id },
            include: {
                _count: {
                    select: {
                        sessions: true,
                        dossiers: true,
                    },
                },
            },
        });

        if (!site) {
            return NextResponse.json(
                { error: 'Site non trouvé' },
                { status: 404 }
            );
        }

        // Empêcher la suppression s'il y a des dossiers liés
        if (site._count.dossiers > 0) {
            return NextResponse.json(
                { error: `Impossible de supprimer: ${site._count.dossiers} dossier(s) lié(s) à ce site` },
                { status: 400 }
            );
        }

        // Supprimer le site
        await prisma.site.delete({
            where: { id: siteId },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                organizationId: id,
                userId: session.user.id!,
                userRole: membership.role.code,
                action: 'DELETE_SITE',
                niveauAction: 'SUPPRESSION',
                entityType: 'Site',
                entityId: siteId,
                phase: 0,
                isForced: false,
                previousState: { name: site.name, city: site.city },
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Site supprimé',
        });

    } catch (error) {
        console.error('[API Site DELETE] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

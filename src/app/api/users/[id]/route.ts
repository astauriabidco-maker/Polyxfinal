/**
 * API USERS/[ID] - Gestion d'un utilisateur spécifique
 * =====================================================
 * GET    - Détails d'un utilisateur
 * PUT    - Modifier le rôle/scope
 * DELETE - Désactiver le membership
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MembershipScope } from '@prisma/client';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id: userId } = await params;
        const organizationId = session.user.organizationId;

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
            include: {
                user: true,
                role: true,
                siteAccess: {
                    include: {
                        site: true,
                    },
                },
            },
        });

        if (!membership) {
            return NextResponse.json(
                { error: 'Utilisateur non trouvé dans cette organisation' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            user: {
                id: membership.user.id,
                email: membership.user.email,
                nom: membership.user.nom,
                prenom: membership.user.prenom,
                telephone: membership.user.telephone,
                role: membership.role.code,
                roleLabel: membership.role.name,
                scope: membership.scope,
                sites: membership.siteAccess.map((sa) => sa.site),
                isActive: membership.isActive,
                createdAt: membership.user.createdAt,
            },
        });
    } catch (error) {
        console.error('Erreur GET /api/users/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * PUT /api/users/:id
 * Modifier le rôle et/ou le scope d'un utilisateur
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // Vérifier que l'utilisateur courant est ADMIN
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: session.user.organizationId,
                },
            },
            include: { role: true },
        });

        if (currentMembership?.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seul un ADMIN peut modifier les utilisateurs' },
                { status: 403 }
            );
        }

        const { id: userId } = await params;
        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { role, scope, siteIds } = body;

        // Trouver le rôle correspondant au code s'il est fourni
        let roleUpdate = {};
        if (role) {
            const targetRole = await prisma.role.findFirst({
                where: {
                    OR: [
                        { code: role, organizationId: null },
                        { code: role, organizationId },
                    ],
                },
            });

            if (!targetRole) {
                return NextResponse.json(
                    { error: `Rôle invalide: ${role}` },
                    { status: 400 }
                );
            }
            roleUpdate = { role: { connect: { id: targetRole.id } } };
        }

        // Mettre à jour le membership
        const updatedMembership = await prisma.membership.update({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
            data: {
                ...roleUpdate,
                scope: scope as MembershipScope,
            },
            include: { role: true },
        });

        // Mettre à jour les accès sites si scope RESTRICTED
        if (scope === 'RESTRICTED') {
            // Supprimer les anciens accès
            await prisma.membershipSiteAccess.deleteMany({
                where: {
                    membershipUserId: userId,
                    membershipOrgId: organizationId,
                },
            });

            // Créer les nouveaux accès
            if (siteIds && siteIds.length > 0) {
                await prisma.membershipSiteAccess.createMany({
                    data: siteIds.map((siteId: string) => ({
                        membershipUserId: userId,
                        membershipOrgId: organizationId,
                        siteId,
                    })),
                });
            }
        }

        // Log audit
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: currentMembership.role.code,
                organizationId,
                action: 'USER_UPDATE',
                entityType: 'User',
                entityId: userId,
                niveauAction: 'EDITION',
            },
        });

        return NextResponse.json({
            success: true,
            membership: updatedMembership,
        });
    } catch (error) {
        console.error('Erreur PUT /api/users/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * DELETE /api/users/:id
 * Désactiver le membership (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // Vérifier que l'utilisateur courant est ADMIN
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: session.user.organizationId,
                },
            },
            include: { role: true },
        });

        if (currentMembership?.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seul un ADMIN peut désactiver des utilisateurs' },
                { status: 403 }
            );
        }

        const { id: userId } = await params;
        const organizationId = session.user.organizationId;

        // Empêcher l'auto-suppression
        if (userId === session.user.id) {
            return NextResponse.json(
                { error: 'Vous ne pouvez pas vous désactiver vous-même' },
                { status: 400 }
            );
        }

        // Soft delete du membership
        await prisma.membership.update({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
            data: {
                isActive: false,
            },
        });

        // Log audit
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: currentMembership.role.code,
                organizationId,
                action: 'USER_DEACTIVATE',
                entityType: 'User',
                entityId: userId,
                niveauAction: 'EDITION',
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/users/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * API ROLE PERMISSIONS - Toggle permissions per role
 * ===================================================
 * GET  - List all permissions with active state for this role
 * PUT  - Update role permissions (replace all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// ─── GET /api/roles/[id]/permissions ────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id: roleId } = await params;

        // Vérifier que le rôle existe
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: { select: { permissionId: true } },
            },
        });

        if (!role) {
            return NextResponse.json({ error: 'Rôle introuvable.' }, { status: 404 });
        }

        // Récupérer toutes les permissions disponibles
        const allPermissions = await prisma.permission.findMany({
            orderBy: [{ category: 'asc' }, { code: 'asc' }],
        });

        // Set des permissions actives pour ce rôle
        const activePermIds = new Set(role.permissions.map((rp) => rp.permissionId));

        // Grouper par catégorie
        const categories: Record<string, Array<{
            id: string;
            code: string;
            description: string;
            active: boolean;
        }>> = {};

        for (const perm of allPermissions) {
            const cat = perm.category || 'Autres';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({
                id: perm.id,
                code: perm.code,
                description: perm.description,
                active: activePermIds.has(perm.id),
            });
        }

        return NextResponse.json({
            roleId: role.id,
            roleName: role.name,
            roleCode: role.code,
            isSystem: role.isSystem,
            categories,
            totalActive: activePermIds.size,
            totalPermissions: allPermissions.length,
        });

    } catch (error) {
        console.error('Erreur GET /api/roles/[id]/permissions:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// ─── PUT /api/roles/[id]/permissions ────────────────────────

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // RBAC: ADMIN uniquement
        const roleObj = session.user.role;
        const roleCode = typeof roleObj === 'string' ? roleObj : roleObj?.code;
        if (roleCode !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seuls les administrateurs peuvent modifier les permissions.' },
                { status: 403 }
            );
        }

        const { id: roleId } = await params;

        // Vérifier que le rôle existe
        const role = await prisma.role.findUnique({
            where: { id: roleId },
        });

        if (!role) {
            return NextResponse.json({ error: 'Rôle introuvable.' }, { status: 404 });
        }

        const body = await request.json();
        const { permissionIds } = body;

        if (!Array.isArray(permissionIds)) {
            return NextResponse.json(
                { error: 'permissionIds doit être un tableau.' },
                { status: 400 }
            );
        }

        // Vérifier que toutes les permissions existent
        const validPermissions = await prisma.permission.findMany({
            where: { id: { in: permissionIds } },
            select: { id: true },
        });
        const validIds = new Set(validPermissions.map((p) => p.id));

        // Transaction : supprimer toutes les anciennes, ajouter les nouvelles
        await prisma.$transaction(async (tx) => {
            // Supprimer toutes les permissions existantes
            await tx.rolePermission.deleteMany({
                where: { roleId },
            });

            // Ajouter les nouvelles permissions
            if (permissionIds.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissionIds
                        .filter((id: string) => validIds.has(id))
                        .map((permissionId: string) => ({
                            roleId,
                            permissionId,
                        })),
                });
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: roleCode || 'ADMIN',
                organizationId: session.user.organizationId,
                action: 'ROLE_PERMISSIONS_UPDATE',
                entityType: 'Role',
                entityId: roleId,
                niveauAction: 'EDITION',
                newState: {
                    roleCode: role.code,
                    permissionsCount: permissionIds.length,
                    permissionIds,
                },
            },
        });

        console.log(`[Roles] 🔐 Permissions mises à jour pour ${role.code}: ${permissionIds.length} modules actifs`);

        return NextResponse.json({
            success: true,
            totalActive: permissionIds.length,
            message: `Permissions mises à jour pour "${role.name}".`,
        });

    } catch (error) {
        console.error('Erreur PUT /api/roles/[id]/permissions:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

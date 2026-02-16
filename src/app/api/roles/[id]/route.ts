/**
 * API ROLES/[ID] - Modification et suppression de rôles custom
 * =============================================================
 * PUT    - Modifier un rôle custom (nom, description)
 * DELETE - Supprimer un rôle custom (si non utilisé)
 * 
 * Protection: les rôles système (isSystem: true) ne peuvent pas être modifiés ni supprimés.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { roleUpdateSchema, parseBody } from '@/lib/validation';

// ─── PUT /api/roles/[id] ────────────────────────────────────

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
        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seuls les administrateurs peuvent modifier des rôles.' },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Vérifier que le rôle existe
        const existingRole = await prisma.role.findUnique({
            where: { id },
        });

        if (!existingRole) {
            return NextResponse.json({ error: 'Rôle introuvable.' }, { status: 404 });
        }

        // Protéger les rôles système
        if (existingRole.isSystem) {
            return NextResponse.json(
                { error: 'Les rôles système ne peuvent pas être modifiés.' },
                { status: 403 }
            );
        }

        // Vérifier que le rôle appartient à cette organisation
        if (existingRole.organizationId !== session.user.organizationId) {
            return NextResponse.json(
                { error: 'Ce rôle n\'appartient pas à votre organisation.' },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validation Zod
        const parsed = parseBody(roleUpdateSchema, body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error, errors: parsed.errors },
                { status: 400 }
            );
        }

        const { name, description } = parsed.data;

        // Vérifier l'unicité du nom dans le contexte de l'org
        const duplicateName = await prisma.role.findFirst({
            where: {
                name,
                organizationId: session.user.organizationId,
                NOT: { id },
            },
        });

        if (duplicateName) {
            return NextResponse.json(
                { error: `Un rôle avec le nom "${name}" existe déjà dans votre organisation.` },
                { status: 409 }
            );
        }

        const updatedRole = await prisma.role.update({
            where: { id },
            data: {
                name,
                description: description ?? existingRole.description,
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: session.user.role?.code || 'ADMIN',
                organizationId: session.user.organizationId,
                action: 'ROLE_UPDATE',
                entityType: 'Role',
                entityId: id,
                niveauAction: 'EDITION',
                newState: { name, description },
            },
        });

        return NextResponse.json({
            success: true,
            role: {
                id: updatedRole.id,
                name: updatedRole.name,
                code: updatedRole.code,
                description: updatedRole.description,
                isSystem: updatedRole.isSystem,
            },
        });

    } catch (error) {
        console.error('Erreur PUT /api/roles/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// ─── DELETE /api/roles/[id] ──────────────────────────────────

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // RBAC: ADMIN uniquement
        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seuls les administrateurs peuvent supprimer des rôles.' },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Vérifier que le rôle existe
        const existingRole = await prisma.role.findUnique({
            where: { id },
            include: {
                _count: { select: { memberships: true } },
            },
        });

        if (!existingRole) {
            return NextResponse.json({ error: 'Rôle introuvable.' }, { status: 404 });
        }

        // Protéger les rôles système
        if (existingRole.isSystem) {
            return NextResponse.json(
                { error: 'Les rôles système ne peuvent pas être supprimés.' },
                { status: 403 }
            );
        }

        // Vérifier que le rôle appartient à cette organisation
        if (existingRole.organizationId !== session.user.organizationId) {
            return NextResponse.json(
                { error: 'Ce rôle n\'appartient pas à votre organisation.' },
                { status: 403 }
            );
        }

        // Vérifier qu'aucun membership n'utilise ce rôle
        if (existingRole._count.memberships > 0) {
            return NextResponse.json(
                { error: `Ce rôle est utilisé par ${existingRole._count.memberships} utilisateur(s). Réassignez-les avant de supprimer.` },
                { status: 409 }
            );
        }

        // Supprimer les permissions associées d'abord
        await prisma.rolePermission.deleteMany({
            where: { roleId: id },
        });

        // Supprimer le rôle
        await prisma.role.delete({
            where: { id },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: session.user.role?.code || 'ADMIN',
                organizationId: session.user.organizationId,
                action: 'ROLE_DELETE',
                entityType: 'Role',
                entityId: id,
                niveauAction: 'EDITION',
                newState: { deletedRole: existingRole.code, deletedName: existingRole.name },
            },
        });

        console.log(`[Roles] 🗑️ Rôle custom supprimé: ${existingRole.code} (${existingRole.name})`);

        return NextResponse.json({
            success: true,
            message: `Le rôle "${existingRole.name}" a été supprimé.`,
        });

    } catch (error) {
        console.error('Erreur DELETE /api/roles/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

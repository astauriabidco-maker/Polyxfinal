/**
 * API ROLES - Gestion des rôles de l'organisation
 * =================================================
 * GET  - Liste des rôles (système + custom de l'org)
 * POST - Créer un rôle custom
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { roleCreateSchema, parseBody } from '@/lib/validation';

// ─── GET /api/roles ──────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;

        const roles = await prisma.role.findMany({
            where: {
                OR: [
                    { organizationId: null },           // Rôles système
                    { organizationId: organizationId }, // Rôles custom de l'org
                ],
            },
            include: {
                _count: {
                    select: { memberships: true },
                },
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
            orderBy: [
                { isSystem: 'desc' },  // Système en premier
                { name: 'asc' },
            ],
        });

        const formattedRoles = roles.map((role) => ({
            id: role.id,
            name: role.name,
            code: role.code,
            description: role.description,
            isSystem: role.isSystem,
            organizationId: role.organizationId,
            usageCount: role._count.memberships,
            permissions: role.permissions.map((rp) => ({
                id: rp.permission.id,
                code: rp.permission.code,
                description: rp.permission.description,
                category: rp.permission.category,
            })),
            createdAt: role.createdAt,
        }));

        return NextResponse.json({ roles: formattedRoles });

    } catch (error) {
        console.error('Erreur GET /api/roles:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// ─── POST /api/roles ─────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // RBAC: ADMIN uniquement
        if (session.user.role?.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seuls les administrateurs peuvent créer des rôles.' },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validation Zod
        const parsed = parseBody(roleCreateSchema, body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error, errors: parsed.errors },
                { status: 400 }
            );
        }

        const { name, code, description } = parsed.data;

        const organizationId = session.user.organizationId;

        // Vérifier l'unicité du code dans le contexte de l'org
        const existingRole = await prisma.role.findFirst({
            where: {
                code,
                OR: [
                    { organizationId: null },
                    { organizationId },
                ],
            },
        });

        if (existingRole) {
            return NextResponse.json(
                { error: `Un rôle avec le code "${code}" existe déjà.` },
                { status: 409 }
            );
        }

        // Créer le rôle custom
        const role = await prisma.role.create({
            data: {
                name,
                code,
                description: description || null,
                isSystem: false,
                organizationId,
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: session.user.role?.code || 'ADMIN',
                organizationId,
                action: 'ROLE_CREATE',
                entityType: 'Role',
                entityId: role.id,
                niveauAction: 'EDITION',
                newState: { name, code, description },
            },
        });

        console.log(`[Roles] ✅ Rôle custom créé: ${code} (${name}) pour org ${organizationId}`);

        return NextResponse.json({
            success: true,
            role: {
                id: role.id,
                name: role.name,
                code: role.code,
                description: role.description,
                isSystem: false,
                usageCount: 0,
            },
        }, { status: 201 });

    } catch (error) {
        console.error('Erreur POST /api/roles:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

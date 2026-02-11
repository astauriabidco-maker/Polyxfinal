/**
 * API USERS - Gestion des utilisateurs de l'organisation
 * =======================================================
 * GET  - Liste des membres de l'organisation courante
 * POST - Créer un utilisateur + membership
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Role, MembershipScope } from '@prisma/client';

/**
 * GET /api/users
 * Liste les membres de l'organisation courante
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;

        // Récupérer les memberships avec les users
        const memberships = await prisma.membership.findMany({
            where: {
                organizationId,
                isActive: true,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        telephone: true,
                        isActive: true,
                        createdAt: true,
                    },
                },
                siteAccess: {
                    include: {
                        site: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                lastAccessedAt: 'desc',
            },
        });

        // Formater la réponse
        const users = memberships.map((m) => ({
            id: m.user.id,
            email: m.user.email,
            nom: m.user.nom,
            prenom: m.user.prenom,
            telephone: m.user.telephone,
            role: m.role,
            scope: m.scope,
            sites: m.siteAccess.map((sa) => sa.site),
            isActive: m.user.isActive && m.isActive,
            lastAccessedAt: m.lastAccessedAt,
            createdAt: m.user.createdAt,
        }));

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Erreur GET /api/users:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/users
 * Créer un nouvel utilisateur avec membership
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // Vérifier que l'utilisateur est ADMIN
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: session.user.organizationId,
                },
            },
        });

        if (currentMembership?.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seul un ADMIN peut créer des utilisateurs' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { email, nom, prenom, telephone, role, scope, siteIds } = body;

        // Validation
        if (!email || !nom || !prenom) {
            return NextResponse.json(
                { error: 'Email, nom et prénom sont requis' },
                { status: 400 }
            );
        }

        const organizationId = session.user.organizationId;

        // Vérifier si l'utilisateur existe déjà
        let user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            // Vérifier s'il a déjà un membership dans cette org
            const existingMembership = await prisma.membership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: user.id,
                        organizationId,
                    },
                },
            });

            if (existingMembership) {
                return NextResponse.json(
                    { error: 'Cet utilisateur est déjà membre de l\'organisation' },
                    { status: 409 }
                );
            }
        } else {
            // Créer le nouvel utilisateur
            user = await prisma.user.create({
                data: {
                    email,
                    nom,
                    prenom,
                    telephone: telephone || null,
                    isActive: true,
                },
            });
        }

        // Créer le membership
        const membership = await prisma.membership.create({
            data: {
                userId: user.id,
                organizationId,
                role: (role as Role) || 'FORMAT',
                scope: (scope as MembershipScope) || 'GLOBAL',
                isActive: true,
            },
        });

        // Si scope RESTRICTED et siteIds fournis, créer les accès
        if (scope === 'RESTRICTED' && siteIds && siteIds.length > 0) {
            await prisma.membershipSiteAccess.createMany({
                data: siteIds.map((siteId: string) => ({
                    membershipUserId: user!.id,
                    membershipOrgId: organizationId,
                    siteId,
                })),
            });
        }

        // Log audit
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: currentMembership.role,
                organizationId,
                action: 'USER_CREATE',
                entityType: 'User',
                entityId: user.id,
                niveauAction: 'EDITION',
            },
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                role: membership.role,
                scope: membership.scope,
            },
        }, { status: 201 });

    } catch (error) {
        console.error('Erreur POST /api/users:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

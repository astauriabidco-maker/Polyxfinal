/**
 * API ROUTE: /api/organizations/[id]/sites
 * =========================================
 * Gestion des sites d'une organisation (GET liste, POST création)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { siteCreateSchema, parseBody } from '@/lib/validation';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/organizations/[id]/sites
 * Liste des sites d'une organisation
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

        // Vérifier accès à l'organisation
        const memberships = session.user.memberships || [];
        const hasAccess = memberships.some(m => m.organizationId === id);

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        const sites = await prisma.site.findMany({
            where: { organizationId: id },
            orderBy: [
                { isHeadquarters: 'desc' },
                { name: 'asc' },
            ],
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
                createdAt: true,
                _count: {
                    select: {
                        sessions: true,
                        dossiers: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            sites,
        });

    } catch (error) {
        console.error('[API Sites GET] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/organizations/[id]/sites
 * Créer un nouveau site
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

        // Vérifier accès ADMIN via la DB (toujours à jour)
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
        const parsed = parseBody(siteCreateSchema, body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error, errors: parsed.errors },
                { status: 400 }
            );
        }

        const { name, city, zipCode, address, uaiCode, siretNic, isHeadquarters } = parsed.data;

        // Vérifier unicité du nom dans l'organisation
        const existingSite = await prisma.site.findFirst({
            where: {
                organizationId: id,
                name: name.trim(),
            },
        });

        if (existingSite) {
            return NextResponse.json(
                { error: 'Un site avec ce nom existe déjà' },
                { status: 400 }
            );
        }

        // Validation code UAI si fourni (7 chiffres + 1 lettre)
        if (uaiCode && !/^[0-9]{7}[A-Z]$/.test(uaiCode)) {
            return NextResponse.json(
                { error: 'Code UAI invalide (format: 7 chiffres + 1 lettre)' },
                { status: 400 }
            );
        }

        // Si c'est le premier site et isHeadquarters n'est pas défini, le mettre en siège
        const siteCount = await prisma.site.count({ where: { organizationId: id } });
        const setAsHeadquarters = isHeadquarters === true || siteCount === 0;

        // Si on définit ce site comme siège, retirer le statut des autres
        if (setAsHeadquarters) {
            await prisma.site.updateMany({
                where: { organizationId: id, isHeadquarters: true },
                data: { isHeadquarters: false },
            });
        }

        const site = await prisma.site.create({
            data: {
                organizationId: id,
                name: name.trim(),
                city: city.trim(),
                zipCode: zipCode.trim(),
                address: address?.trim() || null,
                uaiCode: uaiCode || null,
                siretNic: siretNic || null,
                isHeadquarters: setAsHeadquarters,
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
                userRole: currentMembership.role.code,
                action: 'CREATE_SITE',
                niveauAction: 'EDITION',
                entityType: 'Site',
                entityId: site.id,
                phase: 0,
                isForced: false,
                previousState: {},
                newState: { name: site.name, city: site.city },
            },
        });

        return NextResponse.json({
            success: true,
            site,
        }, { status: 201 });

    } catch (error) {
        console.error('[API Sites POST] Error:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

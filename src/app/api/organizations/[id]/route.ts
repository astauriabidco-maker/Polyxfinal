/**
 * API ROUTE: /api/organizations/[id]
 * ===================================
 * Récupération et mise à jour d'une organisation spécifique.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

        // Vérifier que l'utilisateur a accès à cette organisation avec rôle ADMIN
        const memberships = session.user.memberships || [];
        const membership = memberships.find(m => m.organizationId === id);

        if (!membership || membership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants' },
                { status: 403 }
            );
        }

        // Champs modifiables
        const allowedFields = [
            'name',
            'responsableName',
            'ndaNumber',
            'qualiopiCertified',
            'qualiopiExpiry',
            'logoUrl',
            'signatureUrl',
            'cachetUrl',
            'cgvUrl',
            'livretAccueilUrl',
            'reglementInterieurUrl',
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        const organization = await prisma.organization.update({
            where: { id },
            data: updateData,
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

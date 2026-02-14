/**
 * API ROUTE: /api/organizations
 * ==============================
 * Gestion des organisations (création, listage).
 * 
 * POST - Créer une nouvelle organisation
 * GET  - Lister les organisations (filtrées par accès utilisateur)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { validateOrganizationCreation } from '@/lib/compliance';
import { ROLE_IDS } from '@/lib/constants/roles';

/**
 * POST /api/organizations
 * Créer une nouvelle organisation
 */
export async function POST(request: NextRequest) {
    try {
        // Vérifier l'authentification
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        // Récupérer les données
        const body = await request.json();
        const {
            name,
            type,
            siret,
            ndaNumber,
            qualiopiCertified,
        } = body;

        // Validations basiques
        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'Nom de l\'organisation requis' },
                { status: 400 }
            );
        }

        if (!siret?.trim()) {
            return NextResponse.json(
                { error: 'SIRET requis' },
                { status: 400 }
            );
        }

        // Validation format SIRET (14 chiffres)
        const cleanSiret = siret.replace(/\s/g, '');
        if (!/^[0-9]{14}$/.test(cleanSiret)) {
            return NextResponse.json(
                { error: 'Le SIRET doit contenir exactement 14 chiffres' },
                { status: 400 }
            );
        }

        // Validation format NDA si fourni (11 chiffres)
        if (ndaNumber && !/^[0-9]{11}$/.test(ndaNumber)) {
            return NextResponse.json(
                { error: 'Le NDA doit contenir exactement 11 chiffres' },
                { status: 400 }
            );
        }

        // Vérifier unicité du SIRET
        const existingSiret = await prisma.organization.findFirst({
            where: { siret: cleanSiret },
        });

        if (existingSiret) {
            return NextResponse.json(
                { error: `Une organisation avec le SIRET ${cleanSiret} existe déjà` },
                { status: 409 }
            );
        }

        // Validation Compliance
        const complianceResult = await validateOrganizationCreation({
            type: type || 'OF_STANDARD',
            siret: cleanSiret,
            ndaNumber: ndaNumber || null,
            qualiopiCertified: qualiopiCertified || false,
        });

        // Bloquer si erreurs critiques
        if (!complianceResult.success) {
            return NextResponse.json(
                {
                    error: complianceResult.errors[0],
                    errors: complianceResult.errors,
                    warnings: complianceResult.warnings,
                },
                { status: 400 }
            );
        }

        // Créer l'organisation
        const organization = await prisma.organization.create({
            data: {
                name: name.trim(),
                type: type || 'OF_STANDARD',
                siret: cleanSiret,
                ndaNumber: ndaNumber || null,
                qualiopiCertified: qualiopiCertified || false,
                isActive: true,
            },
        });

        // Créer le membership pour l'utilisateur qui crée (ADMIN)
        if (session.user.id) {
            await prisma.membership.create({
                data: {
                    user: { connect: { id: session.user.id } },
                    organization: { connect: { id: organization.id } },
                    role: { connect: { id: ROLE_IDS.ADMIN } },
                    scope: 'GLOBAL',
                },
            });
        }

        // Log d'audit
        await prisma.auditLog.create({
            data: {
                organizationId: organization.id,
                userId: session.user.id!,
                userRole: 'ADMIN',
                action: 'CREATE_ORGANIZATION',
                niveauAction: 'EDITION',
                entityType: 'Organization',
                entityId: organization.id,
                phase: 0,
                isForced: false,
                newState: {
                    name: organization.name,
                    type: organization.type,
                    siret: organization.siret,
                },
            },
        });

        // Réponse avec warnings éventuels
        return NextResponse.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                type: organization.type,
                siret: organization.siret,
            },
            warnings: complianceResult.warnings,
        });

    } catch (error) {
        console.error('[API Organizations] Erreur création:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/organizations
 * Lister les organisations (filtrées par accès utilisateur)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        // Récupérer les organisations où l'utilisateur a un membership
        const memberships = session.user.memberships || [];
        const organizationIds = memberships.map(m => m.organizationId);

        const organizations = await prisma.organization.findMany({
            where: {
                id: { in: organizationIds },
                isActive: true,
            },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                type: true,
                siret: true,
                ndaNumber: true,
                qualiopiCertified: true,
                isActive: true,
                _count: {
                    select: {
                        members: true,
                        dossiers: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            organizations,
            total: organizations.length,
        });

    } catch (error) {
        console.error('[API Organizations] Erreur lecture:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

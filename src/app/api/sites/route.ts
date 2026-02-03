/**
 * API ROUTE: Sites Management
 * ===========================
 * Endpoints pour la gestion des sites avec validation CFA (UAI).
 * 
 * POST /api/sites - Créer un nouveau site
 * GET /api/sites - Lister les sites (filtré par org)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { validateSiteCreation } from '@/lib/compliance';

// POST - Créer un site
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
        const { organizationId, name, address, city, postalCode, uaiCode } = body;

        // Validation basique
        if (!organizationId) {
            return NextResponse.json(
                { error: 'Organisation requise' },
                { status: 400 }
            );
        }

        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'Nom du site requis' },
                { status: 400 }
            );
        }

        // Vérifier que l'utilisateur a accès à cette organisation
        const membership = session.user.memberships?.find(
            m => m.organizationId === organizationId
        );

        if (!membership) {
            return NextResponse.json(
                { error: 'Accès non autorisé à cette organisation' },
                { status: 403 }
            );
        }

        // Seuls les ADMIN peuvent créer des sites
        if (membership.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Seuls les administrateurs peuvent créer des sites' },
                { status: 403 }
            );
        }

        // Validation Compliance (UAI pour CFA)
        const complianceResult = await validateSiteCreation(organizationId, {
            name: name.trim(),
            uaiCode: uaiCode || null,
        });

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

        // Vérifier unicité du code UAI
        if (uaiCode) {
            const existingUai = await prisma.site.findFirst({
                where: { uaiCode: uaiCode.toUpperCase() },
            });

            if (existingUai) {
                return NextResponse.json(
                    { error: `Le code UAI ${uaiCode} est déjà utilisé par un autre site` },
                    { status: 409 }
                );
            }
        }

        // Créer le site
        const site = await prisma.site.create({
            data: {
                organizationId,
                name: name.trim(),
                address: address?.trim() || null,
                city: city?.trim() || null,
                postalCode: postalCode?.trim() || null,
                uaiCode: uaiCode?.toUpperCase() || null,
                isActive: true,
            },
        });

        // Log d'audit
        await prisma.auditLog.create({
            data: {
                organizationId,
                userId: session.user.id!,
                userRole: membership.role,
                action: 'CREATE_SITE',
                niveauAction: 'MODIFICATION',
                entityType: 'Site',
                entityId: site.id,
                phase: 0, // Configuration
                isForced: false,
                previousState: null,
                newState: {
                    name: site.name,
                    uaiCode: site.uaiCode,
                    address: site.address,
                },
            },
        });

        // Réponse avec warnings éventuels
        return NextResponse.json({
            success: true,
            site,
            warnings: complianceResult.warnings,
        });

    } catch (error) {
        console.error('[API Sites] Erreur création:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

// GET - Lister les sites d'une organisation
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organizationId');

        if (!organizationId) {
            return NextResponse.json(
                { error: 'organizationId requis' },
                { status: 400 }
            );
        }

        // Vérifier l'accès
        const membership = session.user.memberships?.find(
            m => m.organizationId === organizationId
        );

        if (!membership) {
            return NextResponse.json(
                { error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Récupérer les sites
        // Si scope RESTRICTED, filtrer par siteAccess
        let siteIds: string[] | undefined;
        if (membership.scope === 'RESTRICTED' && membership.accessibleSites) {
            siteIds = membership.accessibleSites.map(s => s.siteId);
        }

        const sites = await prisma.site.findMany({
            where: {
                organizationId,
                isActive: true,
                ...(siteIds && { id: { in: siteIds } }),
            },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { dossiers: true },
                },
            },
        });

        return NextResponse.json({ sites });

    } catch (error) {
        console.error('[API Sites] Erreur liste:', error);
        return NextResponse.json(
            { error: 'Erreur interne du serveur' },
            { status: 500 }
        );
    }
}

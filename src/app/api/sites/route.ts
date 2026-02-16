/**
 * API ROUTE: Sites Management
 * ===========================
 * GET /api/sites - Lister les sites (agrégateur cross-org)
 * 
 * NOTE: La création de sites se fait via POST /api/organizations/[id]/sites
 * (endpoint canonique avec validation compliance + audit log).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET - Lister les sites d'une organisation ou de toutes les organisations
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

        // Si organizationId fourni, filtrer par cette organisation
        if (organizationId) {
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
                siteIds = membership.accessibleSites.map(s => s.id);
            }

            const sites = await prisma.site.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    ...(siteIds && { id: { in: siteIds } }),
                },
                orderBy: { name: 'asc' },
                include: {
                    organization: {
                        select: { id: true, name: true, type: true },
                    },
                    _count: {
                        select: { dossiers: true },
                    },
                },
            });

            return NextResponse.json({ sites });
        }

        // Sans organizationId, retourner tous les sites de toutes les organisations de l'utilisateur
        const memberOrgIds = session.user.memberships?.map(m => m.organizationId) || [];

        if (memberOrgIds.length === 0) {
            return NextResponse.json({ sites: [] });
        }

        const sites = await prisma.site.findMany({
            where: {
                organizationId: { in: memberOrgIds },
                isActive: true,
            },
            orderBy: [
                { organization: { name: 'asc' } },
                { name: 'asc' },
            ],
            include: {
                organization: {
                    select: { id: true, name: true, type: true },
                },
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

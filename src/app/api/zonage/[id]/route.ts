/**
 * API ZONAGE/[id] - Modifier/Supprimer un mapping
 * ==================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: { id: string };
}

/**
 * PUT /api/zonage/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;

        const existing = await prisma.zoneMapping.findFirst({
            where: { id: params.id, organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 });
        }

        const body = await request.json();
        const { prefix, siteId, label, isActive } = body;

        const data: Record<string, unknown> = {};
        if (prefix !== undefined) {
            const cleanPrefix = prefix.replace(/\s/g, '').trim();
            if (!/^\d{1,5}$/.test(cleanPrefix)) {
                return NextResponse.json({ error: 'Le préfixe doit contenir 1 à 5 chiffres' }, { status: 400 });
            }
            // Vérifier unicité si changement de préfixe
            if (cleanPrefix !== existing.prefix) {
                const dup = await prisma.zoneMapping.findUnique({
                    where: { organizationId_prefix: { organizationId, prefix: cleanPrefix } },
                });
                if (dup) {
                    return NextResponse.json({ error: `Le préfixe "${cleanPrefix}" est déjà mappé` }, { status: 409 });
                }
            }
            data.prefix = cleanPrefix;
        }
        if (siteId !== undefined) {
            const site = await prisma.site.findFirst({ where: { id: siteId, organizationId } });
            if (!site) return NextResponse.json({ error: 'Site non trouvé' }, { status: 404 });
            data.siteId = siteId;
        }
        if (label !== undefined) data.label = label;
        if (isActive !== undefined) data.isActive = isActive;

        const zone = await prisma.zoneMapping.update({
            where: { id: params.id },
            data,
            include: {
                site: { select: { id: true, name: true, city: true } },
            },
        });

        return NextResponse.json({ zone });
    } catch (error) {
        console.error('Erreur PUT /api/zonage/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * DELETE /api/zonage/[id]
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const existing = await prisma.zoneMapping.findFirst({
            where: { id: params.id, organizationId: session.user.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 });
        }

        await prisma.zoneMapping.delete({ where: { id: params.id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/zonage/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

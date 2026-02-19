/**
 * API ZONAGE - CRUD des mappings CP → Agence
 * =============================================
 * GET  - Liste les zones avec le nom du site
 * POST - Créer un mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/zonage
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const zones = await prisma.zoneMapping.findMany({
            where: { organizationId: session.user.organizationId },
            include: {
                site: { select: { id: true, name: true, city: true } },
            },
            orderBy: [{ prefix: 'asc' }],
        });

        return NextResponse.json({ zones });
    } catch (error) {
        console.error('Erreur GET /api/zonage:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/zonage
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { prefix, siteId, label } = body;

        if (!prefix || !siteId) {
            return NextResponse.json({ error: 'Préfixe et agence requis' }, { status: 400 });
        }

        // Valider le préfixe : chiffres uniquement, 1-5 caractères
        const cleanPrefix = prefix.replace(/\s/g, '').trim();
        if (!/^\d{1,5}$/.test(cleanPrefix)) {
            return NextResponse.json({ error: 'Le préfixe doit contenir 1 à 5 chiffres' }, { status: 400 });
        }

        // Vérifier que le site appartient à l'org
        const site = await prisma.site.findFirst({
            where: { id: siteId, organizationId },
        });
        if (!site) {
            return NextResponse.json({ error: 'Site non trouvé' }, { status: 404 });
        }

        // Vérifier l'unicité
        const existing = await prisma.zoneMapping.findUnique({
            where: { organizationId_prefix: { organizationId, prefix: cleanPrefix } },
        });
        if (existing) {
            return NextResponse.json({ error: `Le préfixe "${cleanPrefix}" est déjà mappé` }, { status: 409 });
        }

        const zone = await prisma.zoneMapping.create({
            data: {
                organizationId,
                siteId,
                prefix: cleanPrefix,
                label: label || null,
            },
            include: {
                site: { select: { id: true, name: true, city: true } },
            },
        });

        return NextResponse.json({ zone }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/zonage:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

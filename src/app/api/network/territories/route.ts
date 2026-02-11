/**
 * API — Territories CRUD
 * ========================
 * GET:  Liste des territoires d'une organisation
 * POST: Créer un nouveau territoire
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────

const createTerritorySchema = z.object({
    organizationId: z.string().min(1),
    name: z.string().min(2, 'Nom requis'),
    zipCodes: z.array(z.string().min(4)).min(1, 'Au moins un code postal requis'),
    isExclusive: z.boolean().default(true),
});

// ─── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const organizationId = req.nextUrl.searchParams.get('organizationId');

    const territories = await prisma.territory.findMany({
        where: organizationId ? { organizationId } : undefined,
        include: {
            organization: {
                select: { id: true, name: true, networkType: true },
            },
        },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(territories);
}

// ─── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createTerritorySchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation échouée', details: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    // Vérifier les chevauchements si exclusif
    if (parsed.data.isExclusive) {
        const overlapping = await prisma.territory.findMany({
            where: {
                isActive: true,
                isExclusive: true,
                zipCodes: { hasSome: parsed.data.zipCodes },
                organizationId: { not: parsed.data.organizationId },
            },
            select: {
                name: true,
                zipCodes: true,
                organization: { select: { name: true } },
            },
        });

        if (overlapping.length > 0) {
            const conflicts = overlapping.map(
                (t) => `"${t.name}" (${t.organization.name})`
            );
            return NextResponse.json(
                {
                    error: 'Chevauchement territorial exclusif détecté',
                    conflicts,
                },
                { status: 409 }
            );
        }
    }

    const territory = await prisma.territory.create({
        data: {
            organizationId: parsed.data.organizationId,
            name: parsed.data.name,
            zipCodes: parsed.data.zipCodes,
            isExclusive: parsed.data.isExclusive,
        },
    });

    return NextResponse.json(territory, { status: 201 });
}

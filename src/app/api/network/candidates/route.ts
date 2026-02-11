/**
 * API — Franchise Candidates CRUD
 * =================================
 * GET:  Liste des candidats d'un réseau
 * POST: Créer un nouveau candidat
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Validation ───────────────────────────────────────────────

const createCandidateSchema = z.object({
    organizationId: z.string().min(1),
    companyName: z.string().min(2, 'Raison sociale requise'),
    email: z.string().email('Email invalide'),
    phone: z.string().optional(),
    representantNom: z.string().min(1, 'Nom requis'),
    representantPrenom: z.string().min(1, 'Prénom requis'),
    franchiseType: z.enum(['OF', 'CFA']).default('OF'),
    targetZone: z.string().optional(),
    targetZipCodes: z.array(z.string()).default([]),
    investmentBudget: z.number().positive().optional(),
    notes: z.string().optional(),
});

// ─── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
        return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
    }

    const candidates = await prisma.franchiseCandidate.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(candidates);
}

// ─── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createCandidateSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation échouée', details: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    const candidate = await prisma.franchiseCandidate.create({
        data: {
            organizationId: parsed.data.organizationId,
            companyName: parsed.data.companyName,
            email: parsed.data.email,
            phone: parsed.data.phone || null,
            representantNom: parsed.data.representantNom,
            representantPrenom: parsed.data.representantPrenom,
            franchiseType: parsed.data.franchiseType as any,
            targetZone: parsed.data.targetZone || null,
            targetZipCodes: parsed.data.targetZipCodes,
            investmentBudget: parsed.data.investmentBudget ? new Decimal(parsed.data.investmentBudget) : null,
            notes: parsed.data.notes || null,
        },
    });

    return NextResponse.json(candidate, { status: 201 });
}

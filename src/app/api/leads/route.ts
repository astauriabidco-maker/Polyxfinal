/**
 * API LEADS - CRUD interne des leads (prospection)
 * ==================================================
 * GET  - Liste des leads avec filtres
 * POST - Créer un lead manuellement
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { LeadSource, LeadStatus } from '@prisma/client';

/**
 * GET /api/leads
 * Liste les leads de l'organisation avec filtres
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;
        const { searchParams } = new URL(request.url);

        // Filtres
        const source = searchParams.get('source') as LeadSource | null;
        const status = searchParams.get('status') as LeadStatus | null;
        const campaignId = searchParams.get('campaignId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const where: any = { organizationId };
        if (source) where.source = source;
        if (status) where.status = status;
        if (campaignId) where.campaignId = campaignId;

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                include: {
                    campaign: { select: { id: true, name: true, source: true } },
                    partner: { select: { id: true, companyName: true } },
                    leadConsent: { select: { consentGiven: true, legalBasis: true, anonymizedAt: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.lead.count({ where }),
        ]);

        // Stats rapides
        const stats = await prisma.lead.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });

        const sourceStats = await prisma.lead.groupBy({
            by: ['source'],
            where: { organizationId },
            _count: true,
        });

        return NextResponse.json({
            leads,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            stats: {
                byStatus: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
                bySource: sourceStats.reduce((acc, s) => ({ ...acc, [s.source]: s._count }), {}),
            },
        });
    } catch (error) {
        console.error('Erreur GET /api/leads:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/leads
 * Créer un lead manuellement
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { email, nom, prenom, telephone, formationSouhaitee, message, codePostal, ville, source, campaignId, score } = body;

        if (!email || !nom || !prenom) {
            return NextResponse.json({ error: 'Email, nom et prénom requis' }, { status: 400 });
        }

        const lead = await prisma.lead.create({
            data: {
                organizationId,
                email,
                nom,
                prenom,
                telephone,
                formationSouhaitee,
                message,
                codePostal,
                ville,
                source: source || 'MANUAL',
                campaignId,
                score,
            },
        });

        // Créer le consentement si saisie manuelle
        await prisma.leadConsent.create({
            data: {
                leadId: lead.id,
                consentGiven: true,
                consentText: 'Consentement recueilli lors de la saisie manuelle du lead.',
                consentMethod: 'manual_entry',
                legalBasis: 'legitimate_interest',
            },
        });

        return NextResponse.json({ success: true, lead }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/leads:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

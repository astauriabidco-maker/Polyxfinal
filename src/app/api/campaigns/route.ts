/**
 * API CAMPAIGNS - CRUD des campagnes publicitaires
 * ==================================================
 * GET  - Liste des campagnes
 * POST - Créer une campagne
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * GET /api/campaigns
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const campaigns = await prisma.campaign.findMany({
            where: { organizationId: session.user.organizationId },
            include: {
                _count: { select: { leads: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Enrichir avec les stats de leads
        const enriched = await Promise.all(campaigns.map(async (c) => {
            const statusCounts = await prisma.lead.groupBy({
                by: ['status'],
                where: { campaignId: c.id },
                _count: true,
            });

            return {
                ...c,
                leadsCount: c._count.leads,
                leadsConverted: statusCounts.find(s => s.status === 'CONVERTI')?._count || 0,
                conversionRate: c._count.leads > 0
                    ? Math.round((statusCounts.find(s => s.status === 'CONVERTI')?._count || 0) / c._count.leads * 100)
                    : 0,
            };
        }));

        return NextResponse.json({ campaigns: enriched });
    } catch (error) {
        console.error('Erreur GET /api/campaigns:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * POST /api/campaigns
 * Créer une campagne publicitaire
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { name, source, externalId, utmSource, utmMedium, utmCampaign, budget, startDate, endDate } = body;

        if (!name || !source) {
            return NextResponse.json({ error: 'name et source requis' }, { status: 400 });
        }

        // Générer un webhook secret
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        const campaign = await prisma.campaign.create({
            data: {
                organizationId: session.user.organizationId,
                name,
                source,
                externalId: externalId || null,
                utmSource: utmSource || null,
                utmMedium: utmMedium || null,
                utmCampaign: utmCampaign || null,
                budget: budget || null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                webhookSecret,
            },
        });

        return NextResponse.json({
            success: true,
            campaign,
            webhookUrl: `/api/leads/webhook/${source.replace('_ADS', '').toLowerCase()}?campaignId=${campaign.id}`,
            webhookSecret,
        }, { status: 201 });

    } catch (error) {
        console.error('Erreur POST /api/campaigns:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

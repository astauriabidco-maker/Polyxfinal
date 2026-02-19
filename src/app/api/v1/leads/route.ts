/**
 * API V1 LEADS - API publique pour les partenaires externes
 * ===========================================================
 * POST /api/v1/leads - Soumettre un lead
 * GET  /api/v1/leads - Lister ses leads soumis
 * 
 * Auth: Header X-API-Key
 * Rate limit: 100 req/min par key
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { autoDispatchLead } from '@/lib/prospection/lead-dispatch';

// Rate limiter en mémoire (simple)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(apiKeyPrefix: string, limit: number): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(apiKeyPrefix);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(apiKeyPrefix, { count: 1, resetAt: now + 60_000 });
        return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
}

/**
 * Authentifier un partenaire via API Key
 */
async function authenticatePartner(request: NextRequest) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return null;

    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const partner = await prisma.partner.findFirst({
        where: { apiKeyHash: hash, status: 'ACTIVE' },
    });

    return partner;
}

/**
 * POST /api/v1/leads
 * Soumettre un lead (partenaire externe)
 */
export async function POST(request: NextRequest) {
    try {
        const partner = await authenticatePartner(request);
        if (!partner) {
            return NextResponse.json(
                { error: 'API Key invalide ou partenaire inactif', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // Rate limiting
        if (!checkRateLimit(partner.apiKeyPrefix || partner.id, partner.rateLimit)) {
            return NextResponse.json(
                { error: 'Rate limit dépassé. Réessayez dans 1 minute.', code: 'RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        const body = await request.json();
        const { email, nom, prenom, telephone, formationSouhaitee, message, codePostal, ville, consentText, sourceRef } = body;

        // Validation
        if (!email || !nom || !prenom) {
            return NextResponse.json(
                { error: 'Champs requis: email, nom, prenom', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Email format basique
        if (!email.includes('@') || !email.includes('.')) {
            return NextResponse.json(
                { error: 'Format email invalide', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Vérifier le consentement
        if (!consentText) {
            return NextResponse.json(
                { error: 'Le champ consentText est requis (RGPD). Il doit contenir le texte du consentement que le prospect a accepté.', code: 'RGPD_CONSENT_REQUIRED' },
                { status: 400 }
            );
        }

        // Créer le lead
        const lead = await prisma.lead.create({
            data: {
                organizationId: partner.organizationId,
                source: 'PARTNER_API',
                sourceRef: sourceRef || null,
                partnerId: partner.id,
                email,
                nom,
                prenom,
                telephone: telephone || null,
                formationSouhaitee: formationSouhaitee || null,
                message: message || null,
                codePostal: codePostal || null,
                ville: ville || null,
            },
        });

        // Enregistrer le consentement RGPD
        await prisma.leadConsent.create({
            data: {
                leadId: lead.id,
                consentGiven: true,
                consentText,
                consentMethod: 'api_partner',
                legalBasis: 'contract',
                ipAddress: request.headers.get('x-forwarded-for') || null,
                userAgent: request.headers.get('user-agent') || null,
            },
        });

        // Auto-dispatch basé sur le code postal
        await autoDispatchLead(lead.id, partner.organizationId, codePostal);

        // Incrémenter le compteur
        await prisma.partner.update({
            where: { id: partner.id },
            data: { totalLeadsSubmitted: { increment: 1 } },
        });

        return NextResponse.json({
            success: true,
            data: {
                leadId: lead.id,
                status: lead.status,
                createdAt: lead.createdAt,
            },
        }, { status: 201 });

    } catch (error) {
        console.error('Erreur POST /api/v1/leads:', error);
        return NextResponse.json({ error: 'Erreur serveur', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

/**
 * GET /api/v1/leads
 * Lister les leads soumis par le partenaire (paginé)
 */
export async function GET(request: NextRequest) {
    try {
        const partner = await authenticatePartner(request);
        if (!partner) {
            return NextResponse.json(
                { error: 'API Key invalide ou partenaire inactif', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        if (!checkRateLimit(partner.apiKeyPrefix || partner.id, partner.rateLimit)) {
            return NextResponse.json(
                { error: 'Rate limit dépassé', code: 'RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where: { partnerId: partner.id },
                select: {
                    id: true,
                    status: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    createdAt: true,
                    convertedAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.lead.count({ where: { partnerId: partner.id } }),
        ]);

        return NextResponse.json({
            success: true,
            data: leads,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur GET /api/v1/leads:', error);
        return NextResponse.json({ error: 'Erreur serveur', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

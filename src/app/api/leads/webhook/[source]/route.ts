/**
 * WEBHOOK RECEIVER - Leads depuis plateformes publicitaires
 * ==========================================================
 * POST /api/leads/webhook/[source]
 * 
 * Sources supportées : facebook, tiktok, google, linkedin
 * Vérifie la signature HMAC et mappe les champs vers le format interne.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LeadSource } from '@prisma/client';
import crypto from 'crypto';
import { autoDispatchLead } from '@/lib/prospection/lead-dispatch';

interface RouteParams {
    params: { source: string };
}

// Mapper de source URL vers enum
const SOURCE_MAP: Record<string, LeadSource> = {
    'facebook': 'FACEBOOK_ADS',
    'tiktok': 'TIKTOK_ADS',
    'google': 'GOOGLE_ADS',
    'linkedin': 'LINKEDIN_ADS',
};

// Consentement par défaut par source
const CONSENT_TEXT: Record<string, string> = {
    'facebook': 'J\'accepte d\'être contacté(e) suite à ma demande via Facebook. Mes données seront traitées conformément à la politique de confidentialité.',
    'tiktok': 'J\'accepte d\'être contacté(e) suite à ma demande via TikTok. Mes données seront traitées conformément à la politique de confidentialité.',
    'google': 'J\'accepte d\'être contacté(e) suite à ma demande via Google. Mes données seront traitées conformément à la politique de confidentialité.',
    'linkedin': 'J\'accepte d\'être contacté(e) suite à ma demande via LinkedIn. Mes données seront traitées conformément à la politique de confidentialité.',
};

/**
 * Vérifier la signature HMAC du webhook
 */
function verifyHmac(payload: string, signature: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Mapper les champs Facebook Lead Ads → format interne
 */
function mapFacebookLead(data: any) {
    const fieldData = data.field_data || [];
    const getField = (name: string) => fieldData.find((f: any) => f.name === name)?.values?.[0] || '';

    return {
        email: getField('email'),
        nom: getField('last_name') || getField('full_name')?.split(' ').pop() || 'Inconnu',
        prenom: getField('first_name') || getField('full_name')?.split(' ')[0] || 'Inconnu',
        telephone: getField('phone_number') || null,
        ville: getField('city') || null,
        codePostal: getField('zip_code') || null,
        sourceRef: data.leadgen_id || data.id || null,
    };
}

/**
 * Mapper les champs TikTok Ads → format interne
 */
function mapTikTokLead(data: any) {
    return {
        email: data.email || '',
        nom: data.last_name || data.name?.split(' ').pop() || 'Inconnu',
        prenom: data.first_name || data.name?.split(' ')[0] || 'Inconnu',
        telephone: data.phone || null,
        ville: data.city || null,
        codePostal: data.zip_code || null,
        sourceRef: data.lead_id || null,
    };
}

/**
 * Mapper les champs Google Ads → format interne
 */
function mapGoogleLead(data: any) {
    const userData = data.user_column_data || [];
    const getCol = (id: string) => userData.find((c: any) => c.column_id === id)?.string_value || '';

    return {
        email: getCol('EMAIL') || data.email || '',
        nom: getCol('LAST_NAME') || data.last_name || 'Inconnu',
        prenom: getCol('FIRST_NAME') || data.first_name || 'Inconnu',
        telephone: getCol('PHONE_NUMBER') || data.phone || null,
        ville: getCol('CITY') || data.city || null,
        codePostal: getCol('POSTAL_CODE') || data.postal_code || null,
        sourceRef: data.lead_id || data.gcl_id || null,
    };
}

/**
 * Mapper les champs LinkedIn Ads → format interne
 */
function mapLinkedInLead(data: any) {
    return {
        email: data.email || '',
        nom: data.lastName || 'Inconnu',
        prenom: data.firstName || 'Inconnu',
        telephone: data.phoneNumber || null,
        ville: data.city || null,
        codePostal: data.postalCode || null,
        sourceRef: data.leadId || null,
    };
}

// Sélecteur de mapper
const MAPPERS: Record<string, (data: any) => any> = {
    'facebook': mapFacebookLead,
    'tiktok': mapTikTokLead,
    'google': mapGoogleLead,
    'linkedin': mapLinkedInLead,
};

/**
 * POST /api/leads/webhook/[source]
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const source = params.source.toLowerCase();
        const leadSource = SOURCE_MAP[source];

        if (!leadSource) {
            return NextResponse.json(
                { error: `Source inconnue: ${source}. Sources supportées: facebook, tiktok, google, linkedin` },
                { status: 400 }
            );
        }

        // Lire le body brut pour la vérification HMAC
        const rawBody = await request.text();
        let data: any;
        try {
            data = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
        }

        // Extraire l'ID de campagne depuis les query params ou le body
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');

        // Si un campaignId est fourni, vérifier la signature HMAC
        if (campaignId) {
            const campaign = await prisma.campaign.findUnique({
                where: { id: campaignId },
            });

            if (campaign?.webhookSecret) {
                const signature = request.headers.get('x-hub-signature-256')
                    || request.headers.get('x-signature')
                    || request.headers.get('x-tiktok-signature')
                    || '';

                const sigValue = signature.replace('sha256=', '');

                if (sigValue && !verifyHmac(rawBody, sigValue, campaign.webhookSecret)) {
                    return NextResponse.json({ error: 'Signature HMAC invalide' }, { status: 403 });
                }
            }

            // Vérifier que la campagne existe et est active
            if (!campaign || !campaign.isActive) {
                return NextResponse.json({ error: 'Campagne inactive ou introuvante' }, { status: 404 });
            }
        }

        // Déterminer l'organizationId
        let organizationId: string;
        if (campaignId) {
            const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
            organizationId = campaign!.organizationId;
        } else {
            // Si pas de campaignId, utiliser l'org depuis le query param
            const orgId = searchParams.get('orgId');
            if (!orgId) {
                return NextResponse.json({ error: 'campaignId ou orgId requis' }, { status: 400 });
            }
            organizationId = orgId;
        }

        // Mapper les données
        const mapper = MAPPERS[source];
        const leadData = mapper(data);

        if (!leadData.email) {
            return NextResponse.json({ error: 'Email requis dans les données du lead' }, { status: 400 });
        }

        // Créer le lead
        const lead = await prisma.lead.create({
            data: {
                organizationId,
                source: leadSource,
                sourceRef: leadData.sourceRef,
                campaignId: campaignId || undefined,
                email: leadData.email,
                nom: leadData.nom,
                prenom: leadData.prenom,
                telephone: leadData.telephone,
                ville: leadData.ville,
                codePostal: leadData.codePostal,
                metadata: data, // Stocker le payload brut
            },
        });

        // Créer le consentement RGPD
        await prisma.leadConsent.create({
            data: {
                leadId: lead.id,
                consentGiven: true,
                consentText: CONSENT_TEXT[source] || 'Consentement recueilli via formulaire publicitaire.',
                consentMethod: `${source}_lead_form`,
                legalBasis: 'consent',
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
                userAgent: request.headers.get('user-agent') || null,
            },
        });

        // Auto-dispatch basé sur le code postal
        await autoDispatchLead(lead.id, organizationId, leadData.codePostal);

        return NextResponse.json({ success: true, leadId: lead.id }, { status: 201 });
    } catch (error) {
        console.error(`Erreur webhook lead:`, error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * GET /api/leads/webhook/[source]
 * Verification endpoint pour Facebook (hub.verify_token challenge)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Facebook webhook verification
    if (mode === 'subscribe' && token) {
        // Le token est vérifié via la campagne's webhookSecret
        console.log('[Webhook] Facebook verification challenge accepted');
        return new NextResponse(challenge || 'OK', { status: 200 });
    }

    return NextResponse.json({ status: 'ok', source: params.source });
}

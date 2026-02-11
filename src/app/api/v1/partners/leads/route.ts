/**
 * EXTERNAL PARTNER LEAD INGESTION API
 * =====================================
 * POST /api/v1/partners/leads
 * 
 * Permet aux apporteurs d'affaires d'envoyer leurs leads.
 * Inclus: Auth par API Key, Validation RGPD, et Smart Routing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { dispatchLeadToFranchise } from '@/lib/prospection/dispatcher';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limiter';
import { calculateLeadScore } from '@/lib/prospection/lead-scoring';
import { logComplianceRejection, logPartnerAction } from '@/lib/prospection/partner-audit';
import { checkPartnerQualification } from '@/lib/prospection/partner-qualification';

// Schéma de validation conforme aux exigences de contrôle
const intakeSchema = z.object({
    // ─── Identité (obligatoire) ───
    nom: z.string().min(2, "Nom requis (min. 2 caractères)"),
    prenom: z.string().min(2, "Prénom requis (min. 2 caractères)"),
    email: z.string().email("Email invalide"),
    telephone: z.string().min(6, "Téléphone requis"),

    // ─── Adresse complète (obligatoire) ───
    adresse: z.string().min(3, "Adresse (rue) requise"),
    codePostal: z.string().length(5, "Code postal invalide (5 chiffres)"),
    ville: z.string().min(2, "Ville requise"),

    // ─── Formation (obligatoire) ───
    formationSouhaitee: z.string().min(2, "Formation souhaitée requise"),

    // ─── Métadonnées RGPD (obligatoire) ───
    sourceUrl: z.string().url("URL de collecte requise pour preuve Qualiopi"),
    consentDate: z.string().datetime("Date de consentement requise (ISO 8601)"),
    consentText: z.string().min(10, "Texte de consentement manquant (min. 10 caractères)"),

    // ─── Optionnels ───
    message: z.string().optional(),
    dateReponse: z.string().datetime().optional(),  // Date de réponse du lead (ISO 8601)
    externalId: z.string().optional(),               // ID interne partenaire pour le suivi
});

export async function POST(req: NextRequest) {
    try {
        // 1. Authentification Partenaire (API Key)
        const apiKey = req.headers.get('x-api-key');
        if (!apiKey) {
            return NextResponse.json({ error: 'X-API-KEY manquante' }, { status: 401 });
        }

        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const partner = await prisma.partner.findUnique({
            where: { apiKeyHash },
            include: { organization: true, qualification: true }
        });

        if (!partner || partner.status !== 'ACTIVE') {
            return NextResponse.json({
                error: 'Clé API invalide ou partenaire non activé. Vérifiez vos contrats.'
            }, { status: 403 });
        }

        // 1b. ── Guards conformité RGPD Art. 28 & Qualiopi ──────────
        // Vérification DPA (Data Processing Agreement) — obligatoire RGPD
        if (!partner.dpaSignedAt) {
            console.warn(`[Compliance] ⛔ Partner ${partner.companyName} (${partner.id}) — DPA non signé`);
            logComplianceRejection(partner.id, partner.organizationId, 'DPA non signé', 'COMPLIANCE_DPA_MISSING');
            return NextResponse.json({
                error: 'DPA non signé',
                code: 'COMPLIANCE_DPA_MISSING',
                message: 'Votre accord de traitement des données (DPA/RGPD Art. 28) n\'est pas signé. ' +
                    'Contactez l\'organisme pour régulariser avant d\'envoyer des leads.',
            }, { status: 403 });
        }

        // Vérification contrat signé
        if (!partner.contractSignedAt) {
            console.warn(`[Compliance] ⛔ Partner ${partner.companyName} (${partner.id}) — Contrat non signé`);
            logComplianceRejection(partner.id, partner.organizationId, 'Contrat non signé', 'COMPLIANCE_CONTRACT_MISSING');
            return NextResponse.json({
                error: 'Contrat non signé',
                code: 'COMPLIANCE_CONTRACT_MISSING',
                message: 'Aucun contrat de partenariat signé n\'est enregistré. ' +
                    'Veuillez finaliser la contractualisation avant d\'envoyer des leads.',
            }, { status: 403 });
        }

        // Vérification expiration contrat
        if (partner.contractExpiresAt && new Date(partner.contractExpiresAt) < new Date()) {
            console.warn(`[Compliance] ⛔ Partner ${partner.companyName} (${partner.id}) — Contrat expiré le ${partner.contractExpiresAt}`);
            logComplianceRejection(partner.id, partner.organizationId, `Contrat expiré le ${new Date(partner.contractExpiresAt).toLocaleDateString('fr-FR')}`, 'COMPLIANCE_CONTRACT_EXPIRED');
            return NextResponse.json({
                error: 'Contrat expiré',
                code: 'COMPLIANCE_CONTRACT_EXPIRED',
                message: `Votre contrat a expiré le ${new Date(partner.contractExpiresAt).toLocaleDateString('fr-FR')}. ` +
                    'Contactez l\'organisme pour le renouveler.',
            }, { status: 403 });
        }

        // 1c. ── Guard Qualiopi Ind. 17 & 26 ─────────────────────
        const qualiopiCheck = checkPartnerQualification(partner, partner.qualification);
        if (qualiopiCheck) {
            console.warn(`[Compliance] ⛔ Partner ${partner.companyName} (${partner.id}) — ${qualiopiCheck.code}`);
            logComplianceRejection(partner.id, partner.organizationId, qualiopiCheck.message, qualiopiCheck.code);
            return NextResponse.json({
                error: qualiopiCheck.message,
                code: qualiopiCheck.code,
            }, { status: 403 });
        }

        // 2. Rate Limiting (Sliding Window — 1h)
        const rl = checkRateLimit(`partner:${partner.id}`, partner.rateLimit);

        if (!rl.allowed) {
            console.warn(`[RateLimit] ⛔ Partner ${partner.companyName} (${partner.id}) — ${partner.rateLimit} req/h dépassé`);

            return NextResponse.json({
                error: 'Rate limit dépassé',
                limit: rl.limit,
                remaining: 0,
                retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000),
                message: `Votre quota de ${partner.rateLimit} requêtes/heure est épuisé. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)} secondes.`,
            }, {
                status: 429,
                headers: rateLimitHeaders(rl),
            });
        }

        // 3. Validation des données (Conformité)
        const body = await req.json();
        const result = intakeSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({
                error: 'Validation échouée',
                details: result.error.flatten().fieldErrors
            }, { status: 400 });
        }

        const data = result.data;

        // 4. Création du Lead & Consentement (Transaction Atomique)
        const finalLead = await prisma.$transaction(async (tx) => {
            // Créer le lead rattaché à l'organisation du partenaire (le siège)
            const lead = await tx.lead.create({
                data: {
                    organizationId: partner.organizationId,
                    partnerId: partner.id,
                    source: 'PARTNER_API',
                    sourceRef: data.externalId || null,
                    // Identité
                    nom: data.nom,
                    prenom: data.prenom,
                    email: data.email,
                    telephone: data.telephone,
                    // Adresse
                    adresse: data.adresse,
                    codePostal: data.codePostal,
                    ville: data.ville,
                    // Formation
                    formationSouhaitee: data.formationSouhaitee,
                    message: data.message,
                    // Date de réponse du lead
                    dateReponse: data.dateReponse ? new Date(data.dateReponse) : null,
                    // Métadonnées
                    metadata: {
                        sourceUrl: data.sourceUrl,
                        partnerName: partner.companyName,
                    },
                }
            });

            // Créer la preuve de consentement RGPD
            await tx.leadConsent.create({
                data: {
                    leadId: lead.id,
                    consentGiven: true,
                    consentText: data.consentText,
                    consentMethod: 'external_partner_api',
                    legalBasis: 'consent',
                    createdAt: new Date(data.consentDate),
                    ipAddress: req.headers.get('x-forwarded-for') || null
                }
            });

            // Incrémenter le compteur partenaire
            await tx.partner.update({
                where: { id: partner.id },
                data: { totalLeadsSubmitted: { increment: 1 } }
            });

            return lead;
        });

        // 5. Scoring qualité du lead (automatique)
        const scoreResult = await calculateLeadScore({
            email: data.email,
            telephone: data.telephone,
            adresse: data.adresse,
            codePostal: data.codePostal,
            ville: data.ville,
            formationSouhaitee: data.formationSouhaitee,
            consentText: data.consentText,
            sourceUrl: data.sourceUrl,
            dateReponse: data.dateReponse || null,
            organizationId: partner.organizationId,
        });

        // Mettre à jour le score du lead en base
        await prisma.lead.update({
            where: { id: finalLead.id },
            data: { score: scoreResult.score },
        });

        // 6. Smart Routing (Automatique)
        // On tente de router le lead vers un franchisé si le siège a des territoires définis
        const routingResult = await dispatchLeadToFranchise(finalLead.id, data.codePostal);

        // 7. Audit trail — traçabilité ingestion réussie (Qualiopi Ind. 17)
        logPartnerAction({
            partnerId: partner.id,
            organizationId: partner.organizationId,
            action: 'CREATED',
            details: `Lead ${finalLead.id} ingéré — Score: ${scoreResult.score}/100 (${scoreResult.grade})` +
                (routingResult.matched ? ` — Routé vers ${routingResult.targetOrgName}` : ' — Conservé au siège'),
            newValue: {
                leadId: finalLead.id,
                score: scoreResult.score,
                grade: scoreResult.grade,
                dispatched: routingResult.matched,
                targetOrg: routingResult.targetOrgName,
            },
        });

        return NextResponse.json({
            success: true,
            leadId: finalLead.id,
            dispatched: routingResult.matched,
            targetOrg: routingResult.targetOrgName,
            status: 'RECEIVED',
            quality: {
                score: scoreResult.score,
                grade: scoreResult.grade,
            },
        }, {
            status: 201,
            headers: rateLimitHeaders(rl),
        });

    } catch (error) {
        console.error('[API Partners Lead] Error:', error);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}

/**
 * API PARTNERS - Gestion des partenaires API
 * =============================================
 * GET  /api/partners  — Liste des partenaires de l'organisation
 * POST /api/partners  — Crée un partenaire (PENDING) + envoie email d'onboarding
 * 
 * WORKFLOW COMPLET :
 *   1. Admin crée le partenaire → statut PENDING (pas de clé API)
 *   2. Email d'onboarding envoyé au partenaire avec lien de signature
 *   3. Partenaire signe le Contrat + DPA sur /partners/onboarding/[id]
 *   4. Admin active le partenaire → clé API générée (PUT /api/partners/[id])
 *   5. Email d'activation envoyé avec la clé API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logPartnerAction } from '@/lib/prospection/partner-audit';

// ─── Validation Schema ───────────────────────────────────────

const createPartnerSchema = z.object({
    // Identification personne morale (obligatoires)
    companyName: z
        .string()
        .min(2, 'Raison sociale requise (min 2 caractères)')
        .max(200, 'Raison sociale trop longue'),
    formeJuridique: z
        .string()
        .max(50, 'Forme juridique trop longue')
        .optional()
        .or(z.literal('')),
    capitalSocial: z
        .number()
        .min(0, 'Le capital ne peut pas être négatif')
        .optional(),
    siret: z
        .string()
        .regex(/^[0-9]{14}$/, 'SIRET invalide (14 chiffres)')
        .optional()
        .or(z.literal('')),
    codeNAF: z
        .string()
        .max(10, 'Code NAF trop long')
        .optional()
        .or(z.literal('')),
    rcs: z
        .string()
        .max(100, 'RCS trop long')
        .optional()
        .or(z.literal('')),
    tvaIntracom: z
        .string()
        .max(20, 'N° TVA trop long')
        .optional()
        .or(z.literal('')),

    // Adresse du siège social
    adresse: z
        .string()
        .max(300, 'Adresse trop longue')
        .optional()
        .or(z.literal('')),
    complementAdresse: z
        .string()
        .max(200, 'Complément trop long')
        .optional()
        .or(z.literal('')),
    codePostal: z
        .string()
        .max(10, 'Code postal trop long')
        .optional()
        .or(z.literal('')),
    ville: z
        .string()
        .max(100, 'Ville trop longue')
        .optional()
        .or(z.literal('')),
    pays: z
        .string()
        .max(100, 'Pays trop long')
        .optional(),

    // Représentant légal
    representantNom: z
        .string()
        .max(150, 'Nom trop long')
        .optional()
        .or(z.literal('')),
    representantFonction: z
        .string()
        .max(100, 'Fonction trop longue')
        .optional()
        .or(z.literal('')),

    // Contact opérationnel (obligatoires)
    contactName: z
        .string()
        .min(2, 'Nom du contact requis')
        .max(100, 'Nom du contact trop long'),
    contactEmail: z
        .string()
        .email('Format email invalide'),
    contactPhone: z
        .string()
        .max(20, 'Téléphone trop long')
        .optional()
        .or(z.literal('')),

    // Coordonnées bancaires
    iban: z
        .string()
        .max(34, 'IBAN trop long')
        .optional()
        .or(z.literal('')),
    bic: z
        .string()
        .max(11, 'BIC trop long')
        .optional()
        .or(z.literal('')),

    // Technique
    rateLimit: z
        .number()
        .int()
        .min(1, 'Minimum 1 requête/heure')
        .max(10000, 'Maximum 10 000 requêtes/heure')
        .optional(),
    webhookUrl: z
        .string()
        .url('URL webhook invalide')
        .optional()
        .or(z.literal('')),

    // Contrat
    commissionRate: z
        .number()
        .min(0, 'Le taux ne peut pas être négatif')
        .max(100, 'Le taux ne peut pas dépasser 100%')
        .optional(),
    costPerLead: z
        .number()
        .min(0, 'Le coût ne peut pas être négatif')
        .max(9999, 'Coût par lead trop élevé')
        .optional(),
    notes: z
        .string()
        .max(2000, 'Notes trop longues')
        .optional()
        .or(z.literal('')),
});

// ─── Helpers ──────────────────────────────────────────────────

/** Extraire le SIREN depuis le SIRET (9 premiers chiffres) */
function extractSiren(siret: string): string {
    return siret.substring(0, 9);
}

// ─── GET: Liste des partenaires ──────────────────────────────

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role } = session.user;

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès refusé. Rôle ADMIN ou RESP_ADMIN requis.' },
                { status: 403 }
            );
        }

        const partners = await prisma.partner.findMany({
            where: { organizationId },
            include: {
                _count: { select: { leads: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            partners: partners.map((p) => ({
                id: p.id,
                // Identification
                companyName: p.companyName,
                formeJuridique: p.formeJuridique,
                capitalSocial: p.capitalSocial ? Number(p.capitalSocial) : null,
                siret: p.siret,
                siren: p.siren,
                codeNAF: p.codeNAF,
                rcs: p.rcs,
                tvaIntracom: p.tvaIntracom,
                // Adresse
                adresse: p.adresse,
                complementAdresse: p.complementAdresse,
                codePostal: p.codePostal,
                ville: p.ville,
                pays: p.pays,
                // Représentant légal
                representantNom: p.representantNom,
                representantFonction: p.representantFonction,
                // Contact
                contactName: p.contactName,
                contactEmail: p.contactEmail,
                contactPhone: p.contactPhone,
                // Bancaire
                iban: p.iban,
                bic: p.bic,
                // API
                apiKeyPrefix: p.apiKeyPrefix,
                rateLimit: p.rateLimit,
                webhookUrl: p.webhookUrl,
                // Contrat
                contractUrl: p.contractUrl,
                contractSignedAt: p.contractSignedAt,
                contractExpiresAt: p.contractExpiresAt,
                dpaSignedAt: p.dpaSignedAt,
                ndaSignedAt: p.ndaSignedAt,
                commissionRate: p.commissionRate ? Number(p.commissionRate) : null,
                costPerLead: p.costPerLead ? Number(p.costPerLead) : null,
                notes: p.notes,
                // Métriques
                status: p.status,
                totalLeadsSubmitted: p.totalLeadsSubmitted,
                totalLeadsConverted: p.totalLeadsConverted,
                leadsCount: p._count.leads,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            })),
        });
    } catch (error) {
        console.error('[API Partners GET] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// ─── POST: Création d'un partenaire (PENDING, sans clé API) ──

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id: userId, organizationId, role, nom, prenom } = session.user;

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès refusé. Rôle ADMIN ou RESP_ADMIN requis.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const parsed = createPartnerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Vérifier unicité email contact dans l'org
        const existingPartner = await prisma.partner.findFirst({
            where: { organizationId, contactEmail: data.contactEmail },
        });

        if (existingPartner) {
            return NextResponse.json(
                { error: `Un partenaire avec l'email "${data.contactEmail}" existe déjà.` },
                { status: 409 }
            );
        }

        // Extraire SIREN du SIRET si fourni
        const siren = data.siret ? extractSiren(data.siret) : null;

        // ╔══════════════════════════════════════════════════════════╗
        // ║  PAS DE CLÉ API à la création !                        ║
        // ║  La clé sera générée à l'activation (PUT [id])         ║
        // ║  après signature du Contrat + DPA par le partenaire.   ║
        // ╚══════════════════════════════════════════════════════════╝

        const partner = await prisma.partner.create({
            data: {
                organizationId,
                // Identification
                companyName: data.companyName,
                formeJuridique: data.formeJuridique || null,
                capitalSocial: data.capitalSocial ?? null,
                siret: data.siret || null,
                siren,
                codeNAF: data.codeNAF || null,
                rcs: data.rcs || null,
                tvaIntracom: data.tvaIntracom || null,
                // Adresse
                adresse: data.adresse || null,
                complementAdresse: data.complementAdresse || null,
                codePostal: data.codePostal || null,
                ville: data.ville || null,
                pays: data.pays || 'France',
                // Représentant légal
                representantNom: data.representantNom || null,
                representantFonction: data.representantFonction || null,
                // Contact
                contactName: data.contactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone || null,
                // Bancaire
                iban: data.iban || null,
                bic: data.bic || null,
                // API — null à la création, rempli à l'activation
                apiKeyHash: null,
                apiKeyPrefix: null,
                rateLimit: data.rateLimit || 100,
                webhookUrl: data.webhookUrl || null,
                // Contrat
                commissionRate: data.commissionRate ?? null,
                costPerLead: data.costPerLead ?? null,
                notes: data.notes || null,
                status: 'PENDING',
            },
        });

        // Audit LOG
        await prisma.auditLog.create({
            data: {
                organizationId,
                userId,
                userRole: role,
                action: 'PARTNER_CREATE',
                niveauAction: 'CREATION',
                entityType: 'Partner',
                entityId: partner.id,
                newState: {
                    companyName: data.companyName,
                    siret: data.siret || null,
                    contactEmail: data.contactEmail,
                    representantNom: data.representantNom || null,
                    status: 'PENDING',
                    createdBy: `${prenom} ${nom}`,
                },
                ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
            },
        });

        // Partner-specific Audit LOG (Qualiopi Ind. 17/26)
        logPartnerAction({
            partnerId: partner.id,
            organizationId,
            action: 'CREATED',
            performedBy: userId,
            performedByName: `${prenom} ${nom}`,
            details: `Partenaire "${data.companyName}" créé en statut PENDING`,
            newValue: {
                companyName: data.companyName,
                siret: data.siret || null,
                contactEmail: data.contactEmail,
                status: 'PENDING',
            },
            ipAddress: request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
        });

        // 📧 Envoi de l'email d'onboarding au partenaire
        try {
            const { sendTransactionalEmail } = await import('@/lib/notifications/email');
            await sendTransactionalEmail({
                to: data.contactEmail,
                subject: `Partenariat Polyx — Documents à signer`,
                template: 'PARTNER_ONBOARDING',
                data: {
                    partnerId: partner.id,
                    contactName: data.contactName,
                    companyName: data.companyName,
                },
            });
            console.log(`[Partners] 📧 Email d'onboarding envoyé à ${data.contactEmail}`);
        } catch (emailError) {
            console.error('[Partners] ⚠️ Échec envoi email onboarding:', emailError);
            // On ne bloque pas la création si l'email échoue
        }

        console.log(
            `[Partners] ${prenom} ${nom}: Partenaire "${data.companyName}" créé en PENDING (${partner.id})`
        );

        return NextResponse.json(
            {
                success: true,
                partner: {
                    id: partner.id,
                    companyName: partner.companyName,
                    formeJuridique: partner.formeJuridique,
                    siret: partner.siret,
                    contactName: partner.contactName,
                    contactEmail: partner.contactEmail,
                    status: partner.status,
                    createdAt: partner.createdAt,
                },
                message:
                    `✅ Partenaire créé avec succès. Un email d'onboarding a été envoyé à ${data.contactEmail} pour la signature du Contrat et du DPA.`,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[API Partners POST] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

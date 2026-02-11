/**
 * API PARTNERS/[ID] - Gestion d'un partenaire spécifique
 * ========================================================
 * PUT    - Modifier statut (ACTIVATE, SUSPEND, TERMINATE) + régénérer clé
 * DELETE - Résilier le partenariat (soft delete → TERMINATED)
 * 
 * WORKFLOW D'ACTIVATION :
 *   Pré-requis : Contrat ET DPA signés par le partenaire
 *   → Génère la clé API (SHA-256 hash)
 *   → Passe le statut à ACTIVE
 *   → Envoie la clé par email au partenaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { logPartnerAction } from '@/lib/prospection/partner-audit';

interface RouteParams {
    params: { id: string };
}

// ─── Helpers ──────────────────────────────────────────────────

function generateApiKey(): { plainKey: string; hash: string; prefix: string } {
    const randomPart = crypto.randomBytes(32).toString('hex');
    const plainKey = `pk_live_${randomPart}`;
    const hash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const prefix = `pk_live_${randomPart.substring(0, 8)}...`;
    return { plainKey, hash, prefix };
}

// ─── PUT: Mettre à jour un partenaire ────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id: userId, organizationId, role, nom, prenom } = session.user;

        // RBAC : ADMIN ou RESP_ADMIN requis
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès refusé. Rôle ADMIN ou RESP_ADMIN requis.' },
                { status: 403 }
            );
        }

        const partnerId = params.id;
        const body = await request.json();

        // Vérifier que le partenaire appartient à l'organisation
        const existing = await prisma.partner.findFirst({
            where: { id: partnerId, organizationId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        // ╔══════════════════════════════════════════════════════╗
        // ║  ACTION : Régénérer la clé API                      ║
        // ╚══════════════════════════════════════════════════════╝
        if (body.action === 'regenerate-key') {
            if (existing.status !== 'ACTIVE') {
                return NextResponse.json(
                    { error: 'Seul un partenaire ACTIF peut avoir sa clé régénérée.' },
                    { status: 400 }
                );
            }

            const { plainKey, hash, prefix } = generateApiKey();

            await prisma.partner.update({
                where: { id: partnerId },
                data: { apiKeyHash: hash, apiKeyPrefix: prefix },
            });

            // Audit
            await prisma.auditLog.create({
                data: {
                    organizationId, userId, userRole: role,
                    action: 'PARTNER_REGEN_KEY',
                    niveauAction: 'EDITION',
                    entityType: 'Partner',
                    entityId: partnerId,
                    newState: {
                        apiKeyPrefix: prefix,
                        regeneratedBy: `${prenom} ${nom}`,
                    },
                    ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
                },
            });

            console.log(`[Partners] 🔑 Clé régénérée pour "${existing.companyName}" par ${prenom} ${nom}`);

            logPartnerAction({
                partnerId,
                organizationId,
                action: 'API_KEY_GENERATED',
                performedBy: userId,
                performedByName: `${prenom} ${nom}`,
                details: `Clé API régénérée pour "${existing.companyName}"`,
                previousValue: { apiKeyPrefix: existing.apiKeyPrefix },
                newValue: { apiKeyPrefix: prefix },
                ipAddress: request.headers.get('x-forwarded-for'),
                userAgent: request.headers.get('user-agent'),
            });

            return NextResponse.json({
                success: true,
                apiKey: plainKey,
                apiKeyPrefix: prefix,
                warning: '⚠️ Nouvelle clé API générée. L\'ancienne est désormais invalide. Copiez-la maintenant.',
            });
        }

        // ╔══════════════════════════════════════════════════════╗
        // ║  ACTION : Renvoyer l'email d'onboarding             ║
        // ╚══════════════════════════════════════════════════════╝
        if (body.action === 'resend-onboarding') {
            if (existing.status !== 'PENDING') {
                return NextResponse.json(
                    { error: 'L\'email d\'onboarding ne peut être renvoyé que pour un partenaire PENDING.' },
                    { status: 400 }
                );
            }

            try {
                const { sendTransactionalEmail } = await import('@/lib/notifications/email');
                await sendTransactionalEmail({
                    to: existing.contactEmail,
                    subject: `Partenariat Polyx — Documents à signer (rappel)`,
                    template: 'PARTNER_ONBOARDING',
                    data: {
                        partnerId: existing.id,
                        contactName: existing.contactName,
                        companyName: existing.companyName,
                    },
                });
            } catch (emailError) {
                console.error('[Partners] ⚠️ Échec renvoi email:', emailError);
            }

            console.log(`[Partners] 📧 Email d'onboarding renvoyé à ${existing.contactEmail}`);

            return NextResponse.json({
                success: true,
                message: `Email d'onboarding renvoyé à ${existing.contactEmail}`,
            });
        }

        // ╔══════════════════════════════════════════════════════╗
        // ║  MISE À JOUR DE STATUT                              ║
        // ╚══════════════════════════════════════════════════════╝
        const updateData: Record<string, unknown> = {};
        let generatedApiKey: string | undefined;

        if (body.status) {
            // ── ACTIVATION ───────────────────────────────────
            if (body.status === 'ACTIVE') {
                // COMPLIANCE GATE : Contrat + DPA obligatoires
                if (!existing.contractSignedAt || !existing.dpaSignedAt) {
                    return NextResponse.json({
                        error: 'Conformité incomplète. Le Contrat et le DPA doivent être signés par le partenaire avant activation.',
                        details: {
                            contractSigned: !!existing.contractSignedAt,
                            dpaSigned: !!existing.dpaSignedAt,
                        },
                    }, { status: 403 });
                }

                // Générer la clé API UNIQUEMENT à la première activation
                if (!existing.apiKeyHash) {
                    const key = generateApiKey();
                    generatedApiKey = key.plainKey;
                    updateData.apiKeyHash = key.hash;
                    updateData.apiKeyPrefix = key.prefix;
                }
            }

            // ── SUSPENSION ───────────────────────────────────
            if (body.status === 'SUSPENDED' && existing.status !== 'ACTIVE') {
                return NextResponse.json(
                    { error: 'Seul un partenaire ACTIF peut être suspendu.' },
                    { status: 400 }
                );
            }

            updateData.status = body.status;
        }

        // Champs éditables
        if (body.contractUrl !== undefined) updateData.contractUrl = body.contractUrl;
        if (body.contractExpiresAt !== undefined) updateData.contractExpiresAt = body.contractExpiresAt ? new Date(body.contractExpiresAt) : null;
        if (body.rateLimit !== undefined) updateData.rateLimit = body.rateLimit;
        if (body.commissionRate !== undefined) updateData.commissionRate = body.commissionRate;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.webhookUrl !== undefined) updateData.webhookUrl = body.webhookUrl;

        const partner = await prisma.partner.update({
            where: { id: partnerId },
            data: updateData,
        });

        // Audit LOG
        await prisma.auditLog.create({
            data: {
                organizationId, userId, userRole: role,
                action: body.status === 'ACTIVE' ? 'PARTNER_ACTIVATE' : body.status === 'SUSPENDED' ? 'PARTNER_SUSPEND' : 'PARTNER_UPDATE',
                niveauAction: body.status ? 'VALIDATION' : 'EDITION',
                entityType: 'Partner',
                entityId: partnerId,
                newState: {
                    status: partner.status,
                    updatedBy: `${prenom} ${nom}`,
                    ...(generatedApiKey ? { apiKeyGenerated: true, apiKeyPrefix: partner.apiKeyPrefix } : {}),
                },
                ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
            },
        });

        // Partner-specific Audit LOG (Qualiopi Ind. 17/26)
        const auditAction = body.status === 'ACTIVE' ? 'ACTIVATED'
            : body.status === 'SUSPENDED' ? 'SUSPENDED'
                : body.status ? 'STATUS_CHANGED'
                    : 'UPDATED';
        logPartnerAction({
            partnerId,
            organizationId,
            action: auditAction as any,
            performedBy: userId,
            performedByName: `${prenom} ${nom}`,
            details: body.status
                ? `Statut changé : ${existing.status} → ${partner.status}`
                : `Mise à jour du partenaire "${existing.companyName}"`,
            previousValue: {
                status: existing.status,
                rateLimit: existing.rateLimit,
                commissionRate: existing.commissionRate?.toString() ?? null,
            },
            newValue: {
                status: partner.status,
                ...(generatedApiKey ? { apiKeyGenerated: true } : {}),
                ...(body.rateLimit !== undefined ? { rateLimit: body.rateLimit } : {}),
            },
            ipAddress: request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
        });

        // 📧 Email d'activation avec la clé API
        if (generatedApiKey) {
            try {
                const { sendTransactionalEmail } = await import('@/lib/notifications/email');
                await sendTransactionalEmail({
                    to: partner.contactEmail,
                    subject: 'Activation de votre accès API — Polyx ERP',
                    template: 'PARTNER_ACTIVATED',
                    data: {
                        contactName: partner.contactName,
                        apiKey: generatedApiKey,
                    },
                });
                console.log(`[Partners] 📧 Email d'activation envoyé à ${partner.contactEmail} avec clé API`);
            } catch (emailError) {
                console.error('[Partners] ⚠️ Échec envoi email activation:', emailError);
            }
        }

        const statusLabel: Record<string, string> = {
            'ACTIVE': '✅ Partenaire activé. La clé API a été générée et envoyée par email.',
            'SUSPENDED': '⚠️ Partenaire suspendu. L\'accès API est désactivé.',
            'TERMINATED': '❌ Partenariat résilié.',
        };

        console.log(
            `[Partners] ${prenom} ${nom}: "${existing.companyName}" → ${partner.status}`
        );

        return NextResponse.json({
            success: true,
            partner: {
                id: partner.id,
                companyName: partner.companyName,
                status: partner.status,
                apiKeyPrefix: partner.apiKeyPrefix,
                contractSignedAt: partner.contractSignedAt,
                dpaSignedAt: partner.dpaSignedAt,
            },
            // Renvoyer la clé UNIQUEMENT au dashboard une seule fois
            ...(generatedApiKey ? { apiKey: generatedApiKey } : {}),
            message: body.status ? (statusLabel[body.status] || 'Mise à jour réussie') : 'Mise à jour réussie',
        });
    } catch (error) {
        console.error('Erreur PUT /api/partners/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// ─── DELETE: Résilier un partenariat ─────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

        const partnerId = params.id;

        const existing = await prisma.partner.findFirst({
            where: { id: partnerId, organizationId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        await prisma.partner.update({
            where: { id: partnerId },
            data: { status: 'TERMINATED' },
        });

        // Audit
        await prisma.auditLog.create({
            data: {
                organizationId, userId, userRole: role,
                action: 'PARTNER_TERMINATE',
                niveauAction: 'SUPPRESSION',
                entityType: 'Partner',
                entityId: partnerId,
                newState: { status: 'TERMINATED', terminatedBy: `${prenom} ${nom}` },
                ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
            },
        });

        console.log(`[Partners] ${prenom} ${nom}: "${existing.companyName}" résilié`);

        logPartnerAction({
            partnerId,
            organizationId,
            action: 'DELETED',
            performedBy: userId,
            performedByName: `${prenom} ${nom}`,
            details: `Partenariat résilié pour "${existing.companyName}"`,
            previousValue: { status: existing.status, companyName: existing.companyName },
            newValue: { status: 'TERMINATED' },
            ipAddress: request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
        });

        return NextResponse.json({ success: true, message: '❌ Partenariat résilié.' });
    } catch (error) {
        console.error('Erreur DELETE /api/partners/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

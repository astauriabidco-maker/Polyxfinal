/**
 * API DROITS RGPD — Exercice des droits individuels
 * ====================================================
 * POST /api/rgpd/leads  — Exercer un droit RGPD sur un lead
 * 
 * Actions supportées :
 *   - export      : Portabilité des données (Art. 20)
 *   - erase       : Droit à l'effacement (Art. 17)
 *   - withdraw    : Retrait de consentement (Art. 7.3)
 * 
 * @Compliance: RGPD Art. 7.3, Art. 17, Art. 20
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { anonymizeLead, withdrawConsent, exportLeadData } from '@/lib/prospection/data-retention';
import { prisma } from '@/lib/prisma';

const rgpdActionSchema = z.object({
    leadId: z.string().min(1, 'ID du lead requis'),
    action: z.enum(['export', 'erase', 'withdraw'], {
        errorMap: () => ({ message: 'Action invalide. Valeurs: export, erase, withdraw' }),
    }),
    reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id: userId, organizationId, role, nom, prenom } = session.user;

        // RBAC : ADMIN ou RESP_ADMIN pour les actions RGPD
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Seuls les rôles ADMIN et RESP_ADMIN peuvent exercer les droits RGPD.' },
                { status: 403 },
            );
        }

        const body = await req.json();
        const parsed = rgpdActionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({
                error: 'Validation échouée',
                details: parsed.error.flatten().fieldErrors,
            }, { status: 400 });
        }

        const { leadId, action, reason } = parsed.data;

        // Vérifier que le lead appartient à l'organisation
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead non trouvé dans votre organisation' }, { status: 404 });
        }

        // ── EXPORT (Portabilité Art. 20) ──────────────────────
        if (action === 'export') {
            const data = await exportLeadData(leadId);
            if (!data) {
                return NextResponse.json({ error: 'Données non disponibles' }, { status: 404 });
            }

            console.log(`[RGPD] 📤 Export données lead ${leadId} par ${prenom} ${nom}`);

            return NextResponse.json({
                success: true,
                action: 'export',
                message: 'Données exportées conformément à l\'Art. 20 RGPD',
                data,
                exportDate: new Date().toISOString(),
                exportedBy: `${prenom} ${nom}`,
            });
        }

        // ── EFFACEMENT (Art. 17) ──────────────────────────────
        if (action === 'erase') {
            const motif = reason || `Demande d'effacement par ${prenom} ${nom}`;
            const result = await anonymizeLead(leadId, motif);

            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }

            // Audit de l'action RGPD
            await prisma.auditLog.create({
                data: {
                    organizationId,
                    userId,
                    userRole: role,
                    action: 'RGPD_ERASURE',
                    niveauAction: 'SUPPRESSION',
                    entityType: 'Lead',
                    entityId: leadId,
                    newState: {
                        action: 'erase',
                        reason: motif,
                        performedBy: `${prenom} ${nom}`,
                    },
                    ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
                },
            });

            return NextResponse.json({
                success: true,
                action: 'erase',
                message: `Lead anonymisé conformément à l'Art. 17 RGPD. Motif: ${motif}`,
            });
        }

        // ── RETRAIT DE CONSENTEMENT (Art. 7.3) ────────────────
        if (action === 'withdraw') {
            const result = await withdrawConsent(leadId);

            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }

            // Audit
            await prisma.auditLog.create({
                data: {
                    organizationId,
                    userId,
                    userRole: role,
                    action: 'RGPD_CONSENT_WITHDRAWAL',
                    niveauAction: 'EDITION',
                    entityType: 'Lead',
                    entityId: leadId,
                    newState: {
                        action: 'withdraw',
                        performedBy: `${prenom} ${nom}`,
                    },
                    ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
                },
            });

            return NextResponse.json({
                success: true,
                action: 'withdraw',
                message: 'Consentement retiré conformément à l\'Art. 7.3 RGPD. Le lead ne sera plus traité.',
            });
        }

        return NextResponse.json({ error: 'Action non supportée' }, { status: 400 });
    } catch (error) {
        console.error('[RGPD API] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

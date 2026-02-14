/**
 * API QUALIFICATION PARTENAIRE — Qualiopi Ind. 17 & 26
 * =====================================================
 * GET    /api/partners/qualification          — Stats globales
 * GET    /api/partners/qualification?id=xxx   — Score d'un partenaire
 * POST   /api/partners/qualification          — Évaluer / mettre à jour
 * 
 * Protégé par RBAC : ADMIN et RESP_ADMIN uniquement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
    evaluatePartner,
    evaluateAllPartners,
    updatePartnerDocuments,
    recordConvention,
    getQualificationStats,
    computeQualificationScore,
    setPrismaInstance,
} from '@/lib/prospection/partner-qualification';
import { logPartnerAction } from '@/lib/prospection/partner-audit';

// Initialiser Prisma pour le service
setPrismaInstance(prisma);

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role: roleObj } = session.user;
        const role = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code || 'UNKNOWN';
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Accès restreint' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const partnerId = searchParams.get('id');

        // Score d'un partenaire spécifique
        if (partnerId) {
            const partner = await prisma.partner.findUnique({
                where: { id: partnerId, organizationId },
                include: { qualification: true },
            });

            if (!partner) {
                return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
            }

            const result = computeQualificationScore(partner, partner.qualification);
            result.partnerId = partnerId;

            return NextResponse.json({
                success: true,
                qualification: result,
                documents: partner.qualification,
            });
        }

        // Stats globales
        const stats = await getQualificationStats(organizationId);

        // Liste détaillée de tous les partenaires avec leur score
        const partners = await prisma.partner.findMany({
            where: { organizationId, status: 'ACTIVE' },
            include: { qualification: true },
            orderBy: { companyName: 'asc' },
        });

        const partnerScores = partners.map(p => {
            const result = computeQualificationScore(p, p.qualification);
            result.partnerId = p.id;
            return result;
        });

        return NextResponse.json({
            success: true,
            stats,
            partners: partnerScores,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Qualification API] GET Error:', errMsg, error);
        return NextResponse.json({ error: 'Erreur serveur', details: errMsg }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role: roleObj } = session.user;
        const role = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code || 'UNKNOWN';
        const userName = `${session.user.prenom || ''} ${session.user.nom || ''}`.trim() || 'admin';
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Accès restreint' }, { status: 403 });
        }

        const body = await req.json();
        const { action, partnerId, data } = body;

        if (!partnerId) {
            return NextResponse.json({ error: 'partnerId requis' }, { status: 400 });
        }

        // Vérifier que le partenaire appartient à l'organisation
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId, organizationId },
        });
        if (!partner) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        switch (action) {
            case 'evaluate': {
                const result = await evaluatePartner(partnerId, userName || 'admin', data?.notes);

                // Audit trail
                logPartnerAction({
                    partnerId,
                    organizationId,
                    action: 'QUALIFICATION_EVALUATED',
                    performedBy: session.user.id,
                    performedByName: userName,
                    details: `Évaluation qualité : ${result.score}/100 (Grade ${result.grade})`,
                    newValue: { score: result.score, grade: result.grade, isQualified: result.isQualified },
                });

                return NextResponse.json({ success: true, qualification: result });
            }

            case 'evaluate-all': {
                const results = await evaluateAllPartners(organizationId);
                return NextResponse.json({
                    success: true,
                    evaluated: results.length,
                    results: results.map(r => ({
                        partnerId: r.partnerId,
                        companyName: r.companyName,
                        score: r.score,
                        grade: r.grade,
                        isQualified: r.isQualified,
                    })),
                });
            }

            case 'update-documents': {
                const result = await updatePartnerDocuments(partnerId, data || {});

                logPartnerAction({
                    partnerId,
                    organizationId,
                    action: 'QUALIFICATION_DOCUMENTS_UPDATED',
                    performedBy: session.user.id,
                    performedByName: userName,
                    details: `Documents mis à jour — Nouveau score : ${result.score}/100`,
                    newValue: data,
                });

                return NextResponse.json({ success: true, qualification: result });
            }

            case 'record-convention': {
                if (!data?.signedAt) {
                    return NextResponse.json({ error: 'data.signedAt requis' }, { status: 400 });
                }

                const result = await recordConvention(partnerId, {
                    signedAt: new Date(data.signedAt),
                    url: data.url,
                    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
                    type: data.type || 'PROSPECTION',
                });

                logPartnerAction({
                    partnerId,
                    organizationId,
                    action: 'CONVENTION_SIGNED',
                    performedBy: session.user.id,
                    performedByName: userName,
                    details: `Convention de sous-traitance (${data.type || 'PROSPECTION'}) enregistrée`,
                    newValue: { signedAt: data.signedAt, type: data.type },
                });

                return NextResponse.json({ success: true, qualification: result });
            }

            default:
                return NextResponse.json({
                    error: `Action inconnue : ${action}`,
                    validActions: ['evaluate', 'evaluate-all', 'update-documents', 'record-convention'],
                }, { status: 400 });
        }
    } catch (error) {
        console.error('[Qualification API] POST Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

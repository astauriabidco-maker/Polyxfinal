/**
 * INTERACTIVE MESSAGES API — Send & Track Dossier Actions
 * =========================================================
 * POST  — Send an interactive message to a dossier's learner
 * GET   — List recent interactive actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
    buildPresenceMessage,
    buildSlotSelectionMessage,
    buildDocumentChecklistMessage,
    buildSatisfactionSurveyMessage,
} from '@/lib/messaging/interactive-actions';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { dossierId, messageType } = body;

        if (!dossierId || !messageType) {
            return NextResponse.json({ error: 'dossierId et messageType requis' }, { status: 400 });
        }

        // Load dossier with session & programme
        const dossier = await (prisma as any).dossier.findFirst({
            where: { id: dossierId, organizationId: session.user.organizationId },
            include: {
                session: { include: { programme: true } },
            },
        });

        if (!dossier) {
            return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
        }

        if (!dossier.stagiaireTelephone) {
            return NextResponse.json({ error: 'Aucun téléphone pour ce stagiaire' }, { status: 400 });
        }

        // Get messaging config
        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId: session.user.organizationId },
        });

        if (!config) {
            return NextResponse.json({ error: 'Messagerie non configurée' }, { status: 400 });
        }

        // Build the interactive message
        let interactive: any;
        switch (messageType) {
            case 'presence':
                interactive = buildPresenceMessage(dossier);
                break;

            case 'slots': {
                // Generate slots from session dates
                const startDate = new Date(dossier.session.dateDebut);
                const endDate = new Date(dossier.session.dateFin);
                const slots: Array<{ date: Date; label: string }> = [];

                const current = new Date(startDate);
                let idx = 0;
                while (current <= endDate && slots.length < 10) {
                    // Skip weekends
                    if (current.getDay() !== 0 && current.getDay() !== 6) {
                        slots.push({
                            date: new Date(current),
                            label: current.toLocaleDateString('fr-FR', {
                                weekday: 'short', day: 'numeric', month: 'short',
                            }),
                        });
                    }
                    current.setDate(current.getDate() + 1);
                    idx++;
                }
                interactive = buildSlotSelectionMessage(dossier, slots);
                break;
            }

            case 'documents':
                interactive = buildDocumentChecklistMessage(dossier);
                break;

            case 'survey':
                interactive = buildSatisfactionSurveyMessage(dossier);
                break;

            default:
                return NextResponse.json({ error: `Type invalide: ${messageType}` }, { status: 400 });
        }

        // Normalize phone
        const phone = dossier.stagiaireTelephone.replace(/[\s\-\(\)\+]/g, '');

        // Send via Meta WhatsApp Cloud API
        const url = `https://graph.facebook.com/v21.0/${config.metaPhoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'interactive',
            interactive,
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.metaAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await res.json();

        if (!res.ok) {
            console.error('[Interactive] Send failed:', result);
            return NextResponse.json({ error: 'Envoi échoué', details: result }, { status: 502 });
        }

        // Persist outbound message
        await (prisma as any).message.create({
            data: {
                organizationId: session.user.organizationId,
                direction: 'OUTBOUND',
                channel: 'WHATSAPP',
                status: 'SENT',
                phone,
                content: interactive.body.text,
                metadata: JSON.stringify({ interactive: true, messageType, dossierId }),
            },
        });

        return NextResponse.json({
            success: true,
            messageType,
            dossierId,
            waMessageId: result.messages?.[0]?.id,
        });
    } catch (error) {
        console.error('Erreur POST /api/messaging/interactive:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const dossierId = searchParams.get('dossierId');
        const actionType = searchParams.get('actionType');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const where: any = { organizationId: session.user.organizationId };
        if (dossierId) where.dossierId = dossierId;
        if (actionType) where.actionType = actionType;

        const actions = await (prisma as any).interactiveAction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 200),
            include: {
                dossier: {
                    select: {
                        stagiaireNom: true,
                        stagiairePrenom: true,
                        stagiaireTelephone: true,
                        session: { select: { nom: true } },
                    },
                },
            },
        });

        // Aggregate survey stats
        const surveyStats = dossierId ? null : await (prisma as any).interactiveAction.groupBy({
            by: ['actionType'],
            where: {
                organizationId: session.user.organizationId,
                status: 'APPLIED',
            },
            _count: { id: true },
        });

        // Survey average if any
        const surveyActions = actions.filter((a: any) => a.actionType === 'SURVEY_RESPONSE' && a.status === 'APPLIED');
        const avgScore = surveyActions.length > 0
            ? surveyActions.reduce((sum: number, a: any) => sum + (a.actionData?.score || 0), 0) / surveyActions.length
            : null;

        return NextResponse.json({
            actions,
            stats: surveyStats,
            surveyAverage: avgScore ? Math.round(avgScore * 10) / 10 : null,
            total: actions.length,
        });
    } catch (error) {
        console.error('Erreur GET /api/messaging/interactive:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * API MESSAGING SEND — Envoyer un message WhatsApp / SMS
 * ========================================================
 * POST - Envoie un message via le provider configuré de l'organisation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendMessage } from '@/lib/messaging/messaging.service';

/**
 * POST /api/messaging/send
 * Body: { to, templateKey?, params?, text?, channel? }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;
        const body = await request.json();
        const { to, templateKey, params, text, channel } = body;

        // Validation
        if (!to) {
            return NextResponse.json(
                { error: 'Numéro de téléphone (to) requis' },
                { status: 400 }
            );
        }

        if (!templateKey && !text) {
            return NextResponse.json(
                { error: 'templateKey ou text requis' },
                { status: 400 }
            );
        }

        // Send via service
        const result = await sendMessage(organizationId, {
            to,
            templateKey,
            params,
            text,
            channel: channel || 'whatsapp',
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, provider: result.provider },
                { status: 422 }
            );
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            provider: result.provider,
            status: result.status,
        });
    } catch (error) {
        console.error('Erreur POST /api/messaging/send:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

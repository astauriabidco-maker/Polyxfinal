/**
 * API MESSAGING WEBHOOK — Meta WhatsApp Cloud API Webhook
 * =========================================================
 * GET  - Vérification du webhook (challenge/verify_token)
 * POST - Réception des messages entrants + statuts de livraison
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhook, parseWebhookStatus } from '@/lib/messaging/providers/meta-cloud';
import { processInbound } from '@/lib/messaging/chatbot.service';
import { isDossierReply, handleDossierAction } from '@/lib/messaging/interactive-actions';
import { sendMessage } from '@/lib/messaging/messaging.service';
import { isOptOutMessage, handleOptOut, OPT_OUT_REPLY } from '@/lib/messaging/messaging-compliance';

const VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || 'polyx_webhook_verify_2024';

/**
 * GET /api/messaging/webhook
 * Meta webhook verification (subscription challenge)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const result = verifyWebhook(mode, token, challenge, VERIFY_TOKEN);

    if (result.valid) {
        console.log('[Webhook] Meta verification successful');
        return new NextResponse(result.challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    console.warn('[Webhook] Meta verification failed:', { mode, token });
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/messaging/webhook
 * Receive inbound messages + delivery status updates from Meta
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // ─── Handle Delivery Status Updates ──────────────
        const statuses = parseWebhookStatus(body);
        for (const s of statuses) {
            console.log(`  📬 Status: ${s.messageId} → ${s.status}`);

            try {
                const statusMap: Record<string, string> = {
                    sent: 'SENT',
                    delivered: 'DELIVERED',
                    read: 'READ',
                    failed: 'FAILED',
                };
                const dbStatus = statusMap[s.status] || 'SENT';

                await (prisma as any).message.updateMany({
                    where: { providerMessageId: s.messageId },
                    data: { status: dbStatus },
                });
            } catch (err) {
                console.error('[Webhook] Failed to update status:', err);
            }
        }

        // ─── Handle Inbound Messages ─────────────────────
        try {
            const entries = body?.entry || [];
            for (const entry of entries) {
                const changes = entry.changes || [];
                for (const change of changes) {
                    const value = change.value;
                    const phoneNumberId = value?.metadata?.phone_number_id;
                    const incomingMessages = value?.messages || [];

                    for (const msg of incomingMessages) {
                        const from = msg.from; // Sender's phone number
                        const msgType = msg.type; // text, image, interactive, etc.
                        const waMessageId = msg.id;

                        // Extract text based on message type
                        let text = '';
                        let interactiveReplyId: string | undefined;

                        if (msgType === 'text') {
                            text = msg.text?.body || '';
                        } else if (msgType === 'interactive') {
                            // Button reply or list reply
                            if (msg.interactive?.type === 'button_reply') {
                                text = msg.interactive.button_reply.title || '';
                                interactiveReplyId = msg.interactive.button_reply.id;
                            } else if (msg.interactive?.type === 'list_reply') {
                                text = msg.interactive.list_reply.title || '';
                                interactiveReplyId = msg.interactive.list_reply.id;
                            }
                        } else {
                            text = msg.caption || `[${msgType}]`;
                        }

                        console.log(`  📩 Inbound from ${from}: ${text.substring(0, 50)}`);

                        // Find the organization by phoneNumberId
                        const config = await (prisma as any).messagingConfig.findFirst({
                            where: { metaPhoneNumberId: phoneNumberId },
                            select: { organizationId: true },
                        });

                        if (!config) {
                            console.warn(`[Webhook] No org found for phoneNumberId: ${phoneNumberId}`);
                            continue;
                        }

                        // Find lead by phone
                        const normalizedPhone = from.replace(/[\s\-\(\)\+]/g, '');
                        const variants = [normalizedPhone, `+${normalizedPhone}`, `0${normalizedPhone.slice(2)}`];

                        const lead = await (prisma as any).lead.findFirst({
                            where: {
                                organizationId: config.organizationId,
                                telephone: { in: variants },
                            },
                            orderBy: { createdAt: 'desc' },
                            select: { id: true },
                        });

                        // Persist inbound message
                        await (prisma as any).message.create({
                            data: {
                                organizationId: config.organizationId,
                                leadId: lead?.id || null,
                                direction: 'INBOUND',
                                channel: 'WHATSAPP',
                                status: 'DELIVERED',
                                phone: normalizedPhone,
                                content: text,
                                providerMessageId: waMessageId,
                                mediaUrl: msg.image?.link || msg.document?.link || null,
                                mediaType: msgType !== 'text' ? msgType : null,
                                isRead: false,
                            },
                        });

                        // ─── RGPD Opt-Out Detection (Art. 7.3) ───
                        if (isOptOutMessage(text)) {
                            console.log(`  🛑 Opt-out detected from ${normalizedPhone}`);
                            const optOutResult = await handleOptOut(config.organizationId, normalizedPhone);
                            if (optOutResult.success) {
                                // Send opt-out confirmation
                                try {
                                    await sendMessage(config.organizationId, {
                                        to: normalizedPhone,
                                        text: OPT_OUT_REPLY,
                                        channel: 'whatsapp',
                                        dossierId: 'SYSTEM_OPT_OUT', // bypass consent check
                                    });
                                } catch (e) {
                                    console.error('[Webhook] Failed to send opt-out confirmation:', e);
                                }
                            }
                            continue; // Skip chatbot/dossier processing
                        }

                        // ─── Dossier Actions (priority) ─────────
                        if (interactiveReplyId && isDossierReply(interactiveReplyId)) {
                            handleDossierAction(
                                config.organizationId,
                                normalizedPhone,
                                interactiveReplyId,
                                text
                            ).then(async (result) => {
                                if (result.success) {
                                    console.log(`  📋 Dossier action applied for ${normalizedPhone}`);
                                    // Send confirmation message
                                    try {
                                        await sendMessage(config.organizationId, {
                                            to: normalizedPhone,
                                            text: result.message,
                                            channel: 'whatsapp',
                                        });
                                    } catch (e) {
                                        console.error('[Webhook] Failed to send dossier confirmation:', e);
                                    }
                                }
                            }).catch(err => {
                                console.error('[Webhook] Dossier action error:', err);
                            });
                        } else {
                            // ─── Chatbot Auto-Reply ──────────────
                            // Non-blocking: fire and forget
                            processInbound(
                                config.organizationId,
                                normalizedPhone,
                                text,
                                interactiveReplyId
                            ).then(replied => {
                                if (replied) console.log(`  🤖 Bot replied to ${normalizedPhone}`);
                            }).catch(err => {
                                console.error('[Webhook] Chatbot error:', err);
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Webhook] Error processing inbound messages:', err);
        }

        // Always return 200 to acknowledge receipt
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Webhook] Error processing:', error);
        return NextResponse.json({ received: true });
    }
}

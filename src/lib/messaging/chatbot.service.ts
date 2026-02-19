/**
 * CHATBOT SERVICE — Auto-reply Engine
 * =====================================
 * Processes inbound messages, matches keywords to rules,
 * sends interactive responses, and handles human handoff.
 */

import { prisma } from '@/lib/prisma';
import { DEFAULT_CHATBOT_RULES, INTERACTIVE_REPLY_MAPPINGS, ChatbotResponse } from './chatbot-rules';
import { sendMessage } from './messaging.service';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between bot replies per contact

// ─── Process Inbound Message ─────────────────────────────────

/**
 * Process an inbound message and optionally send an auto-reply.
 * Returns true if a bot reply was sent, false otherwise.
 */
export async function processInbound(
    organizationId: string,
    phone: string,
    text: string,
    interactiveReplyId?: string
): Promise<boolean> {
    try {
        // 1. Check conversation state
        const conversation = await getOrCreateConversation(organizationId, phone);

        // If human handoff is active, don't reply
        if (conversation.isHumanHandoff) {
            console.log(`[Chatbot] ${phone}: human handoff active, skipping`);
            return false;
        }

        // 2. Cooldown check
        if (conversation.lastBotReplyAt) {
            const elapsed = Date.now() - new Date(conversation.lastBotReplyAt).getTime();
            if (elapsed < COOLDOWN_MS) {
                console.log(`[Chatbot] ${phone}: cooldown active (${Math.round((COOLDOWN_MS - elapsed) / 1000)}s left)`);
                return false;
            }
        }

        // 3. Resolve text from interactive reply
        const resolvedText = interactiveReplyId
            ? INTERACTIVE_REPLY_MAPPINGS[interactiveReplyId] || text
            : text;

        // 4. Match rule
        const rule = await matchRule(organizationId, resolvedText);
        if (!rule) return false;

        // 5. Parse response
        const response: ChatbotResponse = typeof rule.response === 'string'
            ? JSON.parse(rule.response)
            : rule.response;

        // 6. Handle redirect
        if (rule.responseType === 'REDIRECT_HUMAN') {
            await markHumanHandoff(organizationId, phone);
            // Still send the redirect message
            await sendBotReply(organizationId, phone, response, 'TEXT');
            return true;
        }

        // 7. Send response
        await sendBotReply(organizationId, phone, response, rule.responseType);

        // 8. Update cooldown
        await (prisma as any).chatbotConversation.update({
            where: { organizationId_phone: { organizationId, phone } },
            data: { lastBotReplyAt: new Date(), lastMenuSent: rule.name },
        });

        return true;
    } catch (err) {
        console.error('[Chatbot] Error processing inbound:', err);
        return false;
    }
}

// ─── Match Rule ──────────────────────────────────────────────

async function matchRule(organizationId: string, text: string) {
    // Get all active rules for the org
    const rules = await (prisma as any).chatbotRule.findMany({
        where: { organizationId, isActive: true },
        orderBy: { priority: 'desc' },
    });

    // If no custom rules exist, use defaults
    const effectiveRules = rules.length > 0 ? rules : defaultRulesToDbFormat();

    const normalizedText = text.toLowerCase().trim();

    // Try keyword match
    for (const rule of effectiveRules) {
        if (rule.keywords === '__FALLBACK__') continue;

        const keywords = rule.keywords.split(',').map((k: string) => k.trim().toLowerCase());
        const matched = keywords.some((kw: string) => {
            // Word boundary match
            const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
            return regex.test(normalizedText);
        });

        if (matched) return rule;

        // Regex pattern match
        if (rule.pattern) {
            try {
                const regex = new RegExp(rule.pattern, 'i');
                if (regex.test(normalizedText)) return rule;
            } catch { /* invalid regex, skip */ }
        }
    }

    // Fallback rule
    return effectiveRules.find((r: any) => r.keywords === '__FALLBACK__') || null;
}

// ─── Send Bot Reply ──────────────────────────────────────────

async function sendBotReply(
    organizationId: string,
    phone: string,
    response: ChatbotResponse,
    responseType: string
) {
    // Get messaging config
    const config = await (prisma as any).messagingConfig.findUnique({
        where: { organizationId },
    });

    if (!config) {
        console.warn('[Chatbot] No messaging config for org:', organizationId);
        return;
    }

    if (responseType === 'INTERACTIVE_BUTTONS' && response.buttons?.length) {
        // Send interactive buttons message via Meta API
        await sendInteractiveMessage(config, phone, {
            type: 'button',
            body: { text: response.text },
            footer: response.footer ? { text: response.footer } : undefined,
            action: {
                buttons: response.buttons.map(b => ({
                    type: 'reply' as const,
                    reply: { id: b.id, title: b.title },
                })),
            },
        });
    } else if (responseType === 'INTERACTIVE_LIST' && response.sections?.length) {
        // Send interactive list message via Meta API
        await sendInteractiveMessage(config, phone, {
            type: 'list',
            body: { text: response.text },
            footer: response.footer ? { text: response.footer } : undefined,
            action: {
                button: response.listButtonText || 'Voir les options',
                sections: response.sections.map(s => ({
                    title: s.title,
                    rows: s.rows.map(r => ({
                        id: r.id,
                        title: r.title,
                        description: r.description,
                    })),
                })),
            },
        });
    } else {
        // Simple text reply
        await sendMessage(organizationId, {
            to: phone,
            text: response.text,
            channel: 'whatsapp',
        });
    }

    // Persist bot reply as message
    const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    await (prisma as any).message.create({
        data: {
            organizationId,
            direction: 'OUTBOUND',
            channel: 'WHATSAPP',
            status: 'SENT',
            phone: normalizedPhone,
            content: response.text,
            metadata: JSON.stringify({ chatbot: true, responseType }),
        },
    });
}

// ─── Send Interactive Message (Meta API) ─────────────────────

async function sendInteractiveMessage(
    config: any,
    to: string,
    interactive: any
) {
    const phone = to.replace(/[\s\-\(\)\+]/g, '');
    const url = `https://graph.facebook.com/v21.0/${config.metaPhoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'interactive',
        interactive,
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.metaAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error('[Chatbot] Interactive send failed:', res.status, errorBody);
        } else {
            console.log(`[Chatbot] Interactive message sent to ${phone}`);
        }
    } catch (err) {
        console.error('[Chatbot] Interactive send error:', err);
    }
}

// ─── Conversation State ──────────────────────────────────────

async function getOrCreateConversation(organizationId: string, phone: string) {
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');

    return (prisma as any).chatbotConversation.upsert({
        where: { organizationId_phone: { organizationId, phone: normalized } },
        create: { organizationId, phone: normalized },
        update: {},
    });
}

export async function markHumanHandoff(organizationId: string, phone: string) {
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');

    await (prisma as any).chatbotConversation.upsert({
        where: { organizationId_phone: { organizationId, phone: normalized } },
        create: { organizationId, phone: normalized, isHumanHandoff: true, handoffAt: new Date() },
        update: { isHumanHandoff: true, handoffAt: new Date() },
    });
}

export async function releaseHumanHandoff(organizationId: string, phone: string) {
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');

    await (prisma as any).chatbotConversation.updateMany({
        where: { organizationId, phone: normalized },
        data: { isHumanHandoff: false, handoffAt: null },
    });
}

// ─── Seed Default Rules ──────────────────────────────────────

export async function seedDefaultRules(organizationId: string) {
    const existing = await (prisma as any).chatbotRule.count({
        where: { organizationId },
    });

    if (existing > 0) return; // Already seeded

    for (const rule of DEFAULT_CHATBOT_RULES) {
        await (prisma as any).chatbotRule.create({
            data: {
                organizationId,
                name: rule.name,
                keywords: rule.keywords,
                responseType: rule.responseType,
                response: JSON.stringify(rule.response),
                priority: rule.priority,
                isDefault: rule.isDefault,
            },
        });
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultRulesToDbFormat() {
    return DEFAULT_CHATBOT_RULES.map(r => ({
        keywords: r.keywords,
        pattern: null,
        responseType: r.responseType,
        response: JSON.stringify(r.response),
        priority: r.priority,
        name: r.name,
    }));
}

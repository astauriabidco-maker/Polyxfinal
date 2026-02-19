/**
 * MESSAGING SERVICE — Unified Multi-Tenant Messaging
 * ====================================================
 * Loads the org's messaging config, resolves templates,
 * and routes to the appropriate provider (Meta Cloud or Twilio).
 */

import { prisma } from '@/lib/prisma';
import { MessagingProviderType } from '@prisma/client';
import { MetaCloudProvider } from './providers/meta-cloud';
import { TwilioProvider } from './providers/twilio';
import { checkConsentBeforeSend, auditMessageSent } from './messaging-compliance';
import type { SendMessageInput, SendMessageResult, MessagingProvider, MessagingConfigData } from './types';

// ─── Extended Input with persistence fields ──────────────────

export interface SendMessageOptions extends SendMessageInput {
    leadId?: string;
    dossierId?: string;
    sentById?: string;
}

// ─── Main Service Function ───────────────────────────────────

/**
 * Send a message for a given organization — with persistence
 * Automatically loads config, resolves template, routes to provider, and saves to DB
 */
export async function sendMessage(
    organizationId: string,
    input: SendMessageOptions
): Promise<SendMessageResult & { dbMessageId?: string }> {
    // 1. Load org messaging config
    const config = await getMessagingConfig(organizationId);

    if (!config || !config.isActive) {
        return {
            success: false,
            error: 'Messaging non configuré ou désactivé pour cette organisation',
            provider: config?.provider || 'META_CLOUD',
            status: 'failed',
        };
    }

    // 2. Validate config completeness
    const validationError = validateConfig(config);
    if (validationError) {
        return {
            success: false,
            error: validationError,
            provider: config.provider,
            status: 'failed',
        };
    }

    // 3. Build provider instance
    const provider = buildProvider(config);
    const channel = input.channel || 'whatsapp';

    // 3b. RGPD Consent check (Art. 6.1.a / 6.1.b)
    const consent = await checkConsentBeforeSend(
        organizationId,
        input.to,
        input.leadId,
        input.dossierId,
    );
    if (!consent.allowed) {
        console.warn(`[Messaging] ❌ Blocked by RGPD consent: ${consent.reason}`);
        return {
            success: false,
            error: `Envoi bloqué — ${consent.reason}`,
            provider: config.provider,
            status: 'failed',
        };
    }

    // 4. Resolve content for the message
    let messageContent = input.text || '';
    let result: SendMessageResult;

    if (input.templateKey) {
        const template = await resolveTemplate(config.id, input.templateKey);

        if (!template) {
            result = await sendWithFallback(provider, config, input, channel);
            messageContent = result.success ? (input.text || `[Template: ${input.templateKey}]`) : '';
        } else if (config.provider === 'META_CLOUD') {
            result = await provider.sendTemplate(
                input.to,
                template.providerTemplateName,
                template.language,
                input.params || {}
            );
            messageContent = template.fallbackText
                ? resolveFallbackText(template.fallbackText, input.params || {})
                : `[Template: ${template.providerTemplateName}]`;
        } else {
            messageContent = resolveFallbackText(template.fallbackText, input.params || {});
            result = await provider.sendFreeform(input.to, messageContent, channel);
        }
    } else if (input.text) {
        result = await provider.sendFreeform(input.to, input.text, channel);
    } else {
        return {
            success: false,
            error: 'Ni templateKey ni text fourni',
            provider: config.provider,
            status: 'failed',
        };
    }

    // 5. Persist message in DB
    let dbMessageId: string | undefined;
    try {
        // Auto-find lead by phone if not provided
        let leadId = input.leadId;
        if (!leadId) {
            leadId = await findLeadByPhone(organizationId, input.to) || undefined;
        }

        const msg = await (prisma as any).message.create({
            data: {
                organizationId,
                leadId: leadId || null,
                dossierId: input.dossierId || null,
                direction: 'OUTBOUND',
                channel: channel === 'whatsapp' ? 'WHATSAPP' : 'SMS',
                status: result.success ? 'SENT' : 'FAILED',
                phone: normalizePhone(input.to),
                content: messageContent,
                templateKey: input.templateKey || null,
                providerMessageId: result.messageId || null,
                sentById: input.sentById || null,
                errorMessage: result.error || null,
            },
        });
        dbMessageId = msg.id;

        // 5b. RGPD Audit log (non-blocking)
        auditMessageSent(
            organizationId,
            msg.id,
            input.to,
            channel,
            input.templateKey,
            input.sentById,
            result.success ? 'SENT' : 'FAILED',
        ).catch(err => console.error('[Messaging] Audit log failed:', err));
    } catch (err) {
        console.error('[Messaging] Failed to persist message:', err);
    }

    return { ...result, dbMessageId };
}

// ─── Config Management ───────────────────────────────────────

/**
 * Get messaging config for an organization
 */
export async function getMessagingConfig(
    organizationId: string
): Promise<MessagingConfigData | null> {
    const config = await prisma.messagingConfig.findUnique({
        where: { organizationId },
    });
    return config;
}

/**
 * Check if messaging is configured and active for an org
 */
export async function isMessagingActive(organizationId: string): Promise<boolean> {
    const config = await getMessagingConfig(organizationId);
    if (!config || !config.isActive) return false;
    return validateConfig(config) === null;
}

// ─── Internal Helpers ────────────────────────────────────────

function buildProvider(config: MessagingConfigData): MessagingProvider {
    if (config.provider === 'META_CLOUD') {
        return new MetaCloudProvider({
            phoneNumberId: config.metaPhoneNumberId!,
            accessToken: config.metaAccessToken!,
        });
    } else {
        return new TwilioProvider({
            accountSid: config.twilioAccountSid!,
            authToken: config.twilioAuthToken!,
            phoneNumber: config.twilioPhoneNumber!,
        });
    }
}

function validateConfig(config: MessagingConfigData): string | null {
    if (config.provider === 'META_CLOUD') {
        if (!config.metaPhoneNumberId || !config.metaAccessToken) {
            return 'Configuration Meta Cloud incomplète (Phone Number ID et Access Token requis)';
        }
    } else if (config.provider === 'TWILIO') {
        if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
            return 'Configuration Twilio incomplète (Account SID, Auth Token et Phone Number requis)';
        }
    }
    return null;
}

async function resolveTemplate(
    messagingConfigId: string,
    internalKey: string
) {
    return prisma.messageTemplate.findUnique({
        where: {
            messagingConfigId_internalKey: {
                messagingConfigId,
                internalKey,
            },
        },
    });
}

function resolveFallbackText(
    fallbackText: string | null,
    params: Record<string, string>
): string {
    if (!fallbackText) return '';
    let text = fallbackText;
    for (const [key, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return text;
}

async function sendWithFallback(
    provider: MessagingProvider,
    config: MessagingConfigData,
    input: SendMessageInput,
    channel: 'whatsapp' | 'sms'
): Promise<SendMessageResult> {
    // Use static fallbacks from MessageTemplates.ts
    const STATIC_FALLBACKS: Record<string, string> = {
        RDV_CONFIRMATION: 'Bonjour {name}, je vous confirme votre rendez-vous téléphonique avec Polyx pour le {date}. Cordialement.',
        NO_ANSWER: "Bonjour {name}, j'ai tenté de vous joindre concernant votre demande de formation. Quand êtes-vous disponible ? Cordialement, Polyx.",
        INFO_SOUHAITEE: 'Bonjour {name}, suite à votre demande, je reste à votre disposition pour échanger sur votre projet de formation. Cordialement.',
    };

    const templateText = input.templateKey ? STATIC_FALLBACKS[input.templateKey] : null;

    if (templateText) {
        const text = resolveFallbackText(templateText, input.params || {});
        return provider.sendFreeform(input.to, text, channel);
    }

    return {
        success: false,
        error: `Template "${input.templateKey}" non trouvé`,
        provider: config.provider,
        status: 'failed',
    };
}

// ─── Phone Utilities ─────────────────────────────────────────

/**
 * Normalize phone number to digits only (no +, no spaces)
 */
function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '');
}

/**
 * Find the most recent lead by phone number within an organization
 */
async function findLeadByPhone(
    organizationId: string,
    phone: string
): Promise<string | null> {
    const normalized = normalizePhone(phone);
    // Try multiple phone formats
    const variants = [
        normalized,
        `+${normalized}`,
        `0${normalized.slice(2)}`, // 33612.. → 0612..
    ];

    const lead = await (prisma as any).lead.findFirst({
        where: {
            organizationId,
            telephone: { in: variants },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
    });

    return lead?.id || null;
}

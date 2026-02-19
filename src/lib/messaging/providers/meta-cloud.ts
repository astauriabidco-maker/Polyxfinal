/**
 * META CLOUD API PROVIDER — WhatsApp Business Cloud API v21.0
 * ============================================================
 * Direct fetch()-based client. No SDK dependency.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { MessagingProvider, SendMessageResult } from '../types';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MetaCloudConfig {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId?: string;
}

// ─── Template Management Types ──────────────────────────────

export type MetaTemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type MetaTemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export interface MetaTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: { body_text?: string[][] };
    buttons?: Array<{
        type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
        text: string;
        url?: string;
        phone_number?: string;
    }>;
}

export interface MetaTemplate {
    id: string;
    name: string;
    language: string;
    status: MetaTemplateStatus;
    category: MetaTemplateCategory;
    components: MetaTemplateComponent[];
    rejected_reason?: string;
}

export interface CreateMetaTemplateInput {
    name: string;
    language: string;
    category: MetaTemplateCategory;
    components: MetaTemplateComponent[];
}

export class MetaCloudProvider implements MessagingProvider {
    private config: MetaCloudConfig;

    constructor(config: MetaCloudConfig) {
        this.config = config;
    }

    /**
     * Send a pre-approved template message via Meta Cloud API
     */
    async sendTemplate(
        to: string,
        templateName: string,
        language: string,
        params: Record<string, string>
    ): Promise<SendMessageResult> {
        const components: any[] = [];

        // Build body parameters from params
        const bodyParams = Object.values(params);
        if (bodyParams.length > 0) {
            components.push({
                type: 'body',
                parameters: bodyParams.map(value => ({
                    type: 'text',
                    text: value,
                })),
            });
        }

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.normalizePhone(to),
            type: 'template',
            template: {
                name: templateName,
                language: { code: language },
                ...(components.length > 0 && { components }),
            },
        };

        return this.callApi(payload);
    }

    /**
     * Send a free-form text message via Meta Cloud API
     */
    async sendFreeform(
        to: string,
        text: string,
        _channel: 'whatsapp' | 'sms'
    ): Promise<SendMessageResult> {
        // Meta Cloud API only supports WhatsApp
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.normalizePhone(to),
            type: 'text',
            text: { preview_url: true, body: text },
        };

        return this.callApi(payload);
    }

    /**
     * Send a media message (image, document, video, audio)
     * @param mediaUrl - Public URL to the media file
     * @param mediaType - MIME type or media category
     * @param caption - Optional caption text
     * @param filename - Optional filename (for documents)
     */
    async sendMedia(
        to: string,
        mediaUrl: string,
        mediaType: string,
        caption?: string,
        filename?: string
    ): Promise<SendMessageResult> {
        // Determine Meta media type from MIME or explicit type
        let type: 'image' | 'document' | 'video' | 'audio' = 'document';
        if (mediaType.startsWith('image/') || mediaType === 'image') type = 'image';
        else if (mediaType.startsWith('video/') || mediaType === 'video') type = 'video';
        else if (mediaType.startsWith('audio/') || mediaType === 'audio') type = 'audio';

        const mediaPayload: any = { link: mediaUrl };
        if (caption) mediaPayload.caption = caption;
        if (filename && type === 'document') mediaPayload.filename = filename;

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.normalizePhone(to),
            type,
            [type]: mediaPayload,
        };

        return this.callApi(payload);
    }

    /**
     * Upload a media file to Meta and get a media ID
     * Used when sending local files (not public URLs)
     */
    async uploadMedia(
        fileBuffer: Buffer,
        mimeType: string,
        filename: string
    ): Promise<{ success: boolean; mediaId?: string; error?: string }> {
        try {
            const url = `${GRAPH_API_BASE}/${this.config.phoneNumberId}/media`;

            const formData = new FormData();
            formData.append('messaging_product', 'whatsapp');
            formData.append('type', mimeType);
            formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.error?.message || `HTTP ${response.status}` };
            }

            return { success: true, mediaId: data.id };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Upload error' };
        }
    }

    /**
     * Send a media message by media ID (after upload)
     */
    async sendMediaById(
        to: string,
        mediaId: string,
        type: 'image' | 'document' | 'video' | 'audio',
        caption?: string,
        filename?: string
    ): Promise<SendMessageResult> {
        const mediaPayload: any = { id: mediaId };
        if (caption) mediaPayload.caption = caption;
        if (filename && type === 'document') mediaPayload.filename = filename;

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.normalizePhone(to),
            type,
            [type]: mediaPayload,
        };

        return this.callApi(payload);
    }

    /**
     * Core API call to Meta Graph API
     */
    private async callApi(payload: any): Promise<SendMessageResult> {
        try {
            const url = `${GRAPH_API_BASE}/${this.config.phoneNumberId}/messages`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[MetaCloud] API Error:', data);
                return {
                    success: false,
                    error: data.error?.message || `HTTP ${response.status}`,
                    provider: 'META_CLOUD',
                    status: 'failed',
                };
            }

            const messageId = data.messages?.[0]?.id;
            return {
                success: true,
                messageId,
                provider: 'META_CLOUD',
                status: 'sent',
            };
        } catch (error) {
            console.error('[MetaCloud] Network Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
                provider: 'META_CLOUD',
                status: 'failed',
            };
        }
    }

    /**
     * Normalize phone number to international format (no + prefix, no spaces)
     * Example: +33 6 12 34 56 78 → 33612345678
     */
    private normalizePhone(phone: string): string {
        return phone.replace(/[\s\-\(\)\+]/g, '');
    }

    // ─── Template Management Methods ─────────────────────────

    /**
     * List all templates from the WABA (WhatsApp Business Account)
     */
    async listTemplates(): Promise<{ success: boolean; templates?: MetaTemplate[]; error?: string }> {
        if (!this.config.businessAccountId) {
            return { success: false, error: 'Business Account ID requis pour gérer les templates' };
        }

        try {
            const url = `${GRAPH_API_BASE}/${this.config.businessAccountId}/message_templates?limit=100&fields=id,name,language,status,category,components,rejected_reason`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
            });

            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.error?.message || `HTTP ${response.status}` };
            }

            return { success: true, templates: data.data || [] };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Network error' };
        }
    }

    /**
     * Create a new template and submit for Meta review
     */
    async createTemplate(input: CreateMetaTemplateInput): Promise<{
        success: boolean;
        templateId?: string;
        status?: MetaTemplateStatus;
        error?: string;
    }> {
        if (!this.config.businessAccountId) {
            return { success: false, error: 'Business Account ID requis' };
        }

        try {
            const url = `${GRAPH_API_BASE}/${this.config.businessAccountId}/message_templates`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: input.name,
                    language: input.language,
                    category: input.category,
                    components: input.components,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[MetaCloud] Create template error:', data);
                return { success: false, error: data.error?.message || `HTTP ${response.status}` };
            }

            return {
                success: true,
                templateId: data.id,
                status: data.status || 'PENDING',
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Network error' };
        }
    }

    /**
     * Delete a template by name
     */
    async deleteTemplate(templateName: string): Promise<{ success: boolean; error?: string }> {
        if (!this.config.businessAccountId) {
            return { success: false, error: 'Business Account ID requis' };
        }

        try {
            const url = `${GRAPH_API_BASE}/${this.config.businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}`;

            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error?.message || `HTTP ${response.status}` };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Network error' };
        }
    }
}
/**
 * Verify Meta webhook challenge
 */
export function verifyWebhook(
    mode: string | null,
    token: string | null,
    challenge: string | null,
    verifyToken: string
): { valid: boolean; challenge?: string } {
    if (mode === 'subscribe' && token === verifyToken) {
        return { valid: true, challenge: challenge || '' };
    }
    return { valid: false };
}

/**
 * Parse incoming webhook payload for delivery status updates
 */
export function parseWebhookStatus(body: any): Array<{
    messageId: string;
    status: string;
    timestamp: string;
    recipientId: string;
}> {
    const statuses: Array<{
        messageId: string;
        status: string;
        timestamp: string;
        recipientId: string;
    }> = [];

    try {
        const entries = body?.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                const value = change.value;
                if (value?.statuses) {
                    for (const s of value.statuses) {
                        statuses.push({
                            messageId: s.id,
                            status: s.status, // sent, delivered, read, failed
                            timestamp: s.timestamp,
                            recipientId: s.recipient_id,
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error('[MetaCloud] Webhook parse error:', e);
    }

    return statuses;
}

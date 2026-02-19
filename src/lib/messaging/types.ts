/**
 * MESSAGING TYPES — Shared interfaces for WhatsApp / SMS providers
 * =================================================================
 */

import { MessagingProviderType } from '@prisma/client';

// ─── Send Input ───────────────────────────────────────────────

export interface SendMessageInput {
    /** Recipient phone number (international format, e.g. +33612345678) */
    to: string;
    /** Internal template key, e.g. "RDV_CONFIRMATION" */
    templateKey?: string;
    /** Template parameters (name, date, etc.) */
    params?: Record<string, string>;
    /** Free-form text (used if no templateKey) */
    text?: string;
    /** Channel: WhatsApp or SMS (defaults to WhatsApp) */
    channel?: 'whatsapp' | 'sms';
}

// ─── Send Result ──────────────────────────────────────────────

export interface SendMessageResult {
    success: boolean;
    /** Provider message ID (for tracking) */
    messageId?: string;
    /** Error message if failed */
    error?: string;
    /** Provider used */
    provider: MessagingProviderType;
    /** Delivery status */
    status: MessageStatus;
}

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'queued';

// ─── Provider Interface ───────────────────────────────────────

export interface MessagingProvider {
    sendTemplate(
        to: string,
        templateName: string,
        language: string,
        params: Record<string, string>
    ): Promise<SendMessageResult>;

    sendFreeform(
        to: string,
        text: string,
        channel: 'whatsapp' | 'sms'
    ): Promise<SendMessageResult>;
}

// ─── Config Shape ─────────────────────────────────────────────

export interface MessagingConfigData {
    id: string;
    organizationId: string;
    provider: MessagingProviderType;
    isActive: boolean;
    // Meta
    metaPhoneNumberId: string | null;
    metaBusinessId: string | null;
    metaAccessToken: string | null;
    // Twilio
    twilioAccountSid: string | null;
    twilioAuthToken: string | null;
    twilioPhoneNumber: string | null;
    // Common
    defaultCountryCode: string;
}

// ─── Template mapping ─────────────────────────────────────────

export interface TemplateMapping {
    id: string;
    internalKey: string;
    providerTemplateName: string;
    language: string;
    fallbackText: string | null;
    isActive: boolean;
}

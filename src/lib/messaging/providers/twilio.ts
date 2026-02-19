/**
 * TWILIO PROVIDER — WhatsApp BSP + SMS via Twilio REST API
 * =========================================================
 * Direct fetch()-based client. No SDK dependency.
 * Docs: https://www.twilio.com/docs/messaging/api/message-resource
 */

import { MessagingProvider, SendMessageResult } from '../types';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

interface TwilioConfig {
    accountSid: string;
    authToken: string;
    phoneNumber: string; // WhatsApp-enabled Twilio number
}

export class TwilioProvider implements MessagingProvider {
    private config: TwilioConfig;

    constructor(config: TwilioConfig) {
        this.config = config;
    }

    /**
     * Send a template message via Twilio
     * Twilio uses Content Templates (ContentSid) or simple body text
     * For simplicity, we resolve the template to text and send as body
     */
    async sendTemplate(
        to: string,
        _templateName: string,
        _language: string,
        _params: Record<string, string>
    ): Promise<SendMessageResult> {
        // Twilio doesn't natively map Meta template names
        // The service layer will resolve templateKey → fallbackText before calling this
        return {
            success: false,
            error: 'Use sendFreeform with resolved template text for Twilio',
            provider: 'TWILIO',
            status: 'failed',
        };
    }

    /**
     * Send a free-form message via Twilio (WhatsApp or SMS)
     */
    async sendFreeform(
        to: string,
        text: string,
        channel: 'whatsapp' | 'sms'
    ): Promise<SendMessageResult> {
        try {
            const normalizedTo = this.normalizePhone(to);
            const fromNumber = channel === 'whatsapp'
                ? `whatsapp:${this.config.phoneNumber}`
                : this.config.phoneNumber;
            const toNumber = channel === 'whatsapp'
                ? `whatsapp:${normalizedTo}`
                : normalizedTo;

            const url = `${TWILIO_API_BASE}/Accounts/${this.config.accountSid}/Messages.json`;

            // Twilio uses form-urlencoded
            const body = new URLSearchParams({
                From: fromNumber,
                To: toNumber,
                Body: text,
            });

            const authHeader = Buffer.from(
                `${this.config.accountSid}:${this.config.authToken}`
            ).toString('base64');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[Twilio] API Error:', data);
                return {
                    success: false,
                    error: data.message || `HTTP ${response.status}`,
                    provider: 'TWILIO',
                    status: 'failed',
                };
            }

            return {
                success: true,
                messageId: data.sid,
                provider: 'TWILIO',
                status: data.status === 'queued' ? 'queued' : 'sent',
            };
        } catch (error) {
            console.error('[Twilio] Network Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
                provider: 'TWILIO',
                status: 'failed',
            };
        }
    }

    /**
     * Normalize phone to E.164 format
     * Example: 06 12 34 56 78 → +33612345678
     */
    private normalizePhone(phone: string): string {
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');
        // If starts with 0, assume French number → replace with +33
        if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
            cleaned = '+33' + cleaned.substring(1);
        }
        // Ensure + prefix
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }
        return cleaned;
    }
}

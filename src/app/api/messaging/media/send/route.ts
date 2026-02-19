/**
 * API MEDIA SEND — Upload + Send Media via WhatsApp
 * ===================================================
 * POST — Upload a file and send it as a WhatsApp media message
 * Body: FormData with file, phone, caption?, leadId?
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getMessagingConfig } from '@/lib/messaging/messaging.service';
import { MetaCloudProvider } from '@/lib/messaging/providers/meta-cloud';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Allowed MIME types for WhatsApp
const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'application/pdf': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'video/mp4': 'video',
    'audio/mpeg': 'audio',
    'audio/ogg': 'audio',
};

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB (Meta limit)

/**
 * POST /api/messaging/media/send
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const phone = formData.get('phone') as string;
        const caption = formData.get('caption') as string | null;
        const leadId = formData.get('leadId') as string | null;

        if (!file || !phone) {
            return NextResponse.json({ error: 'file et phone sont requis' }, { status: 400 });
        }

        // Validate file type
        const mimeType = file.type;
        if (!ALLOWED_TYPES[mimeType]) {
            return NextResponse.json({
                error: `Type de fichier non supporté: ${mimeType}. Types acceptés: ${Object.keys(ALLOWED_TYPES).join(', ')}`,
            }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
            }, { status: 400 });
        }

        // Load config
        const config = await getMessagingConfig(session.user.organizationId);
        if (!config || !config.isActive) {
            return NextResponse.json({ error: 'Messaging non configuré' }, { status: 400 });
        }

        if (config.provider !== 'META_CLOUD') {
            return NextResponse.json({ error: 'Envoi média non supporté avec Twilio (utiliser Meta Cloud)' }, { status: 400 });
        }

        if (!config.metaPhoneNumberId || !config.metaAccessToken) {
            return NextResponse.json({ error: 'Configuration Meta incomplète' }, { status: 400 });
        }

        const provider = new MetaCloudProvider({
            phoneNumberId: config.metaPhoneNumberId,
            accessToken: config.metaAccessToken,
        });

        // Save file locally for reference
        const fileExt = file.name.split('.').pop() || 'bin';
        const localFilename = `${randomUUID()}.${fileExt}`;
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'messaging');
        await mkdir(uploadDir, { recursive: true });

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const localPath = join(uploadDir, localFilename);
        await writeFile(localPath, fileBuffer);

        const localUrl = `/uploads/messaging/${localFilename}`;

        // Upload to Meta and send
        const uploadResult = await provider.uploadMedia(fileBuffer, mimeType, file.name);

        let sendResult;
        if (uploadResult.success && uploadResult.mediaId) {
            // Send via media ID
            const mediaCategory = ALLOWED_TYPES[mimeType] as 'image' | 'document' | 'video' | 'audio';
            sendResult = await provider.sendMediaById(
                phone,
                uploadResult.mediaId,
                mediaCategory,
                caption || undefined,
                mediaCategory === 'document' ? file.name : undefined
            );
        } else {
            // Fallback: try sending via local URL (needs public domain)
            return NextResponse.json({
                error: `Upload vers Meta échoué: ${uploadResult.error}`,
                localUrl,
            }, { status: 500 });
        }

        // Persist to DB
        const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        try {
            await (prisma as any).message.create({
                data: {
                    organizationId: session.user.organizationId,
                    leadId: leadId || null,
                    direction: 'OUTBOUND',
                    channel: 'WHATSAPP',
                    status: sendResult.success ? 'SENT' : 'FAILED',
                    phone: normalizedPhone,
                    content: caption || `[${ALLOWED_TYPES[mimeType]}: ${file.name}]`,
                    providerMessageId: sendResult.messageId || null,
                    sentById: session.user.id || null,
                    mediaUrl: localUrl,
                    mediaType: mimeType,
                    errorMessage: sendResult.error || null,
                },
            });
        } catch (err) {
            console.error('[Media] Failed to persist message:', err);
        }

        return NextResponse.json({
            success: sendResult.success,
            messageId: sendResult.messageId,
            localUrl,
            error: sendResult.error,
        });
    } catch (error) {
        console.error('Erreur POST /api/messaging/media/send:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

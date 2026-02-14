/**
 * API ROUTE: /api/organizations/[id]/upload
 * ==========================================
 * Upload de fichiers pour une organisation (logo, signature, documents).
 * Les fichiers sont stockés dans /public/uploads/organizations/[id]/
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Champs autorisés pour l'upload
const ALLOWED_FIELDS = [
    'logoUrl',
    'signatureUrl',
    'cachetUrl',
    'cgvUrl',
    'livretAccueilUrl',
    'reglementInterieurUrl',
];

// Extensions autorisées par type de champ
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
    logoUrl: ['.png', '.jpg', '.jpeg', '.svg'],
    signatureUrl: ['.png', '.jpg', '.jpeg'],
    cachetUrl: ['.png', '.jpg', '.jpeg'],
    cgvUrl: ['.pdf'],
    livretAccueilUrl: ['.pdf'],
    reglementInterieurUrl: ['.pdf'],
};

// Tailles maximales par type
const MAX_SIZES: Record<string, number> = {
    logoUrl: 2 * 1024 * 1024, // 2MB
    signatureUrl: 2 * 1024 * 1024,
    cachetUrl: 2 * 1024 * 1024,
    cgvUrl: 10 * 1024 * 1024, // 10MB
    livretAccueilUrl: 10 * 1024 * 1024,
    reglementInterieurUrl: 10 * 1024 * 1024,
};

/**
 * POST /api/organizations/[id]/upload
 * Upload un fichier pour un champ spécifique
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Vérifier accès ADMIN
        const memberships = session.user.memberships || [];
        const membership = memberships.find(m => m.organizationId === id);

        if (!membership || membership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants' },
                { status: 403 }
            );
        }

        // Parser le FormData
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const field = formData.get('field') as string | null;

        if (!file || !field) {
            return NextResponse.json(
                { error: 'Fichier et champ requis' },
                { status: 400 }
            );
        }

        // Valider le champ
        if (!ALLOWED_FIELDS.includes(field)) {
            return NextResponse.json(
                { error: 'Champ non autorisé' },
                { status: 400 }
            );
        }

        // Valider l'extension
        const ext = path.extname(file.name).toLowerCase();
        const allowedExts = ALLOWED_EXTENSIONS[field] || [];
        if (!allowedExts.includes(ext)) {
            return NextResponse.json(
                { error: `Extension non autorisée. Accepté: ${allowedExts.join(', ')}` },
                { status: 400 }
            );
        }

        // Valider la taille
        const maxSize = MAX_SIZES[field] || 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `Fichier trop volumineux. Maximum: ${Math.round(maxSize / 1024 / 1024)}MB` },
                { status: 400 }
            );
        }

        // Créer le dossier d'upload
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'organizations', id);
        await mkdir(uploadDir, { recursive: true });

        // Générer un nom de fichier unique
        const timestamp = Date.now();
        const safeFieldName = field.replace('Url', '');
        const filename = `${safeFieldName}_${timestamp}${ext}`;
        const filepath = path.join(uploadDir, filename);

        // Écrire le fichier
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // URL publique
        const publicUrl = `/uploads/organizations/${id}/${filename}`;

        // Mettre à jour l'organisation
        await prisma.organization.update({
            where: { id },
            data: { [field]: publicUrl },
        });

        // Log d'audit
        await prisma.auditLog.create({
            data: {
                organizationId: id,
                userId: session.user.id!,
                userRole: membership.role.code,
                action: 'UPLOAD_DOCUMENT',
                niveauAction: 'EDITION',
                entityType: 'Organization',
                entityId: id,
                phase: 0,
                isForced: false,
                newState: { field, filename, size: file.size },
            },
        });

        return NextResponse.json({
            success: true,
            url: publicUrl,
            field,
        });

    } catch (error) {
        console.error('[API Organization Upload] Error:', error);
        return NextResponse.json(
            { error: 'Erreur lors de l\'upload' },
            { status: 500 }
        );
    }
}

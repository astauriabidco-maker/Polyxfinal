/**
 * API CHANGE-PASSWORD - Changement de mot de passe obligatoire
 * =============================================================
 * POST /api/change-password - Changer son mot de passe (force change flow)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string()
        .min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères')
        .max(128, 'Mot de passe trop long'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = changePasswordSchema.safeParse(body);
        if (!parsed.success) {
            const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
            return NextResponse.json(
                { error: errors[0], errors },
                { status: 400 }
            );
        }

        const { currentPassword, newPassword } = parsed.data;

        // Récupérer l'utilisateur
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { passwordHash: true },
        });

        if (!user?.passwordHash) {
            return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
        }

        // Vérifier l'ancien mot de passe
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 403 });
        }

        // Vérifier que le nouveau mot de passe est différent
        const isSame = await bcrypt.compare(newPassword, user.passwordHash);
        if (isSame) {
            return NextResponse.json(
                { error: 'Le nouveau mot de passe doit être différent de l\'ancien' },
                { status: 400 }
            );
        }

        // Mettre à jour le mot de passe et désactiver le flag
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                passwordHash: hashedPassword,
                mustChangePassword: false,
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: session.user.role?.code || 'USER',
                organizationId: session.user.organizationId || '',
                action: 'PASSWORD_CHANGED',
                entityType: 'User',
                entityId: session.user.id,
                niveauAction: 'EDITION',
                newState: { forced: true },
            },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Erreur POST /api/change-password:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

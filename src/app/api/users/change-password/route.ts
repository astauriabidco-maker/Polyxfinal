/**
 * API CHANGE PASSWORD — Changement de mot de passe
 * ==================================================
 * POST /api/users/change-password
 * 
 * Permet à un utilisateur authentifié de changer son mot de passe.
 * Vérifie l'ancien mot de passe avant d'accepter le nouveau.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────

const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .min(1, 'Le mot de passe actuel est requis'),
    newPassword: z
        .string()
        .min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères')
        .max(100, 'Le mot de passe est trop long')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
        ),
});

// ─── POST: Changer le mot de passe ───────────────────────────

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = changePasswordSchema.safeParse(body);

        if (!parsed.success) {
            const firstError = parsed.error.errors[0]?.message ?? 'Données invalides';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const { currentPassword, newPassword } = parsed.data;

        // Récupérer l'utilisateur avec son hash actuel
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, passwordHash: true },
        });

        if (!user || !user.passwordHash) {
            return NextResponse.json(
                { error: 'Impossible de modifier le mot de passe pour ce compte.' },
                { status: 400 }
            );
        }

        // Vérifier l'ancien mot de passe
        const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isCurrentValid) {
            return NextResponse.json(
                { error: 'Le mot de passe actuel est incorrect.' },
                { status: 403 }
            );
        }

        // Vérifier que le nouveau est différent de l'ancien
        const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
        if (isSamePassword) {
            return NextResponse.json(
                { error: 'Le nouveau mot de passe doit être différent de l\'ancien.' },
                { status: 400 }
            );
        }

        // Hasher et sauvegarder le nouveau mot de passe
        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash },
        });

        // Log audit
        const organizationId = session.user.organizationId;
        if (organizationId) {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userRole: 'SELF',
                    organizationId,
                    action: 'PASSWORD_CHANGE',
                    entityType: 'User',
                    entityId: user.id,
                    niveauAction: 'EDITION',
                },
            });
        }

        console.log(`[Auth] 🔑 Mot de passe changé pour l'utilisateur ${session.user.id}`);

        return NextResponse.json({
            success: true,
            message: '✅ Votre mot de passe a été mis à jour avec succès.',
        });

    } catch (error) {
        console.error('Erreur POST /api/users/change-password:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

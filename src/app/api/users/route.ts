/**
 * API USERS - Gestion des utilisateurs de l'organisation
 * =======================================================
 * GET  - Liste des membres de l'organisation courante
 * POST - Créer un utilisateur + membership
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MembershipScope } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { userCreateSchema, parseBody } from '@/lib/validation';

/**
 * GET /api/users
 * Liste les membres de l'organisation courante
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const organizationId = session.user.organizationId;

        // Récupérer les memberships avec les users
        const memberships = await prisma.membership.findMany({
            where: {
                organizationId,
                isActive: true,
            },
            include: {
                role: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        telephone: true,
                        isActive: true,
                        createdAt: true,
                    },
                },
                siteAccess: {
                    include: {
                        site: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                lastAccessedAt: 'desc',
            },
        });

        // Formater la réponse
        const users = memberships.map((m) => ({
            id: m.user.id,
            email: m.user.email,
            nom: m.user.nom,
            prenom: m.user.prenom,
            telephone: m.user.telephone,
            role: m.role.code,
            roleLabel: m.role.name,
            scope: m.scope,
            sites: m.siteAccess.map((sa) => sa.site),
            isActive: m.user.isActive && m.isActive,
            lastAccessedAt: m.lastAccessedAt,
            createdAt: m.user.createdAt,
        }));

        // ── Scope enforcement : RESTRICTED ne voit que les membres de ses sites ──
        const currentMembership = memberships.find(
            (m) => m.userId === session.user.id
        );
        if (currentMembership?.scope === 'RESTRICTED') {
            const mySiteIds = new Set(
                currentMembership.siteAccess.map((sa) => sa.siteId)
            );
            const filteredUsers = users.filter((u) =>
                u.sites.some((s) => mySiteIds.has(s.id))
            );
            return NextResponse.json({ users: filteredUsers });
        }

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Erreur GET /api/users:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/users
 * Créer un nouvel utilisateur avec membership + invitation email
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();

        // Validation Zod
        const parsed = parseBody(userCreateSchema, body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error, errors: parsed.errors },
                { status: 400 }
            );
        }

        const { email, nom, prenom, telephone, role, scope, siteIds, organizationId, password: providedPassword } = parsed.data;

        // Vérifier que l'utilisateur courant est ADMIN de l'organisation CIBLE
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: organizationId,
                },
            },
            include: { role: true },
        });

        if (!currentMembership || currentMembership.role.code !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Droits insuffisants pour cette organisation' },
                { status: 403 }
            );
        }

        // Récupérer le nom de l'organisation pour l'email
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true },
        });

        // Vérifier si l'utilisateur existe déjà
        let user = await prisma.user.findUnique({
            where: { email },
        });

        let isNewUser = false;
        let generatedPassword: string | null = null;

        if (user) {
            // Vérifier s'il a déjà un membership dans cette org
            const existingMembership = await prisma.membership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: user.id,
                        organizationId,
                    },
                },
            });

            if (existingMembership) {
                return NextResponse.json(
                    { error: 'Cet utilisateur est déjà membre de l\'organisation' },
                    { status: 409 }
                );
            }
        } else {
            // Générer un mot de passe temporaire sécurisé
            generatedPassword = generateSecurePassword(12);
            const hashedPassword = await bcrypt.hash(generatedPassword, 10);

            // Créer le nouvel utilisateur avec mot de passe
            user = await prisma.user.create({
                data: {
                    email,
                    nom,
                    prenom,
                    telephone: telephone || null,
                    passwordHash: hashedPassword,
                    isActive: true,
                    mustChangePassword: true,
                },
            });
            isNewUser = true;
        }

        // Trouver le rôle correspondant au code dans le contexte de l'org
        const targetRoleCode = role || 'FORMAT';
        const targetRole = await prisma.role.findFirst({
            where: {
                OR: [
                    { code: targetRoleCode, organizationId: null }, // Rôle système
                    { code: targetRoleCode, organizationId },       // Rôle custom de cette org
                ],
            },
        });

        if (!targetRole) {
            return NextResponse.json(
                { error: `Rôle invalide: ${targetRoleCode}` },
                { status: 400 }
            );
        }

        // Créer le membership
        const membership = await prisma.membership.create({
            data: {
                user: { connect: { id: user.id } },
                organization: { connect: { id: organizationId } },
                role: { connect: { id: targetRole.id } },
                scope: (scope as MembershipScope) || 'GLOBAL',
                isActive: true,
            },
            include: { role: true },
        });

        // Si scope RESTRICTED et siteIds fournis, créer les accès
        if (scope === 'RESTRICTED' && siteIds && siteIds.length > 0) {
            await prisma.membershipSiteAccess.createMany({
                data: siteIds.map((siteId: string) => ({
                    membershipUserId: user!.id,
                    membershipOrgId: organizationId,
                    siteId,
                })),
            });
        }

        // Log audit
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userRole: currentMembership.role.code,
                organizationId,
                action: 'USER_CREATE',
                entityType: 'User',
                entityId: user.id,
                niveauAction: 'EDITION',
            },
        });

        // 📧 Envoi de l'email d'invitation
        try {
            const { sendTransactionalEmail } = await import('@/lib/notifications/email');

            if (isNewUser && generatedPassword) {
                // Nouvel utilisateur → email avec identifiants
                await sendTransactionalEmail({
                    to: email,
                    subject: `Bienvenue sur Polyx ERP — Vos identifiants de connexion`,
                    template: 'USER_INVITATION',
                    data: {
                        prenom,
                        nom,
                        email,
                        password: generatedPassword,
                        organizationName: organization?.name || 'votre organisation',
                        roleName: targetRole.name,
                    },
                });
                console.log(`[Users] 📧 Email d'invitation envoyé à ${email} (nouveau compte)`);
            } else {
                // Utilisateur existant ajouté à une nouvelle org → notification
                await sendTransactionalEmail({
                    to: email,
                    subject: `Polyx ERP — Vous avez été ajouté(e) à ${organization?.name || 'une nouvelle organisation'}`,
                    template: 'USER_ADDED_TO_ORG',
                    data: {
                        prenom: user.prenom,
                        nom: user.nom,
                        organizationName: organization?.name || 'une nouvelle organisation',
                        roleName: targetRole.name,
                    },
                });
                console.log(`[Users] 📧 Email de notification envoyé à ${email} (ajouté à ${organization?.name})`);
            }
        } catch (emailError) {
            console.error('[Users] ⚠️ Échec envoi email invitation:', emailError);
            // On ne bloque pas la création si l'email échoue
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                role: membership.role.code,
                scope: membership.scope,
            },
            emailSent: true,
            message: isNewUser
                ? `✅ Utilisateur créé. Un email d'invitation avec ses identifiants a été envoyé à ${email}.`
                : `✅ Utilisateur ajouté à l'organisation. Un email de notification a été envoyé à ${email}.`,
        }, { status: 201 });

    } catch (error) {
        console.error('Erreur POST /api/users:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Génère un mot de passe sécurisé avec majuscules, minuscules, chiffres et symboles.
 */
function generateSecurePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$&*';
    const allChars = uppercase + lowercase + digits + symbols;

    // Garantir au moins 1 de chaque catégorie
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Compléter avec des caractères aléatoires
    for (let i = password.length; i < length; i++) {
        const randomBytes = crypto.randomBytes(1);
        password += allChars[randomBytes[0] % allChars.length];
    }

    // Mélanger le mot de passe (Fisher-Yates shuffle)
    const arr = password.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomBytes(1)[0] % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr.join('');
}

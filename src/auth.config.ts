/**
 * AUTH CONFIG - Configuration NextAuth v5 (Production Grade)
 * ===========================================================
 * Edge-compatible configuration.
 * Provider Credentials avec validation Zod + bcrypt.
 * Supporte multi-tenant, multi-membership (context switching).
 */

import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Role, MembershipScope, OrganizationType } from '@prisma/client';

// ─── Zod Schemas ──────────────────────────────────────────────

/** Schéma strict de validation des credentials */
const loginSchema = z.object({
    email: z
        .string()
        .email('Format email invalide')
        .min(1, 'Email requis')
        .max(255, 'Email trop long'),
    password: z
        .string()
        .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
        .max(128, 'Mot de passe trop long'),
});

// ─── Types internes (pas d'export, pas de any) ───────────────

interface MembershipData {
    organizationId: string;
    organizationName: string;
    organizationType: OrganizationType;
    role: Role;
    scope: MembershipScope;
    siteName: string | null;
    accessibleSites: { id: string; name: string }[];
}

// ─── Config ───────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
    pages: {
        signIn: '/login',
        error: '/login',
    },

    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnLogin = nextUrl.pathname.startsWith('/login');

            // Routes publiques
            if (isOnLogin || nextUrl.pathname === '/') {
                if (isLoggedIn) {
                    const memberships = auth?.user?.memberships;
                    if (Array.isArray(memberships) && memberships.length > 1) {
                        return Response.redirect(new URL('/portfolio', nextUrl));
                    }
                    return Response.redirect(new URL('/dashboard', nextUrl));
                }
                return true;
            }

            // Routes API — gérées par les handlers
            if (nextUrl.pathname.startsWith('/api/')) {
                return true;
            }

            // Routes protégées — exiger authentification
            if (!isLoggedIn) {
                return false; // NextAuth redirige vers /login
            }

            return true;
        },

        jwt({ token, user, trigger, session }) {
            // Sign in initial — persister dans le JWT
            if (user) {
                token.id = user.id as string;
                token.nom = user.nom;
                token.prenom = user.prenom;
                token.currentMembershipId = user.currentMembershipId;
                token.role = user.role;
                token.organizationId = user.organizationId;
                token.organizationType = user.organizationType;
                token.organizationName = user.organizationName;
                token.scope = user.scope;
                token.siteName = user.siteName;
                token.memberships = user.memberships;
            }

            // Context switch (changement d'organisation)
            if (trigger === 'update' && session?.switchToOrgId) {
                const targetMembership = (token.memberships as any[])?.find(
                    (m: any) => m.organizationId === session.switchToOrgId
                );
                if (targetMembership) {
                    token.currentMembershipId = `${token.id}_${targetMembership.organizationId}`;
                    token.role = targetMembership.role;
                    token.organizationId = targetMembership.organizationId;
                    token.organizationType = targetMembership.organizationType;
                    token.organizationName = targetMembership.organizationName;
                    token.scope = targetMembership.scope;
                    token.siteName = targetMembership.siteName;
                }
            }

            return token;
        },

        session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.nom = token.nom;
                session.user.prenom = token.prenom;
                session.user.currentMembershipId = token.currentMembershipId;
                session.user.role = token.role;
                session.user.organizationId = token.organizationId;
                session.user.organizationType = token.organizationType;
                session.user.organizationName = token.organizationName;
                session.user.scope = token.scope;
                (session.user as any).siteName = token.siteName;
                session.user.memberships = token.memberships;
            }
            return session;
        },
    },

    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Mot de passe', type: 'password' },
            },

            async authorize(credentials) {
                // ── 1. Validation Zod ────────────────────────────
                const parsed = loginSchema.safeParse(credentials);

                if (!parsed.success) {
                    console.log('[Auth] Validation failed:', parsed.error.flatten().fieldErrors);
                    return null;
                }

                const { email, password } = parsed.data;

                console.log(`[Auth] Attempting login for: ${email}`);

                try {
                    // ── 2. Fetch user + memberships ──────────────
                    const user = await prisma.user.findUnique({
                        where: { email },
                        select: {
                            id: true,
                            email: true,
                            passwordHash: true,
                            nom: true,
                            prenom: true,
                            isActive: true,
                            memberships: {
                                where: { isActive: true },
                                orderBy: { lastAccessedAt: 'desc' },
                                select: {
                                    userId: true,
                                    organizationId: true,
                                    role: true,
                                    scope: true,
                                    siteAccess: {
                                        select: {
                                            siteId: true,
                                            site: { select: { id: true, name: true } },
                                        },
                                    },
                                    organization: {
                                        select: {
                                            id: true,
                                            name: true,
                                            type: true,
                                            isActive: true,
                                        },
                                    },
                                },
                            },
                        },
                    });

                    // ── 3. Vérifications ─────────────────────────
                    if (!user || !user.passwordHash) {
                        console.log(`[Auth] Failed: user not found - ${email}`);
                        return null;
                    }

                    if (!user.isActive) {
                        console.log(`[Auth] Failed: user inactive - ${email}`);
                        return null;
                    }

                    // ── 4. bcrypt compare (JAMAIS en texte clair) ─
                    const isValid = await bcrypt.compare(password, user.passwordHash);

                    if (!isValid) {
                        console.log(`[Auth] Failed: invalid password - ${email}`);
                        return null;
                    }

                    // ── 5. Filtrer memberships actives ────────────
                    const activeMemberships = user.memberships.filter(
                        m => m.organization.isActive
                    );

                    if (activeMemberships.length === 0) {
                        console.log(`[Auth] Failed: no active memberships - ${email}`);
                        return null;
                    }

                    const primaryMembership = activeMemberships[0];

                    console.log(`[Auth] Success: ${email} (${primaryMembership.role}) @ ${primaryMembership.organization.name}`);
                    console.log(`[Auth] ${activeMemberships.length} active membership(s)`);

                    // ── 6. Build response ─────────────────────────
                    const membershipsList: any[] = activeMemberships.map(m => ({
                        organizationId: m.organization.id,
                        organizationName: m.organization.name,
                        organizationType: m.organization.type,
                        role: m.role,
                        scope: m.scope,
                        siteName: m.siteAccess[0]?.site.name,
                        accessibleSites: m.siteAccess.map(sa => ({
                            id: sa.siteId,
                            name: sa.site.name,
                        })),
                    }));

                    const primaryMembershipInfo = membershipsList[0];

                    return {
                        id: user.id,
                        email: user.email,
                        nom: user.nom,
                        prenom: user.prenom,
                        currentMembershipId: `${user.id}_${primaryMembership.organization.id}`,
                        role: primaryMembership.role,
                        organizationId: primaryMembership.organization.id,
                        organizationType: primaryMembership.organization.type,
                        organizationName: primaryMembership.organization.name,
                        scope: primaryMembership.scope,
                        siteName: primaryMembershipInfo.siteName,
                        memberships: membershipsList,
                    };
                } catch (error) {
                    console.error('[Auth] Database error during authorization:', error);
                    return null;
                }
            },
        }),
    ],

    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60, // 24 heures
    },

    secret: process.env.AUTH_SECRET,
};

/**
 * AUTH CONFIG - Configuration NextAuth v5 (Multi-Tenant + Multi-Membership)
 * ==========================================================================
 * Provider Credentials avec validation bcrypt.
 * Supporte les utilisateurs appartenant à plusieurs organisations (context switching).
 */

import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authConfig: NextAuthConfig = {
    pages: {
        signIn: '/login',
        error: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            const isOnLogin = nextUrl.pathname.startsWith('/login');
            const isOnApi = nextUrl.pathname.startsWith('/api');

            // Routes publiques
            if (isOnLogin || nextUrl.pathname === '/') {
                if (isLoggedIn) {
                    // Routing intelligent: multi-org → /portfolio, sinon → /dashboard
                    const memberships = (auth?.user as any)?.memberships;
                    if (Array.isArray(memberships) && memberships.length > 1) {
                        return Response.redirect(new URL('/portfolio', nextUrl));
                    }
                    return Response.redirect(new URL('/dashboard', nextUrl));
                }
                return true;
            }

            // Routes protégées
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect to login
            }

            // API routes - géré par les actions elles-mêmes
            if (isOnApi) {
                return true;
            }

            return true;
        },
        jwt({ token, user, trigger, session }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                token.nom = user.nom;
                token.prenom = user.prenom;
                // Membership context (selected org)
                token.currentMembershipId = user.currentMembershipId;
                token.role = user.role;
                token.organizationId = user.organizationId;
                token.organizationType = user.organizationType;
                token.organizationName = user.organizationName;
                token.scope = user.scope;
                // All memberships for switcher
                token.memberships = user.memberships;
            }

            if (trigger === 'update' && session?.switchToOrgId) {
                const targetMembership = (token.memberships as any[])?.find(
                    m => m.organizationId === session.switchToOrgId
                );
                if (targetMembership) {
                    token.currentMembershipId = `${token.id}_${targetMembership.organizationId}`;
                    token.role = targetMembership.role;
                    token.organizationId = targetMembership.organizationId;
                    token.organizationType = targetMembership.organizationType;
                    token.organizationName = targetMembership.organizationName;
                    token.scope = targetMembership.scope;
                }
            }

            return token;
        },
        session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.nom = token.nom;
                session.user.prenom = token.prenom;
                // Current membership context
                session.user.currentMembershipId = token.currentMembershipId;
                session.user.role = token.role;
                session.user.organizationId = token.organizationId;
                session.user.organizationType = token.organizationType;
                session.user.organizationName = token.organizationName;
                session.user.scope = token.scope;
                // All memberships for UI switcher
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
                console.log('[Auth] Starting authorization...');

                if (!credentials?.email || !credentials?.password) {
                    console.log('[Auth] Missing email or password');
                    return null;
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                console.log(`[Auth] Attempting login for: ${email}`);

                try {
                    // Récupérer l'utilisateur AVEC ses memberships
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

                    if (!user || !user.passwordHash) {
                        console.log(`[Auth] Login failed: user not found or no password - ${email}`);
                        return null;
                    }

                    if (!user.isActive) {
                        console.log(`[Auth] Login failed: user inactive - ${email}`);
                        return null;
                    }

                    // Filtrer les memberships vers des orgs actives
                    const activeMemberships = user.memberships.filter(m => m.organization.isActive);

                    if (activeMemberships.length === 0) {
                        console.log(`[Auth] Login failed: no active memberships - ${email}`);
                        return null;
                    }

                    // Vérifier le mot de passe
                    const isValid = await bcrypt.compare(password, user.passwordHash);

                    if (!isValid) {
                        console.log(`[Auth] Login failed: invalid password - ${email}`);
                        return null;
                    }

                    // Sélectionner le membership le plus récent (lastAccessedAt)
                    const primaryMembership = activeMemberships[0];

                    console.log(`[Auth] Login success: ${email} (${primaryMembership.role}) @ ${primaryMembership.organization.name}`);
                    console.log(`[Auth] User has ${activeMemberships.length} active membership(s)`);

                    // Construire la liste des memberships pour le switcher
                    const membershipsList = activeMemberships.map(m => ({
                        organizationId: m.organization.id,
                        organizationName: m.organization.name,
                        organizationType: m.organization.type,
                        role: m.role,
                        scope: m.scope,
                        // Liste des sites accessibles (vide si GLOBAL)
                        accessibleSites: m.siteAccess.map(sa => ({
                            id: sa.siteId,
                            name: sa.site.name,
                        })),
                    }));

                    return {
                        id: user.id,
                        email: user.email,
                        nom: user.nom,
                        prenom: user.prenom,
                        // Current membership context
                        currentMembershipId: `${user.id}_${primaryMembership.organization.id}`,
                        role: primaryMembership.role,
                        organizationId: primaryMembership.organization.id,
                        organizationType: primaryMembership.organization.type,
                        organizationName: primaryMembership.organization.name,
                        scope: primaryMembership.scope,
                        // All memberships for switcher
                        memberships: membershipsList,
                    };
                } catch (error) {
                    console.error('[Auth] Error during authorization:', error);
                    throw error;
                }
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60, // 24 heures
    },
    secret: process.env.AUTH_SECRET || 'polyx-dev-secret-change-in-production',
};

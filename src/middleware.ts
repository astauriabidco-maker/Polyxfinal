/**
 * MIDDLEWARE - Protection des Routes (Production Grade)
 * =====================================================
 * Applique l'authentification et la matrice RBAC sur toutes les routes.
 * Compatible Edge Runtime.
 * 
 * Basé sur: docs/rbac_matrix.md
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';

// ─── Routes RBAC ──────────────────────────────────────────────

const PROTECTED_ROUTES: Record<string, Role[]> = {
    // Admin only
    '/admin': ['ADMIN'],
    '/admin/users': ['ADMIN'],
    '/admin/settings': ['ADMIN'],

    // Finance routes
    '/dashboard/finance': ['RESP_ADMIN', 'ADMIN'],
    '/dashboard/facturation': ['RESP_ADMIN', 'ADMIN'],

    // Pédagogie routes
    '/dashboard/programmes': ['RESP_PEDAGO', 'ADMIN'],
    '/dashboard/certifications': ['RESP_PEDAGO', 'ADMIN'],

    // Qualité routes
    '/dashboard/qualite': ['REF_QUALITE', 'ADMIN'],
    '/dashboard/reclamations': ['REF_QUALITE', 'ADMIN'],

    // Dashboard général - tous les rôles authentifiés
    '/dashboard': ['ADMIN', 'RESP_PEDAGO', 'RESP_ADMIN', 'REF_QUALITE', 'FORMAT'],

    // Prospection - ADMIN + RESP_ADMIN can manage leads
    '/prospection': ['ADMIN', 'RESP_ADMIN', 'RESP_PEDAGO'],
    '/prospection/partners': ['ADMIN'],
};

// Routes publiques (pas d'auth requise)
const PUBLIC_ROUTES = [
    '/login',
    '/api/auth',
    '/franchise/apply',
    '/partners/docs',
    '/partners/onboarding',
];

// ─── Middleware Handler ───────────────────────────────────────

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const userRole = req.auth?.user?.role as Role | undefined;

    // Routes publiques
    const isPublicRoute = PUBLIC_ROUTES.some(route =>
        nextUrl.pathname === route || nextUrl.pathname.startsWith(route + '/')
    );

    if (isPublicRoute) {
        // Connecté sur /login → redirect intelligent
        if (isLoggedIn && nextUrl.pathname === '/login') {
            const memberships = req.auth?.user?.memberships;
            if (Array.isArray(memberships) && memberships.length > 1) {
                return NextResponse.redirect(new URL('/portfolio', nextUrl));
            }
            return NextResponse.redirect(new URL('/dashboard', nextUrl));
        }
        return NextResponse.next();
    }

    // Routes API — gérées par les handlers eux-mêmes
    if (nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Demo routes — accessibles si authentifié
    if (nextUrl.pathname.startsWith('/demo/')) {
        if (!isLoggedIn) {
            const loginUrl = new URL('/login', nextUrl);
            loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
            return NextResponse.redirect(loginUrl);
        }
        return NextResponse.next();
    }

    // Racine → redirect intelligent
    if (nextUrl.pathname === '/') {
        if (isLoggedIn) {
            const memberships = req.auth?.user?.memberships;
            if (Array.isArray(memberships) && memberships.length > 1) {
                return NextResponse.redirect(new URL('/portfolio', nextUrl));
            }
            return NextResponse.redirect(new URL('/dashboard', nextUrl));
        }
        return NextResponse.redirect(new URL('/login', nextUrl));
    }

    // Non connecté → login avec callbackUrl
    if (!isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Vérifier les permissions RBAC
    for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
        if (nextUrl.pathname === route || nextUrl.pathname.startsWith(route + '/')) {
            if (userRole && !allowedRoles.includes(userRole)) {
                console.log(`[RBAC] Access denied: ${userRole} → ${nextUrl.pathname}`);
                return NextResponse.redirect(new URL('/dashboard?error=forbidden', nextUrl));
            }
            break;
        }
    }

    return NextResponse.next();
});

// ─── Matcher Config ───────────────────────────────────────────

export const config = {
    matcher: [
        /*
         * Protège toutes les routes SAUF :
         * - _next/static (fichiers statiques)
         * - _next/image (optimisation images)  
         * - favicon.ico
         * - Images (png, jpg, svg, ico)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
    ],
};

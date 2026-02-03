/**
 * MIDDLEWARE - Protection RBAC des Routes
 * ========================================
 * Applique la matrice RBAC sur toutes les routes protégées.
 * 
 * Basé sur: docs/rbac_matrix.md
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Role } from '@prisma/client';

// Routes qui nécessitent des rôles spécifiques
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
};

// Routes publiques (pas d'auth requise)
const PUBLIC_ROUTES = [
    '/login',
    '/api/auth',
    '/',
];

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const userRole = req.auth?.user?.role as Role | undefined;

    // Routes publiques
    const isPublicRoute = PUBLIC_ROUTES.some(route =>
        nextUrl.pathname === route || nextUrl.pathname.startsWith(route + '/')
    );

    if (isPublicRoute) {
        // Si connecté et sur login, redirect vers dashboard
        if (isLoggedIn && nextUrl.pathname === '/login') {
            return NextResponse.redirect(new URL('/dashboard', nextUrl));
        }
        // Si connecté et sur racine, redirect intelligent selon nombre d'orgs
        if (isLoggedIn && nextUrl.pathname === '/') {
            const memberships = req.auth?.user?.memberships;
            // Multi-org → Portfolio, sinon → Dashboard
            if (memberships && memberships.length > 1) {
                return NextResponse.redirect(new URL('/portfolio', nextUrl));
            }
            return NextResponse.redirect(new URL('/dashboard', nextUrl));
        }
        return NextResponse.next();
    }

    // Routes API (gérées par les handlers eux-mêmes)
    if (nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Non connecté → login
    if (!isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Vérifier les permissions RBAC
    for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
        if (nextUrl.pathname === route || nextUrl.pathname.startsWith(route + '/')) {
            if (userRole && !allowedRoles.includes(userRole)) {
                // Accès refusé - rediriger vers page 403 ou dashboard
                console.log(`[RBAC] Access denied: ${userRole} tried to access ${nextUrl.pathname}`);
                return NextResponse.redirect(new URL('/dashboard?error=forbidden', nextUrl));
            }
            break;
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        // Protéger toutes les routes sauf fichiers statiques et images
        '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
    ],
};

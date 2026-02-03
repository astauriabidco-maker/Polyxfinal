/**
 * AUTH - NextAuth v5 Exports
 * ==========================
 * Point d'entrée principal pour l'authentification.
 * 
 * Usage:
 *   import { auth, signIn, signOut } from '@/auth';
 *   const session = await auth();
 */

import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth(authConfig);

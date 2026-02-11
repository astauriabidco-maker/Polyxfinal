/**
 * AUTH ACTIONS - Server Actions d'authentification
 * =================================================
 * Actions serveur pour login/logout compatibles avec useFormState.
 * Gestion d'erreurs propre avec messages utilisateur en français.
 */

'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────

export interface AuthActionState {
    error: string | null;
    success: boolean;
}

// ─── Validation ───────────────────────────────────────────────

const loginSchema = z.object({
    email: z
        .string()
        .email('Format email invalide')
        .min(1, 'L\'email est requis'),
    password: z
        .string()
        .min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

// ─── Login Action ─────────────────────────────────────────────

/**
 * Action serveur d'authentification.
 * Compatible avec `useFormState` (signature: prevState, formData).
 */
export async function authenticate(
    prevState: AuthActionState | undefined,
    formData: FormData
): Promise<AuthActionState> {
    // Validation côté serveur
    const rawData = {
        email: formData.get('email'),
        password: formData.get('password'),
    };

    const parsed = loginSchema.safeParse(rawData);

    if (!parsed.success) {
        const firstError = parsed.error.errors[0]?.message ?? 'Données invalides';
        return { error: firstError, success: false };
    }

    try {
        await signIn('credentials', {
            email: parsed.data.email,
            password: parsed.data.password,
            redirectTo: '/dashboard',
        });

        // signIn redirige — ce code n'est jamais atteint en cas de succès
        return { error: null, success: true };
    } catch (error) {
        // NextAuth lance NEXT_REDIRECT en cas de succès — on le laisse passer
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }

        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return {
                        error: 'Email ou mot de passe incorrect',
                        success: false,
                    };
                case 'CallbackRouteError':
                    return {
                        error: 'Erreur lors de la connexion. Vérifiez vos identifiants.',
                        success: false,
                    };
                default:
                    return {
                        error: 'Une erreur inattendue est survenue',
                        success: false,
                    };
            }
        }

        // Erreur inconnue — log côté serveur, message générique côté client
        console.error('[Auth Action] Unexpected error:', error);
        return {
            error: 'Erreur de connexion au serveur',
            success: false,
        };
    }
}

// ─── Logout Action ────────────────────────────────────────────

/**
 * Action serveur de déconnexion.
 */
export async function signOutAction(): Promise<void> {
    await signOut({ redirectTo: '/login' });
}

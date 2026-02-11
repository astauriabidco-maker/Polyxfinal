/**
 * SIGN OUT BUTTON - Composant de déconnexion
 * ============================================
 * Bouton client appelant la server action signOutAction.
 * Affiche un spinner pendant la déconnexion.
 */

'use client';

import { useTransition } from 'react';
import { signOutAction } from '@/lib/actions/auth';

interface SignOutButtonProps {
    /** Style variant */
    variant?: 'default' | 'minimal' | 'danger';
    /** Custom CSS class */
    className?: string;
}

export default function SignOutButton({ variant = 'default', className }: SignOutButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleSignOut = () => {
        startTransition(async () => {
            await signOutAction();
        });
    };

    const baseStyles = 'flex items-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
        default: 'px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600',
        minimal: 'px-3 py-1.5 text-sm text-slate-400 hover:text-white',
        danger: 'px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-800/30 hover:border-red-700/50',
    };

    return (
        <button
            onClick={handleSignOut}
            disabled={isPending}
            className={`${baseStyles} ${variantStyles[variant]} ${className ?? ''}`}
        >
            {isPending ? (
                <>
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span>Déconnexion...</span>
                </>
            ) : (
                <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Déconnexion</span>
                </>
            )}
        </button>
    );
}

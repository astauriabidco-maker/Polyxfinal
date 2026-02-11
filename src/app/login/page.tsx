/**
 * LOGIN PAGE - Authentification Professionnelle
 * ===============================================
 * Page de connexion avec useFormState + useFormStatus.
 * Validation Zod côté client et serveur.
 * Design premium dark mode.
 */

'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { authenticate, type AuthActionState } from '@/lib/actions/auth';
import Link from 'next/link';

// ─── Submit Button with Loading State ─────────────────────────

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            aria-disabled={pending}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 
                     hover:from-emerald-500 hover:to-emerald-400 
                     text-white font-semibold transition-all duration-200 
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
                     disabled:opacity-60 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
            {pending ? (
                <>
                    <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span>Connexion en cours...</span>
                </>
            ) : (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Se connecter</span>
                </>
            )}
        </button>
    );
}

// ─── Login Page ───────────────────────────────────────────────

const initialState: AuthActionState = { error: null, success: false };

export default function LoginPage() {
    const [state, formAction] = useFormState(authenticate, initialState);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 mb-4 shadow-lg shadow-emerald-500/20">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Polyx ERP Formation
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Système de gestion Qualiopi
                    </p>
                </div>

                {/* Error Message */}
                {state?.error && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-center gap-3">
                        <svg className="w-5 h-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-400">
                            {state.error}
                        </p>
                    </div>
                )}

                {/* Login Form Card */}
                <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl shadow-black/20">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Connexion
                    </h2>

                    <form action={formAction} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                                Adresse email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="votre@email.com"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                         text-white placeholder-slate-500 
                                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 
                                         transition-all duration-200"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                                    Mot de passe
                                </label>
                                <Link
                                    href="#"
                                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                         text-white placeholder-slate-500 
                                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 
                                         transition-all duration-200"
                            />
                        </div>

                        {/* Submit */}
                        <SubmitButton />
                    </form>
                </div>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>Connexion sécurisée • Chiffrement TLS</span>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-4">
                    © 2024 Polyx Formation • Conformité Qualiopi
                </p>
            </div>
        </div>
    );
}

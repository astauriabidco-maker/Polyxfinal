/**
 * LOGIN PAGE - Authentification
 * ==============================
 * Page de connexion avec formulaire et boutons de test rapide.
 */

import { signIn } from '@/auth';
import { redirect } from 'next/navigation';

// Test users for quick login (Multi-Tenant)
const TEST_USERS = [
    { email: 'admin@academy-pro.com', role: 'ADMIN', label: '🏢 Academy Pro', color: 'emerald' },
    { email: 'pedago@academy-pro.com', role: 'RESP_PEDAGO', label: '👩‍🏫 Pedagogue', color: 'blue' },
    { email: 'admin@cfa-avenir.com', role: 'ADMIN', label: '🏫 CFA Avenir', color: 'amber' },
    { email: 'admin@starter-formation.com', role: 'ADMIN', label: '🌱 Starter', color: 'purple' },
];

export default async function LoginPage({
    searchParams,
}: {
    searchParams: { error?: string; callbackUrl?: string };
}) {
    const error = searchParams.error;
    const callbackUrl = searchParams.callbackUrl || '/dashboard';

    async function handleCredentialsLogin(formData: FormData) {
        'use server';

        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            await signIn('credentials', {
                email,
                password,
                redirectTo: callbackUrl,
            });
        } catch (err) {
            // NextAuth throws NEXT_REDIRECT on success, so we need to rethrow
            throw err;
        }
    }

    async function handleQuickLogin(formData: FormData) {
        'use server';

        const email = formData.get('email') as string;

        try {
            await signIn('credentials', {
                email,
                password: 'password123',
                redirectTo: '/dashboard',
            });
        } catch (err) {
            throw err;
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo / Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 mb-4">
                        <span className="text-3xl">📚</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        Polyx ERP Formation
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Système de gestion Qualiopi
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50">
                        <p className="text-sm text-red-400 text-center">
                            {error === 'forbidden'
                                ? '🚫 Accès refusé à cette page'
                                : '❌ Email ou mot de passe incorrect'}
                        </p>
                    </div>
                )}

                {/* Login Form Card */}
                <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Connexion
                    </h2>

                    <form action={handleCredentialsLogin} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="votre@email.com"
                                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 
                                         text-white placeholder-slate-500 focus:outline-none focus:ring-2 
                                         focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Mot de passe
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 
                                         text-white placeholder-slate-500 focus:outline-none focus:ring-2 
                                         focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 
                                     text-white font-medium transition-all duration-200 
                                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                            Se connecter
                        </button>
                    </form>
                </div>

                {/* Quick Login (Dev Only) */}
                <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-amber-500">⚡</span>
                        <h3 className="text-sm font-semibold text-slate-300">
                            Connexion Rapide (Dev)
                        </h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                        Mot de passe : <code className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">password123</code>
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                        {TEST_USERS.map((user) => (
                            <form key={user.email} action={handleQuickLogin}>
                                <input type="hidden" name="email" value={user.email} />
                                <button
                                    type="submit"
                                    className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all
                                              bg-${user.color}-950/50 border border-${user.color}-800/50 
                                              text-${user.color}-400 hover:bg-${user.color}-900/50`}
                                    style={{
                                        backgroundColor: user.color === 'emerald' ? 'rgba(6, 78, 59, 0.5)' :
                                            user.color === 'blue' ? 'rgba(30, 58, 138, 0.5)' :
                                                user.color === 'amber' ? 'rgba(120, 53, 15, 0.5)' :
                                                    'rgba(88, 28, 135, 0.5)',
                                        borderColor: user.color === 'emerald' ? 'rgba(6, 95, 70, 0.5)' :
                                            user.color === 'blue' ? 'rgba(30, 64, 175, 0.5)' :
                                                user.color === 'amber' ? 'rgba(146, 64, 14, 0.5)' :
                                                    'rgba(107, 33, 168, 0.5)',
                                        color: user.color === 'emerald' ? '#34d399' :
                                            user.color === 'blue' ? '#60a5fa' :
                                                user.color === 'amber' ? '#fbbf24' :
                                                    '#c084fc',
                                    }}
                                >
                                    {user.label}
                                </button>
                            </form>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-6">
                    © 2024 Polyx Formation • Conformité Qualiopi
                </p>
            </div>
        </div>
    );
}

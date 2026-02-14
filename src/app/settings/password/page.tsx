/**
 * SETTINGS PASSWORD PAGE — Changement de mot de passe
 * =====================================================
 * Page accessible depuis le menu utilisateur.
 * Formulaire avec validation client + appel API.
 * Même design dark mode premium que la page login.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ChangePasswordPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation client
        if (formData.newPassword.length < 8) {
            setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
            return;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
            setError('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        if (formData.currentPassword === formData.newPassword) {
            setError('Le nouveau mot de passe doit être différent de l\'ancien.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors du changement de mot de passe');
            }

            setSuccess(data.message || 'Mot de passe mis à jour avec succès.');
            setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 mb-4 shadow-lg shadow-amber-500/20">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Changer le mot de passe
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Sécurisez votre compte avec un nouveau mot de passe
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-center gap-3">
                        <svg className="w-5 h-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-800/50 flex items-center gap-3">
                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-emerald-400">{success}</p>
                    </div>
                )}

                {/* Form Card */}
                <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl shadow-black/20">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Nouveau mot de passe
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Current Password */}
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                Mot de passe actuel
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={formData.currentPassword}
                                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                         text-white placeholder-slate-500 
                                         focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 
                                         transition-all duration-200"
                                placeholder="Votre mot de passe actuel"
                            />
                        </div>

                        {/* New Password */}
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                Nouveau mot de passe
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={8}
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                         text-white placeholder-slate-500 
                                         focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 
                                         transition-all duration-200"
                                placeholder="Minimum 8 caractères"
                            />
                            <p className="mt-1.5 text-xs text-slate-500">
                                Au moins 8 caractères avec une majuscule, une minuscule et un chiffre.
                            </p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                Confirmer le nouveau mot de passe
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={8}
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 
                                         text-white placeholder-slate-500 
                                         focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 
                                         transition-all duration-200"
                                placeholder="Retapez le nouveau mot de passe"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 
                                     hover:from-amber-500 hover:to-amber-400 
                                     text-white font-semibold transition-all duration-200 
                                     focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
                                     disabled:opacity-60 disabled:cursor-not-allowed
                                     flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Mise à jour en cours...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Mettre à jour le mot de passe</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Back link */}
                <div className="mt-6 text-center">
                    <Link
                        href="/dashboard"
                        className="text-sm text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Retour au dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}

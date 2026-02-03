/**
 * PORTFOLIO PAGE - Vue "Tour de Contrôle"
 * ========================================
 * Point d'entrée pour utilisateurs multi-organisations.
 * Affiche une grille de cartes avec métriques par organisation.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getUserPortfolioStats } from '@/lib/dashboard/portfolio';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const portfolioItems = await getUserPortfolioStats(session.user.id);

    // Si une seule org, redirect direct vers dashboard
    if (portfolioItems.length === 1) {
        redirect('/dashboard');
    }

    // Si aucune org, problème
    if (portfolioItems.length === 0) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Aucune organisation</h1>
                    <p className="text-slate-400">
                        Vous n'êtes membre d'aucune organisation active.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <header className="bg-slate-900/50 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold">P</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-white">Tour de Contrôle</h1>
                            <p className="text-sm text-slate-400">
                                {session.user.prenom} {session.user.nom}
                            </p>
                        </div>
                    </div>
                    <form action="/api/auth/signout" method="POST">
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                        >
                            Déconnexion
                        </button>
                    </form>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Vos Organisations</h2>
                    <p className="text-slate-400">
                        Sélectionnez une organisation pour accéder à son tableau de bord.
                    </p>
                </div>

                <PortfolioGrid items={portfolioItems} />
            </main>
        </div>
    );
}

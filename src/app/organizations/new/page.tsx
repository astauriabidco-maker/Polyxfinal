/**
 * PAGE: Nouvelle Organisation
 * ===========================
 * Page de création d'une nouvelle organisation avec formulaire complet.
 */

'use client';

import Sidebar from '@/components/layout/Sidebar';
import OrganizationCreateForm from '@/components/organizations/OrganizationCreateForm';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewOrganizationPage() {
    const router = useRouter();

    const handleSuccess = (org: { id: string; name: string }) => {
        // Rediriger vers le portfolio après création
        router.push('/portfolio');
    };

    return (
        <div className="min-h-screen bg-slate-950 flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 ml-64 transition-all duration-300">
                {/* Header */}
                <header className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/portfolio"
                                className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-xl font-semibold text-white">Nouvelle Organisation</h1>
                                <p className="text-sm text-slate-400">Créez un nouvel organisme de formation</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="p-6 max-w-4xl mx-auto">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                        <Link href="/portfolio" className="hover:text-white transition-colors">
                            Tour de Contrôle
                        </Link>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-white">Nouvelle Organisation</span>
                    </nav>

                    {/* Info Card */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-blue-300 font-medium mb-1">Types d'organismes</h3>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    <li><strong className="text-white">OF Standard</strong> — Formation professionnelle continue</li>
                                    <li><strong className="text-orange-400">CFA</strong> — Centre de Formation d'Apprentis (règles spécifiques UAI, entreprise, tuteur)</li>
                                    <li><strong className="text-white">Bilan</strong> — Bilan de compétences</li>
                                    <li><strong className="text-white">VAE</strong> — Validation des Acquis de l'Expérience</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Formulaire */}
                    <OrganizationCreateForm
                        onSuccess={handleSuccess}
                        onCancel={() => router.push('/portfolio')}
                    />
                </div>
            </main>
        </div>
    );
}

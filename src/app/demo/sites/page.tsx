/**
 * PAGE DÉMO: Création de Site CFA
 * ================================
 * Page de démonstration pour le formulaire de création de site
 * avec validation UAI intégrée.
 */

'use client';

import SiteCreateForm from '@/components/sites/SiteCreateForm';
import Link from 'next/link';

export default function SiteCreateDemoPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Navigation */}
            <nav className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/demo/compliance"
                            className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Retour
                        </Link>
                        <h1 className="text-white font-semibold">Démo: Formulaire Site CFA</h1>
                        <div className="w-20" /> {/* Spacer */}
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Header explicatif */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">
                        Création de Site CFA
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Démonstration du formulaire de création de site avec validation
                        <span className="text-blue-400 font-medium"> UAI obligatoire </span>
                        pour les Centres de Formation d'Apprentis (CFA).
                    </p>
                </div>

                {/* Règles CFA */}
                <div className="mb-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                    <h3 className="text-blue-300 font-semibold flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Règles CFA Appliquées
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span><strong className="text-white">Code UAI obligatoire</strong> - Format: 7 chiffres + 1 lettre (ex: 0751234A)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span><strong className="text-white">Validation temps réel</strong> - Le formulaire valide le format au fur et à mesure</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span><strong className="text-white">Unicité vérifiée</strong> - Impossible de créer deux sites avec le même UAI</span>
                        </li>
                    </ul>
                </div>

                {/* Formulaires côte à côte */}
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Formulaire CFA */}
                    <div>
                        <div className="mb-4 flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-white font-medium">Organisation CFA</span>
                        </div>
                        <SiteCreateForm
                            organizationId="demo-cfa-org"
                            organizationType="CFA"
                            organizationName="Grand Réseau CFA France"
                            onCancel={() => { }}
                        />
                    </div>

                    {/* Formulaire OF Standard */}
                    <div>
                        <div className="mb-4 flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span className="text-white font-medium">Organisation OF Standard</span>
                        </div>
                        <SiteCreateForm
                            organizationId="demo-of-org"
                            organizationType="OF_STANDARD"
                            organizationName="Formation Sud Network"
                            onCancel={() => { }}
                        />
                    </div>
                </div>

                {/* Exemples de codes UAI */}
                <div className="mt-10 bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                    <h3 className="text-gray-300 font-medium mb-4">Exemples de codes UAI</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {['0751234A', '0132456B', '0693578K', '0441234Z'].map((code) => (
                            <div
                                key={code}
                                className="bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-center"
                            >
                                <code className="text-emerald-400 font-mono text-lg">{code}</code>
                                <p className="text-gray-500 text-xs mt-1">Valide</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        {['075234A', 'ABCDEFGH', '12345678', '0751234'].map((code) => (
                            <div
                                key={code}
                                className="bg-gray-900/50 border border-red-900/50 rounded-lg px-4 py-3 text-center"
                            >
                                <code className="text-red-400 font-mono text-lg">{code}</code>
                                <p className="text-gray-500 text-xs mt-1">Invalide</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

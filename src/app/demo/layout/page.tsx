/**
 * PAGE DÉMO: Layout avec Sidebar
 * ================================
 * Page de démonstration pour visualiser la sidebar complète.
 */

'use client';

import Sidebar from '@/components/layout/Sidebar';

export default function LayoutDemoPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 ml-64 transition-all duration-300">
                {/* Header */}
                <header className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
                    <h1 className="text-xl font-semibold text-white">Démo: Navigation Sidebar</h1>
                    <p className="text-sm text-slate-400">Testez la navigation et l'état collapsed/expanded</p>
                </header>

                {/* Content Grid */}
                <div className="p-6">
                    {/* Instructions */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-6">
                        <h3 className="text-blue-300 font-semibold flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Instructions
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">→</span>
                                <span>Cliquez sur les <strong className="text-white">flèches &lt;&lt;</strong> en haut de la sidebar pour la réduire</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">→</span>
                                <span>En mode réduit, <strong className="text-white">survolez les icônes</strong> pour voir les tooltips</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">→</span>
                                <span>Les liens actifs sont <strong className="text-blue-400">surlignés en bleu</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">→</span>
                                <span>Les liens grisés avec "Bientôt" sont des <strong className="text-slate-400">fonctionnalités à venir</strong></span>
                            </li>
                        </ul>
                    </div>

                    {/* Menu Structure */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section Principal */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                Principal
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-slate-300">
                                    <span className="text-lg">📊</span>
                                    <div>
                                        <p className="font-medium">Tour de Contrôle</p>
                                        <p className="text-xs text-slate-500">/portfolio - Vue multi-organisations</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <span className="text-lg">📈</span>
                                    <div>
                                        <p className="font-medium">Tableau de Bord</p>
                                        <p className="text-xs text-slate-500">/dashboard - Gestion des dossiers</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Section Gestion */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                Gestion
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-slate-300">
                                    <span className="text-lg">📁</span>
                                    <div>
                                        <p className="font-medium">Dossiers</p>
                                        <p className="text-xs text-slate-500">Liste des dossiers de formation</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <span className="text-lg">🏢</span>
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <p className="font-medium">Sites</p>
                                            <p className="text-xs text-slate-500">/demo/sites - Gestion des sites CFA</p>
                                        </div>
                                        <span className="px-2 py-0.5 text-xs bg-orange-500 text-white rounded-full">CFA</span>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Section Conformité */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                Conformité
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-slate-300">
                                    <span className="text-lg">🛡️</span>
                                    <div>
                                        <p className="font-medium">Moteur de Règles</p>
                                        <p className="text-xs text-slate-500">/demo/compliance - 18 règles actives</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3 text-slate-400">
                                    <span className="text-lg opacity-50">📋</span>
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <p className="font-medium opacity-50">Qualiopi</p>
                                            <p className="text-xs text-slate-600">Audit et conformité Qualiopi</p>
                                        </div>
                                        <span className="px-2 py-0.5 text-xs bg-slate-600 text-slate-300 rounded-full">Bientôt</span>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Section Paramètres */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                Paramètres
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-slate-400">
                                    <span className="text-lg opacity-50">⚙️</span>
                                    <div>
                                        <p className="font-medium opacity-50">Organisation</p>
                                        <p className="text-xs text-slate-600">Configuration de l'organisme</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3 text-slate-400">
                                    <span className="text-lg opacity-50">👥</span>
                                    <div>
                                        <p className="font-medium opacity-50">Utilisateurs</p>
                                        <p className="text-xs text-slate-600">Gestion des comptes et rôles</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-8 grid grid-cols-4 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-emerald-400">4</div>
                            <div className="text-xs text-emerald-300 uppercase tracking-wider">Pages Actives</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-blue-400">18</div>
                            <div className="text-xs text-blue-300 uppercase tracking-wider">Règles Compliance</div>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-orange-400">8</div>
                            <div className="text-xs text-orange-300 uppercase tracking-wider">Règles CFA</div>
                        </div>
                        <div className="bg-slate-500/10 border border-slate-500/30 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-slate-400">4</div>
                            <div className="text-xs text-slate-300 uppercase tracking-wider">À Venir</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

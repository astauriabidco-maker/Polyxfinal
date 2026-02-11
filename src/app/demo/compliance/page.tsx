/**
 * PAGE DE DÉMONSTRATION COMPLIANCE
 * =================================
 * Affiche les 3 scénarios de test avec leurs badges de conformité.
 * 
 * URL: /demo/compliance
 */

import { PrismaClient } from '@prisma/client';
import ComplianceStatusBadge from '@/components/compliance/ComplianceStatusBadge';
import DashboardLayout from '@/components/layout/DashboardLayout';

const prisma = new PrismaClient();

export default async function ComplianceDemoPage() {
    // Récupérer les dossiers de test
    const dossiers = await prisma.dossier.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
            session: {
                include: {
                    programme: true,
                },
            },
            contrats: {
                include: {
                    financeur: true,
                },
            },
        },
    });

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* Header */}
                <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
                                    <svg width="16" height="16" className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Polyx ERP Formation</h1>
                                    <p className="text-sm text-slate-400">Compliance Engine Demo</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30">
                                v1.0.0
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-6 py-8">
                    {/* Title Section */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-white mb-2">
                            🔍 Test du Moteur de Conformité
                        </h2>
                        <p className="text-slate-400">
                            Visualisation en temps réel des validations Qualiopi sur les dossiers de test.
                        </p>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Dossiers Conformes</span>
                                <span className="text-2xl font-bold text-emerald-400">
                                    {dossiers.filter(d => Number(d.tauxAssiduite) >= 100 && d.contrats.some(c => c.isSigned)).length}
                                </span>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Dossiers Bloqués</span>
                                <span className="text-2xl font-bold text-red-400">
                                    {dossiers.filter(d => Number(d.tauxAssiduite) < 100 || !d.contrats.some(c => c.isSigned)).length}
                                </span>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Total Règles</span>
                                <span className="text-2xl font-bold text-cyan-400">9</span>
                            </div>
                        </div>
                    </div>

                    {/* Dossiers Cards */}
                    <div className="space-y-6">
                        {dossiers.map((dossier, index) => {
                            const contrat = dossier.contrats[0];
                            const scenarioName =
                                dossier.stagiairePrenom === 'Alice' ? '📗 Happy Path' :
                                    dossier.stagiairePrenom === 'Bob' ? '📕 The Cheater' :
                                        '📙 Admin Défaillant';

                            const scenarioDesc =
                                dossier.stagiairePrenom === 'Alice' ? 'Dossier parfait - Peut aller jusqu\'à CLOTURE' :
                                    dossier.stagiairePrenom === 'Bob' ? 'Assiduité 40% - Bloqué par RULE_ASSIDUITE' :
                                        'Sans financement - Bloqué par RULE_CONTRAT_SIGNE';

                            return (
                                <div
                                    key={dossier.id}
                                    className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-all duration-300"
                                >
                                    {/* Card Header */}
                                    <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-2xl">{scenarioName.split(' ')[0]}</span>
                                                    <h3 className="text-lg font-semibold text-white">
                                                        Scénario {index + 1}: {scenarioName.split(' ').slice(1).join(' ')}
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-slate-400 mt-1">{scenarioDesc}</p>
                                            </div>
                                            {/* BADGE DE CONFORMITÉ */}
                                            <ComplianceStatusBadge dossierId={dossier.id} size="md" />
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="px-6 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* Stagiaire */}
                                            <div className="space-y-1">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Stagiaire</span>
                                                <p className="text-white font-medium">
                                                    {dossier.stagiairePrenom} {dossier.stagiaireNom}
                                                </p>
                                                <p className="text-sm text-slate-400">{dossier.stagiaireEmail}</p>
                                            </div>

                                            {/* Statut */}
                                            <div className="space-y-1">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Statut</span>
                                                <p className="text-white font-medium">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-700 text-slate-300">
                                                        {dossier.status}
                                                    </span>
                                                </p>
                                                <p className="text-sm text-slate-400">Phase {dossier.phaseActuelle}/5</p>
                                            </div>

                                            {/* Assiduité */}
                                            <div className="space-y-1">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Assiduité</span>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${Number(dossier.tauxAssiduite) >= 100 ? 'bg-emerald-500' :
                                                                Number(dossier.tauxAssiduite) >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: `${Math.min(100, Number(dossier.tauxAssiduite))}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-sm font-medium ${Number(dossier.tauxAssiduite) >= 100 ? 'text-emerald-400' :
                                                        Number(dossier.tauxAssiduite) >= 70 ? 'text-amber-400' : 'text-red-400'
                                                        }`}>
                                                        {Number(dossier.tauxAssiduite)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Contrat */}
                                            <div className="space-y-1">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Contrat</span>
                                                <div className="flex items-center space-x-2">
                                                    {contrat?.isSigned ? (
                                                        <span className="inline-flex items-center text-emerald-400 text-sm">
                                                            <svg width="16" height="16" className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                            Signé
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-red-400 text-sm">
                                                            <svg width="16" height="16" className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                            </svg>
                                                            Non signé
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-400">
                                                    {contrat?.financeur?.type || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="px-6 py-3 bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-between">
                                        <span className="text-xs text-slate-500 font-mono">
                                            ID: {dossier.id.slice(0, 12)}...
                                        </span>
                                        <div className="flex items-center space-x-4">
                                            {dossier.certificatGenere && (
                                                <span className="text-xs text-emerald-400 flex items-center">
                                                    <svg width="16" height="16" className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    Certificat
                                                </span>
                                            )}
                                            {dossier.factureGeneree && (
                                                <span className="text-xs text-cyan-400 flex items-center">
                                                    <svg width="16" height="16" className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                                    </svg>
                                                    Facturé
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Légende des Badges</h4>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <svg width="16" height="16" className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Conforme
                                </span>
                                <span className="text-xs text-slate-400">Prêt pour l'étape suivante</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-300">
                                    <svg width="16" height="16" className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Warning
                                </span>
                                <span className="text-xs text-slate-400">Vérifications recommandées</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-300">
                                    <svg width="16" height="16" className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    Bloqué
                                </span>
                                <span className="text-xs text-slate-400">Action requise (survol pour détails)</span>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="border-t border-slate-700/50 mt-12">
                    <div className="max-w-7xl mx-auto px-6 py-4 text-center text-slate-500 text-sm">
                        Polyx ERP Formation • Compliance by Design • Qualiopi Ready
                    </div>
                </footer>
            </div>
        </DashboardLayout>
    );
}


/**
 * TABLEAU DE BORD SUIVI QUALIOPI
 * ================================
 * Visualisation de la conformité Qualiopi par les 7 critères RNQ.
 * 
 * URL: /dashboard/qualiopi
 * @Compliance: Suivi du Référentiel National Qualité
 */

import { PrismaClient } from '@prisma/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

const prisma = new PrismaClient();

// Les 7 critères du Référentiel National Qualité (RNQ)
const CRITERES_RNQ = [
    {
        id: 1,
        nom: 'Information du public',
        description: 'Conditions d\'accès, objectifs, durée, résultats',
        indicateurs: [1, 2, 3],
        icon: '📢',
    },
    {
        id: 2,
        nom: 'Identification des objectifs',
        description: 'Analyse du besoin, objectifs opérationnels',
        indicateurs: [4, 5, 6, 7],
        icon: '🎯',
    },
    {
        id: 3,
        nom: 'Adaptation des prestations',
        description: 'Procédures de positionnement et d\'adaptation',
        indicateurs: [8, 9, 10, 11, 12, 13],
        icon: '⚙️',
    },
    {
        id: 4,
        nom: 'Moyens pédagogiques',
        description: 'Ressources humaines, techniques et pédagogiques',
        indicateurs: [14, 15, 16],
        icon: '📚',
    },
    {
        id: 5,
        nom: 'Qualification des personnels',
        description: 'Compétences des formateurs et intervenants',
        indicateurs: [17, 18, 19, 20],
        icon: '👨‍🏫',
    },
    {
        id: 6,
        nom: 'Inscription dans l\'environnement',
        description: 'Veille légale, partenariats, handicap',
        indicateurs: [21, 22, 23, 24, 25, 26],
        icon: '🌐',
    },
    {
        id: 7,
        nom: 'Amélioration continue',
        description: 'Réclamations, actions correctives, satisfaction',
        indicateurs: [27, 28, 29, 30, 31, 32],
        icon: '📈',
    },
];

// Fonction pour calculer le score d'un critère basé sur les données
function calculateCritereScore(critereId: number, org: {
    qualiopiCertified: boolean;
    qualiopiExpiry: Date | null;
    cgvUrl: string | null;
    livretAccueilUrl: string | null;
    reglementInterieurUrl: string | null;
}, stats: {
    totalProgrammes: number;
    publishedProgrammes: number;
    totalDossiers: number;
    completedDossiers: number;
    reclamationsCount: number;
    resolvedReclamations: number;
}): number {
    switch (critereId) {
        case 1: // Information du public
            let score1 = 0;
            if (org.cgvUrl) score1 += 40;
            if (org.livretAccueilUrl) score1 += 30;
            if (org.reglementInterieurUrl) score1 += 30;
            return score1;

        case 2: // Identification des objectifs
            if (stats.totalProgrammes === 0) return 0;
            return Math.round((stats.publishedProgrammes / stats.totalProgrammes) * 100);

        case 3: // Adaptation des prestations
            if (stats.totalDossiers === 0) return 50; // Pas de données
            return Math.min(100, 50 + (stats.completedDossiers / stats.totalDossiers) * 50);

        case 4: // Moyens pédagogiques
            return org.qualiopiCertified ? 80 : 30;

        case 5: // Qualification des personnels
            return org.qualiopiCertified ? 75 : 25;

        case 6: // Inscription dans l'environnement
            return org.qualiopiCertified ? 85 : 40;

        case 7: // Amélioration continue
            if (stats.reclamationsCount === 0) return 100;
            return Math.round((stats.resolvedReclamations / stats.reclamationsCount) * 100);

        default:
            return 50;
    }
}

// Fonction pour obtenir la couleur selon le score
function getScoreColor(score: number): string {
    if (score >= 80) return 'emerald';
    if (score >= 60) return 'amber';
    return 'red';
}

export default async function QualiopiDashboard() {
    // Récupérer toutes les organisations
    const organizations = await prisma.organization.findMany({
        where: { isActive: true },
        include: {
            programmes: true,
            dossiers: true,
            reclamations: true,
        },
    });

    // Calculer les statistiques globales
    const globalStats = {
        totalOrgs: organizations.length,
        certifiedOrgs: organizations.filter(o => o.qualiopiCertified).length,
        expiringOrgs: organizations.filter(o => {
            if (!o.qualiopiExpiry) return false;
            const daysUntilExpiry = Math.floor((o.qualiopiExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
        }).length,
        expiredOrgs: organizations.filter(o => {
            if (!o.qualiopiExpiry) return false;
            return o.qualiopiExpiry < new Date();
        }).length,
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* Header */}
                <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Suivi Qualiopi</h1>
                                    <p className="text-sm text-slate-400">Référentiel National Qualité</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full border border-purple-500/30">
                                RNQ 2022
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-6 py-8">
                    {/* KPIs Globaux */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Organisations</span>
                                <span className="text-2xl font-bold text-white">{globalStats.totalOrgs}</span>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-emerald-500/30">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Certifiées Qualiopi</span>
                                <span className="text-2xl font-bold text-emerald-400">{globalStats.certifiedOrgs}</span>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-amber-500/30">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Expiration &lt; 90j</span>
                                <span className="text-2xl font-bold text-amber-400">{globalStats.expiringOrgs}</span>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-red-500/30">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Expirées</span>
                                <span className="text-2xl font-bold text-red-400">{globalStats.expiredOrgs}</span>
                            </div>
                        </div>
                    </div>

                    {/* Titre Section */}
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        📋 Les 7 Critères du RNQ
                    </h2>

                    {/* Grille des 7 Critères */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {CRITERES_RNQ.map((critere) => {
                            const scores = organizations.map(org => {
                                const stats = {
                                    totalProgrammes: org.programmes.length,
                                    publishedProgrammes: org.programmes.filter(p => p.isPublished).length,
                                    totalDossiers: org.dossiers.length,
                                    completedDossiers: org.dossiers.filter(d => d.status === 'CLOTURE').length,
                                    reclamationsCount: org.reclamations.length,
                                    resolvedReclamations: org.reclamations.filter(r => r.status === 'CLOTURE').length,
                                };
                                return calculateCritereScore(critere.id, org, stats);
                            });
                            const avgScore = scores.length > 0
                                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                                : 0;
                            const color = getScoreColor(avgScore);

                            return (
                                <div
                                    key={critere.id}
                                    className={`bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5 hover:border-slate-600/50 transition-all duration-300`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{critere.icon}</span>
                                            <div>
                                                <h3 className="text-white font-semibold">
                                                    Critère {critere.id}
                                                </h3>
                                                <p className="text-sm text-slate-400">
                                                    {critere.nom}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`text-2xl font-bold ${color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
                                            {avgScore}%
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${avgScore}%` }}
                                        />
                                    </div>

                                    <p className="text-xs text-slate-500">
                                        {critere.description}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-2">
                                        Indicateurs: {critere.indicateurs.join(', ')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Liste des Organisations */}
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        🏢 État par Organisation
                    </h2>

                    <div className="space-y-4">
                        {organizations.map((org) => {
                            const daysUntilExpiry = org.qualiopiExpiry
                                ? Math.floor((org.qualiopiExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                : null;

                            const expiryStatus = daysUntilExpiry === null
                                ? { color: 'slate', label: 'Non défini' }
                                : daysUntilExpiry < 0
                                    ? { color: 'red', label: 'Expirée' }
                                    : daysUntilExpiry <= 90
                                        ? { color: 'amber', label: `${daysUntilExpiry}j` }
                                        : { color: 'emerald', label: `${daysUntilExpiry}j` };

                            return (
                                <div
                                    key={org.id}
                                    className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${org.qualiopiCertified
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {org.qualiopiCertified ? (
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-semibold">{org.name}</h3>
                                                <p className="text-sm text-slate-400">
                                                    SIRET: {org.siret} • {org.type}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* Badge Qualiopi */}
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${org.qualiopiCertified
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                }`}>
                                                {org.qualiopiCertified ? '✓ Certifié' : '✗ Non certifié'}
                                            </span>

                                            {/* Badge Expiration */}
                                            {org.qualiopiCertified && (
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${expiryStatus.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                    expiryStatus.color === 'amber' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                        expiryStatus.color === 'red' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                                    }`}>
                                                    Expire dans: {expiryStatus.label}
                                                </span>
                                            )}

                                            {/* Stats */}
                                            <div className="text-right text-sm">
                                                <p className="text-slate-400">
                                                    {org.programmes.length} programmes • {org.dossiers.length} dossiers
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {organizations.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                <p className="text-lg">Aucune organisation trouvée</p>
                                <p className="text-sm">Créez une organisation pour commencer le suivi Qualiopi</p>
                            </div>
                        )}
                    </div>
                </main>

                {/* Footer */}
                <footer className="border-t border-slate-700/50 mt-12">
                    <div className="max-w-7xl mx-auto px-6 py-4 text-center text-slate-500 text-sm">
                        Polyx ERP Formation • Suivi Qualiopi • RNQ 2022
                    </div>
                </footer>
            </div>
        </DashboardLayout>
    );
}

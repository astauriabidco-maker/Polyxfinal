/**
 * DASHBOARD - Vue d'ensemble des Dossiers (Multi-Tenant + Granular Access)
 * =========================================================================
 * Page serveur affichant les dossiers de l'organisation courante.
 * Filtre les données selon le scope d'accès aux sites de l'utilisateur.
 * Supporte le mode multi-org via ?scope=all
 * 
 * URL: /dashboard
 */

import { prisma } from '@/lib/prisma';
import { validateStateChange } from '@/lib/compliance/engine';
import ActionButtons from '@/components/compliance/ActionButtons';
import CorrectionPanel from '@/components/compliance/CorrectionPanel';
import TimelineToggle from '@/components/compliance/TimelineToggle';
import UserHeader from '@/components/auth/UserHeader';
import Sidebar from '@/components/layout/Sidebar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getUserSiteIds, buildSiteFilteredWhereClause } from '@/lib/auth/access';

// Mapping statut actuel → statut cible pour test de conformité
const TRANSITION_MAP: Record<string, string> = {
    'PROSPECT': 'ADMIS',
    'BROUILLON': 'EN_ATTENTE_VALIDATION',
    'EN_ATTENTE_VALIDATION': 'ADMIS',
    'ADMIS': 'CONTRACTUALISE',
    'CONTRACTUALISE': 'EN_COURS',
    'ACTIF': 'EN_COURS',
    'EN_COURS': 'CLOTURE',
    'TERMINE': 'CLOTURE',
    'CLOTURE': 'FACTURE',
};

// Type pour le résultat de conformité
interface ComplianceCheck {
    success: boolean;
    errors: string[];
    warnings: string[];
    targetStatus: string;
}
/**
 * Évalue la conformité d'un dossier
 */
async function evaluateCompliance(dossierId: string, currentStatus: string): Promise<ComplianceCheck> {
    // Déterminer le prochain statut pour le test
    const targetStatus = TRANSITION_MAP[currentStatus];

    if (!targetStatus) {
        // Statut terminal ou non mappé, tester vers CLOTURE par défaut
        const result = await validateStateChange(dossierId, 'CLOTURE');
        return {
            success: result.errors.length === 0,
            errors: result.errors,
            warnings: result.warnings,
            targetStatus: 'CLOTURE',
        };
    }

    // Sinon tester vers CLOTURE pour évaluer la conformité complète
    const targetStatusFinal = 'CLOTURE';
    const result = await validateStateChange(dossierId, targetStatusFinal);

    return {
        success: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings,
        targetStatus: targetStatusFinal,
    };
}

export default async function DashboardPage({ searchParams }: { searchParams: { scope?: string } }) {
    // Vérifier la session et récupérer l'organisation
    const session = await auth();
    if (!session?.user?.organizationId) {
        redirect('/login');
    }

    const userId = session.user.id;
    const organizationId = session.user.organizationId;
    const isAllOrgs = searchParams.scope === 'all';

    // Multi-org: récupérer toutes les orgs du user
    const allMemberships = await prisma.membership.findMany({
        where: { userId, isActive: true },
        include: { organization: { select: { id: true, name: true, type: true } } },
    });
    const orgMap = Object.fromEntries(
        allMemberships.map(m => [m.organization.id, { name: m.organization.name, type: m.organization.type }])
    );
    const orgIds = allMemberships.map(m => m.organization.id);
    const hasMultipleOrgs = Object.keys(orgMap).length > 1;

    let whereClause: any;

    if (isAllOrgs) {
        // Mode multi-org : pas de filtrage site, on prend tous les dossiers de toutes les orgs
        whereClause = { organizationId: { in: orgIds } };
    } else {
        // Mode single-org : filtrage par site
        const allowedSiteIds = await getUserSiteIds(userId, organizationId);
        whereClause = buildSiteFilteredWhereClause(organizationId, allowedSiteIds);
    }

    // Récupérer les dossiers
    const dossiers = await prisma.dossier.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            organization: true,
            company: true,
            site: true,
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
        take: 200,
    });

    // Évaluer la conformité de chaque dossier
    const dossiersWithCompliance = await Promise.all(
        dossiers.map(async (dossier) => ({
            ...dossier,
            compliance: await evaluateCompliance(dossier.id, dossier.status),
        }))
    );

    // Stats
    const conformeCount = dossiersWithCompliance.filter(d => d.compliance.success).length;
    const bloqueCount = dossiersWithCompliance.filter(d => !d.compliance.success).length;

    return (
        <div className="min-h-screen bg-slate-950 flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content */}
            <main className="flex-1 ml-64 transition-all duration-300">
                {/* Header with user info */}
                <UserHeader />

                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen p-6">
                    {/* Header */}
                    <header className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-white">📋 Tableau de Bord</h1>
                                <p className="text-slate-400 mt-1">
                                    {isAllOrgs
                                        ? `Vue consolidée • ${Object.keys(orgMap).length} organisations • ${dossiers.length} dossiers`
                                        : 'Gestion des dossiers de formation'
                                    }
                                </p>
                            </div>
                            <div className="flex gap-4 items-center">
                                {/* Multi-Org Toggle */}
                                {hasMultipleOrgs && (
                                    <div className="flex items-center bg-slate-800/60 rounded-xl border border-slate-700/50 p-1">
                                        <a
                                            href="/dashboard"
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isAllOrgs
                                                ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            🏢 Org. actuelle
                                        </a>
                                        <a
                                            href="/dashboard?scope=all"
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isAllOrgs
                                                ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            🌐 Toutes ({Object.keys(orgMap).length})
                                        </a>
                                    </div>
                                )}
                                <StatCard label="Conformes" value={conformeCount} color="emerald" />
                                <StatCard label="Bloqués" value={bloqueCount} color="red" />
                                <StatCard label="Total" value={dossiers.length} color="slate" />
                            </div>
                        </div>

                        {/* Multi-org indicator */}
                        {isAllOrgs && (
                            <div className="mt-4 flex items-center gap-2 flex-wrap">
                                {Object.entries(orgMap).map(([id, org]) => (
                                    <span
                                        key={id}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border ${org.type === 'CFA'
                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                            }`}
                                    >
                                        {org.type === 'CFA' ? '🎓' : '🏢'} {org.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </header>

                    {/* Liste des Dossiers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {dossiersWithCompliance.map((dossier) => (
                            <DossierCard key={dossier.id} dossier={dossier} showOrg={isAllOrgs} />
                        ))}
                    </div>

                    {/* Empty State */}
                    {dossiers.length === 0 && (
                        <div className="text-center py-20">
                            <div className="text-6xl mb-4">📭</div>
                            <h2 className="text-xl font-semibold text-white">Aucun dossier</h2>
                            <p className="text-slate-400 mt-2">Commencez par créer votre premier dossier de formation.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// ============================================
// COMPOSANTS UI INLINE
// ============================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        red: 'bg-red-500/20 text-red-400 border-red-500/30',
        slate: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };

    return (
        <div className={`px-4 py-2 rounded-lg border ${colorClasses[color]}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
        </div>
    );
}

function DossierCard({ dossier, showOrg = false }: { dossier: any; showOrg?: boolean }) {
    const contrat = dossier.contrats?.[0];
    const isConforme = dossier.compliance.success;
    const orgType = dossier.organization?.type;

    return (
        <div className="bg-slate-800/60 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-all duration-300">
            {/* Card Header */}
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-white">
                        {dossier.stagiairePrenom} {dossier.stagiaireNom}
                    </h3>
                    <p className="text-sm text-slate-400">{dossier.stagiaireEmail}</p>
                    {/* Multi-org badge */}
                    {showOrg && dossier.organization && (
                        <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${orgType === 'CFA'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            }`}>
                            {orgType === 'CFA' ? '🎓' : '🏢'} {dossier.organization.name}
                        </span>
                    )}
                </div>

                {/* Badge de Conformité */}
                <ComplianceBadge success={isConforme} targetStatus={dossier.compliance.targetStatus} />
            </div>

            {/* Card Body */}
            <div className="px-5 py-4 space-y-3">
                {/* Statut */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Statut</span>
                    <StatusBadge status={dossier.status} />
                </div>

                {/* Phase */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Phase</span>
                    <span className="text-sm text-white">{dossier.phaseActuelle}/5</span>
                </div>

                {/* Assiduité */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Assiduité</span>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
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
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Contrat</span>
                    {contrat?.isSigned ? (
                        <span className="flex items-center text-emerald-400 text-sm">
                            <svg width="16" height="16" className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Signé
                        </span>
                    ) : (
                        <span className="flex items-center text-red-400 text-sm">
                            <svg width="16" height="16" className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Non signé
                        </span>
                    )}
                </div>

                {/* Financeur */}
                {contrat?.financeur && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Financeur</span>
                        <span className="text-sm text-slate-300">{contrat.financeur.type}</span>
                    </div>
                )}

                {/* Site (visible en mode multi-org) */}
                {showOrg && dossier.site && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Agence</span>
                        <span className="text-sm text-slate-300">📍 {dossier.site.name}</span>
                    </div>
                )}
            </div>

            {/* Erreurs de Conformité (si bloqué) */}
            {!isConforme && dossier.compliance.errors.length > 0 && (
                <div className="px-5 py-3 bg-red-950/30 border-t border-red-900/30">
                    <div className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">
                        ⚠️ Règles bloquantes
                    </div>
                    <ul className="space-y-1">
                        {dossier.compliance.errors.map((error: string, idx: number) => (
                            <li key={idx} className="text-xs text-red-300/80 flex items-start">
                                <span className="text-red-500 mr-2">•</span>
                                {error.replace('[Conformité] ', '')}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Panneau de correction (si bloqué) */}
            {!isConforme && dossier.compliance.errors.length > 0 && (
                <CorrectionPanel
                    dossierId={dossier.id}
                    errors={dossier.compliance.errors}
                />
            )}

            {/* Card Footer */}
            <div className="px-5 py-3 bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">
                        {dossier.id.slice(0, 8)}...
                    </span>
                    <div className="flex gap-2">
                        {dossier.certificatGenere && (
                            <span className="text-xs text-emerald-400">🎓 Certif</span>
                        )}
                        {dossier.factureGeneree && (
                            <span className="text-xs text-cyan-400">📄 Facturé</span>
                        )}
                    </div>
                </div>

                {/* Bouton d'action */}
                <ActionButtons
                    dossierId={dossier.id}
                    currentStatus={dossier.status}
                    isCompliant={isConforme}
                    nextStatus={dossier.compliance.targetStatus}
                />
            </div>

            {/* Timeline Toggle (toujours visible en bas de carte) */}
            <TimelineToggle dossierId={dossier.id} />
        </div>
    );
}

function ComplianceBadge({ success, targetStatus }: { success: boolean; targetStatus: string }) {
    if (success) {
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                <svg width="12" height="12" className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Conforme
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
            <svg width="12" height="12" className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Bloqué
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const statusColors: Record<string, string> = {
        'PROSPECT': 'bg-slate-600 text-slate-200',
        'BROUILLON': 'bg-slate-600 text-slate-200',
        'EN_ATTENTE_VALIDATION': 'bg-amber-600 text-amber-100',
        'ADMIS': 'bg-blue-600 text-blue-100',
        'CONTRACTUALISE': 'bg-indigo-600 text-indigo-100',
        'ACTIF': 'bg-cyan-600 text-cyan-100',
        'EN_COURS': 'bg-purple-600 text-purple-100',
        'TERMINE': 'bg-emerald-600 text-emerald-100',
        'CLOTURE': 'bg-emerald-700 text-emerald-100',
        'FACTURE': 'bg-green-700 text-green-100',
    };

    return (
        <span className={`px-2 py-0.5 rounded text-xs font-mono ${statusColors[status] || 'bg-slate-600 text-slate-200'}`}>
            {status}
        </span>
    );
}

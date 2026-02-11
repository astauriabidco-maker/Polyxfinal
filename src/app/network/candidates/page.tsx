/**
 * PAGE CANDIDATS FRANCHISE — Pipeline de recrutement réseau
 * ==========================================================
 * Affiche les candidats franchise avec un pipeline CRM Kanban,
 * KPIs de conversion, filtrage OF/CFA, et formulaire d'ajout/édition.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CandidateForm from './CandidateForm';
import KanbanPipeline, { type SerializedCandidate } from './KanbanPipeline';
import { resolveOrganizationId } from '@/lib/network/resolveOrg';
import { checkTerritoryConflicts } from '@/lib/network/territories';

export const metadata = {
    title: 'Candidats Franchise | Polyx ERP',
    description: 'Pipeline de recrutement des candidats franchise',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    REJECTED: { label: 'Rejeté', color: 'bg-red-500/20 text-red-400 border-red-500/30', emoji: '❌' },
    WITHDRAWN: { label: 'Retiré', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', emoji: '🚪' },
};

export default async function CandidatesPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    const resolved = await resolveOrganizationId();
    if (resolved.error) redirect('/login');
    const organizationId = resolved.organizationId!;

    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { networkType: true, name: true },
    });

    const candidates = await prisma.franchiseCandidate.findMany({
        where: { organizationId },
        include: {
            activities: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Sérialiser pour le client (Decimal → string, Date → ISO)
    const serialized: SerializedCandidate[] = await Promise.all(candidates.map(async c => {
        // Détection de conflits territoriaux
        const conflicts = await checkTerritoryConflicts(c.targetZipCodes);

        return {
            id: c.id,
            franchiseType: c.franchiseType,
            companyName: c.companyName,
            siret: c.siret,
            email: c.email,
            phone: c.phone,
            representantNom: c.representantNom,
            representantPrenom: c.representantPrenom,
            representantFonction: c.representantFonction,
            status: c.status,
            targetZone: c.targetZone,
            targetZipCodes: c.targetZipCodes,
            investmentBudget: c.investmentBudget ? c.investmentBudget.toString() : null,
            motivationIndex: c.motivationIndex,
            lastActivity: c.activities?.[0] ? {
                type: c.activities[0].type,
                description: c.activities[0].description,
                createdAt: c.activities[0].createdAt.toISOString(),
            } : null,
            notes: c.notes,
            createdAt: c.createdAt.toISOString(),
            dipSentAt: c.dipSentAt ? c.dipSentAt.toISOString() : null,
            dipSignedAt: c.dipSignedAt ? c.dipSignedAt.toISOString() : null,
            createdOrgId: c.createdOrgId,
            utmSource: c.utmSource,
            utmMedium: c.utmMedium,
            utmCampaign: c.utmCampaign,
            territoryConflicts: conflicts.map(conf => ({
                organizationName: conf.organizationName,
                overlappingZipCodes: conf.overlappingZipCodes
            }))
        };
    }));

    // KPIs
    const total = candidates.length;
    const signed = candidates.filter(c => c.status === 'SIGNED').length;
    const active = candidates.filter(c => !['REJECTED', 'WITHDRAWN'].includes(c.status)).length;
    const ofCount = candidates.filter(c => c.franchiseType === 'OF' && !['REJECTED', 'WITHDRAWN'].includes(c.status)).length;
    const cfaCount = candidates.filter(c => c.franchiseType === 'CFA' && !['REJECTED', 'WITHDRAWN'].includes(c.status)).length;
    const avgBudget = candidates
        .filter(c => c.investmentBudget)
        .reduce((sum, c) => sum + Number(c.investmentBudget || 0), 0) / (candidates.filter(c => c.investmentBudget).length || 1);

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">🏢</span>
                            Candidats Franchise
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Pipeline de recrutement • {org?.name}
                        </p>
                    </div>
                    <CandidateForm />
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Candidats</p>
                        <p className="text-2xl font-bold text-white">{total}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Actifs Pipeline</p>
                        <p className="text-2xl font-bold text-blue-400">{active}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">🏫 OF / 🎓 CFA</p>
                        <p className="text-2xl font-bold">
                            <span className="text-blue-400">{ofCount}</span>
                            <span className="text-slate-600 mx-1">/</span>
                            <span className="text-emerald-400">{cfaCount}</span>
                        </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Signés</p>
                        <p className="text-2xl font-bold text-green-400">{signed}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            {total > 0 ? `${Math.round((signed / total) * 100)}% conversion` : '—'}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Budget Moyen</p>
                        <p className="text-2xl font-bold text-purple-400">
                            {avgBudget > 0 ? `${Math.round(avgBudget).toLocaleString('fr-FR')} €` : '—'}
                        </p>
                    </div>
                </div>

                {/* Kanban Pipeline */}
                {total === 0 ? (
                    <div className="bg-slate-800/30 rounded-2xl border border-dashed border-slate-600 p-12 text-center">
                        <span className="text-5xl mb-4 block">🏢</span>
                        <h3 className="text-xl font-semibold text-white mb-2">Aucun candidat franchise</h3>
                        <p className="text-slate-400 mb-6">
                            Commencez à recruter des franchisés pour développer votre réseau.
                        </p>
                        <p className="text-sm text-slate-500">
                            Cliquez sur <span className="text-blue-400 font-medium">&quot;Nouveau Candidat&quot;</span> pour ajouter une société au pipeline.
                        </p>
                    </div>
                ) : (
                    <KanbanPipeline candidates={serialized} filterType={null} />
                )}

                {/* Rejected / Withdrawn Section */}
                {candidates.filter(c => ['REJECTED', 'WITHDRAWN'].includes(c.status)).length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            Clôturés ({candidates.filter(c => ['REJECTED', 'WITHDRAWN'].includes(c.status)).length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {candidates
                                .filter(c => ['REJECTED', 'WITHDRAWN'].includes(c.status))
                                .map(candidate => {
                                    const config = STATUS_CONFIG[candidate.status];
                                    const typeBadge = candidate.franchiseType === 'CFA'
                                        ? { label: 'CFA', emoji: '🎓' }
                                        : { label: 'OF', emoji: '🏫' };
                                    return (
                                        <div key={candidate.id} className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-3 opacity-60">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-sm text-slate-300">{candidate.companyName}</span>
                                                    <span className="text-xs text-slate-500 ml-2">{typeBadge.emoji} {typeBadge.label}</span>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${config.color}`}>
                                                    {config.emoji} {config.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

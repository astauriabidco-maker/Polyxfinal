'use client';

/**
 * COMPOSANT — Pipeline Kanban Candidats Franchise
 * =================================================
 * Affiche le pipeline en colonnes Kanban avec cartes cliquables.
 * Ouvre le formulaire d'édition au clic sur une carte.
 */

import { useState } from 'react';
import CandidateForm, { type CandidateData } from './CandidateForm';
import CandidateActionButtons from './CandidateActionButtons';
import CandidateTimeline from './CandidateTimeline';

interface StatusConfig {
    label: string;
    color: string;
    emoji: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
    NEW: { label: 'Nouveau', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', emoji: '🆕' },
    CONTACTED: { label: 'Contacté', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', emoji: '📞' },
    DIP_SENT: { label: 'DIP Envoyé', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', emoji: '📨' },
    DIP_SIGNED: { label: 'DIP Signé', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', emoji: '✍️' },
    CONTRACT_SENT: { label: 'Contrat Envoyé', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', emoji: '📋' },
    SIGNED: { label: 'Signé', color: 'bg-green-500/20 text-green-400 border-green-500/30', emoji: '✅' },
};

const FRANCHISE_TYPE_BADGE: Record<string, { label: string; color: string; emoji: string }> = {
    OF: { label: 'OF', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', emoji: '🏫' },
    CFA: { label: 'CFA', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', emoji: '🎓' },
};

const PIPELINE_STATUSES = ['NEW', 'CONTACTED', 'DIP_SENT', 'DIP_SIGNED', 'CONTRACT_SENT', 'SIGNED'];

// Sérialiser les candidats côté serveur → props
export interface SerializedCandidate {
    id: string;
    franchiseType: string;
    companyName: string;
    siret: string | null;
    email: string;
    phone: string | null;
    representantNom: string;
    representantPrenom: string;
    representantFonction: string | null;
    status: string;
    targetZone: string | null;
    targetZipCodes: string[];
    investmentBudget: string | null; // Sérialisé en string (Decimal)
    motivationIndex: number | null;
    lastActivity: {
        type: string;
        description: string;
        createdAt: string;
    } | null;
    notes: string | null;
    createdAt: string;
    dipSentAt: string | null;
    dipSignedAt: string | null;
    createdOrgId: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    territoryConflicts?: {
        organizationName: string;
        overlappingZipCodes: string[];
    }[];
}

interface KanbanPipelineProps {
    candidates: SerializedCandidate[];
    filterType: string | null; // null = tous, 'OF' ou 'CFA'
}

export default function KanbanPipeline({ candidates, filterType: initialFilter }: KanbanPipelineProps) {
    const [editCandidate, setEditCandidate] = useState<CandidateData | null>(null);
    const [filterType, setFilterType] = useState<string | null>(initialFilter);
    const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

    const toggleTimeline = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setExpandedCandidateId(expandedCandidateId === id ? null : id);
    };

    // Filtrer par type
    const filtered = filterType
        ? candidates.filter(c => c.franchiseType === filterType)
        : candidates;

    // Grouper par statut
    const byStatus: Record<string, SerializedCandidate[]> = {};
    for (const status of PIPELINE_STATUSES) {
        byStatus[status] = filtered.filter(c => c.status === status);
    }

    function openEdit(c: SerializedCandidate) {
        setEditCandidate({
            id: c.id,
            franchiseType: c.franchiseType,
            companyName: c.companyName,
            siret: c.siret,
            email: c.email,
            phone: c.phone,
            representantNom: c.representantNom,
            representantPrenom: c.representantPrenom,
            representantFonction: c.representantFonction,
            targetZone: c.targetZone,
            targetZipCodes: c.targetZipCodes,
            investmentBudget: c.investmentBudget,
            notes: c.notes,
        });
    }

    return (
        <>
            {/* Filtre OF / CFA */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">Filtre :</span>
                <button
                    onClick={() => setFilterType(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === null
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:text-white'
                        }`}
                >
                    Tous ({candidates.filter(c => !['REJECTED', 'WITHDRAWN'].includes(c.status)).length})
                </button>
                <button
                    onClick={() => setFilterType('OF')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'OF'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-800/50 text-slate-400 hover:text-white'
                        }`}
                >
                    🏫 OF ({candidates.filter(c => c.franchiseType === 'OF' && !['REJECTED', 'WITHDRAWN'].includes(c.status)).length})
                </button>
                <button
                    onClick={() => setFilterType('CFA')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'CFA'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800/50 text-slate-400 hover:text-white'
                        }`}
                >
                    🎓 CFA ({candidates.filter(c => c.franchiseType === 'CFA' && !['REJECTED', 'WITHDRAWN'].includes(c.status)).length})
                </button>
            </div>

            {/* Kanban */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {PIPELINE_STATUSES.map(status => {
                        const config = STATUS_CONFIG[status];
                        const items = byStatus[status] || [];
                        return (
                            <div key={status} className="w-72 flex-shrink-0">
                                {/* Column Header */}
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${config.color}`}>
                                    <span>{config.emoji}</span>
                                    <span className="text-sm font-semibold">{config.label}</span>
                                    <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">
                                        {items.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="space-y-3">
                                    {items.map(candidate => {
                                        const typeBadge = FRANCHISE_TYPE_BADGE[candidate.franchiseType];
                                        return (
                                            <div
                                                key={candidate.id}
                                                onClick={() => openEdit(candidate)}
                                                className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-4 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all cursor-pointer group relative overflow-hidden"
                                            >
                                                {/* Motivation Flame - Glow effect if high motivation */}
                                                {candidate.motivationIndex !== null && (
                                                    <div className={`absolute top-0 right-0 px-2 py-0.5 text-[10px] font-bold rounded-bl-lg flex items-center gap-1 ${candidate.motivationIndex >= 70 ? 'bg-orange-500 text-white animate-pulse' :
                                                        candidate.motivationIndex >= 40 ? 'bg-yellow-500/20 text-yellow-400 border-l border-b border-yellow-500/30' :
                                                            'bg-slate-700/50 text-slate-500'
                                                        }`}>
                                                        🔥 {candidate.motivationIndex}%
                                                    </div>
                                                )}

                                                {/* Type badge + Company */}
                                                <div className="flex items-start justify-between mb-2 pr-12">
                                                    <h4 className="font-semibold text-white text-sm leading-tight">
                                                        {candidate.companyName}
                                                    </h4>
                                                </div>

                                                <div className="flex gap-1.5 mb-2">
                                                    {typeBadge && (
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${typeBadge.color}`}>
                                                            {typeBadge.emoji} {typeBadge.label}
                                                        </span>
                                                    )}
                                                    {candidate.utmSource && (
                                                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
                                                            📡 {candidate.utmSource}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Conflict Alert - Geozone Exclusivity */}
                                                {candidate.territoryConflicts && candidate.territoryConflicts.length > 0 && (
                                                    <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs">⚠️</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-tight">Conflit Territorial</span>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            {candidate.territoryConflicts.map((conf, idx) => (
                                                                <p key={idx} className="text-[9px] leading-tight">
                                                                    Exclusivité de <span className="font-bold underline">{conf.organizationName}</span> sur {conf.overlappingZipCodes.join(', ')}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Représentant */}
                                                <p className="text-xs text-slate-300 mb-1">
                                                    👤 {candidate.representantPrenom} {candidate.representantNom}
                                                </p>

                                                {/* Last Activity - Timeline engine visual */}
                                                {
                                                    candidate.lastActivity && (
                                                        <div className="mt-3 mb-2 p-2 bg-slate-900/40 rounded border border-slate-700/30 italic">
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Dernière activité</span>
                                                                <span className="text-[9px] text-slate-600">
                                                                    {new Date(candidate.lastActivity.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                                                                {candidate.lastActivity.description}
                                                            </p>
                                                        </div>
                                                    )
                                                }

                                                {/* Details (Hiddable in compact mode if needed) */}
                                                <div className="space-y-1">
                                                    {candidate.targetZone && (
                                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                                            <span>📍</span>
                                                            <span className="truncate">{candidate.targetZone}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Zip codes */}
                                                {
                                                    candidate.targetZipCodes.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {candidate.targetZipCodes.slice(0, 3).map(cp => (
                                                                <span key={cp} className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                                                                    {cp}
                                                                </span>
                                                            ))}
                                                            {candidate.targetZipCodes.length > 3 && (
                                                                <span className="text-xs text-slate-500">
                                                                    +{candidate.targetZipCodes.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                }

                                                {/* Budget */}
                                                {
                                                    candidate.investmentBudget && (
                                                        <p className="text-xs text-purple-400 mb-2">
                                                            💰 {Number(candidate.investmentBudget).toLocaleString('fr-FR')} €
                                                        </p>
                                                    )
                                                }

                                                {/* Footer */}
                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/50">
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(candidate.createdAt).toLocaleDateString('fr-FR')}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {candidate.status === 'SIGNED' && !candidate.createdOrgId && (
                                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                                                🚀 Prêt
                                                            </span>
                                                        )}
                                                        {candidate.createdOrgId && (
                                                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                                                                ✅ Onboardé
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            ✏️ Modifier
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Action Buttons & Timeline Toggle */}
                                                <div className="mt-3 flex items-center justify-between gap-2">
                                                    <button
                                                        onClick={(e) => toggleTimeline(e, candidate.id)}
                                                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${expandedCandidateId === candidate.id
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                            }`}
                                                    >
                                                        {expandedCandidateId === candidate.id ? 'Fermer Log' : 'Voir Log'}
                                                    </button>
                                                </div>

                                                <CandidateActionButtons
                                                    candidateId={candidate.id}
                                                    currentStatus={candidate.status}
                                                    dipSentAt={candidate.dipSentAt}
                                                    dipSignedAt={candidate.dipSignedAt}
                                                    createdOrgId={candidate.createdOrgId}
                                                />

                                                <CandidateTimeline
                                                    candidateId={candidate.id}
                                                    isOpen={expandedCandidateId === candidate.id}
                                                />
                                            </div>
                                        );
                                    })}
                                    {items.length === 0 && (
                                        <div className="text-center py-6 text-xs text-slate-600">
                                            Aucun candidat
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div >

            {/* Edit Modal */}
            {
                editCandidate && (
                    <CandidateForm
                        candidate={editCandidate}
                        onClose={() => setEditCandidate(null)}
                        triggerButton={false}
                    />
                )
            }
        </>
    );
}

/**
 * AUDIT TIMELINE - Client Component
 * ==================================
 * Affiche l'historique chronologique des actions sur un dossier.
 * Design: Timeline verticale élégante avec icônes contextuelles.
 */
'use client';

import { useState, useEffect } from 'react';

// Types pour les entrées d'audit
interface AuditEntry {
    id: string;
    timestamp: string;
    action: string;
    niveauAction: string;
    entityType: string;
    entityId: string;
    newState: Record<string, unknown> | null;
    previousState: Record<string, unknown> | null;
    userId: string;
    userRole: string;
}

interface AuditTimelineProps {
    dossierId: string;
    isOpen: boolean;
}

// Mapping des icônes par action
function getActionIcon(action: string, niveauAction: string): string {
    if (action === 'PROOF_UPLOAD') return '📄';
    if (action === 'STATUS_CHANGE') return '✅';
    if (action.includes('VALIDATE')) return niveauAction === 'VALIDATION' ? '🔒' : '👁️';
    if (action.includes('CREATE')) return '🆕';
    if (action.includes('SEED')) return '🌱';
    if (niveauAction === 'FORCAGE') return '🛡️';
    if (niveauAction === 'EDITION') return '✏️';
    return '📋';
}

// Mapping des couleurs par niveau
function getLevelColor(niveauAction: string): string {
    switch (niveauAction) {
        case 'VALIDATION': return 'border-emerald-500 bg-emerald-950/50';
        case 'EDITION': return 'border-blue-500 bg-blue-950/50';
        case 'FORCAGE': return 'border-red-500 bg-red-950/50';
        case 'LECTURE': return 'border-slate-500 bg-slate-950/50';
        default: return 'border-slate-600 bg-slate-900/50';
    }
}

// Formater une date de manière lisible
function formatDate(dateStr: string): { time: string; date: string } {
    const d = new Date(dateStr);
    return {
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    };
}

// Décrire l'action de manière lisible
function describeAction(entry: AuditEntry): string {
    const { action, newState, entityType } = entry;

    if (action === 'PROOF_UPLOAD' && newState) {
        const proofType = (newState as any).type || 'Document';
        return `Preuve ajoutée : ${proofType.replace(/_/g, ' ')}`;
    }

    if (action === 'STATUS_CHANGE' && newState) {
        const from = (newState as any).from || '?';
        const to = (newState as any).to || '?';
        return `Passage ${from} → ${to}`;
    }

    if (action.includes('VALIDATE_TRANSITION')) {
        const target = action.replace('VALIDATE_TRANSITION_', '');
        const blocked = newState && (newState as any).blocked;
        return blocked
            ? `Tentative bloquée : vers ${target}`
            : `Validation réussie : vers ${target}`;
    }

    if (action === 'CREATE' || action.includes('SEED')) {
        return `Création ${entityType}`;
    }

    return action.replace(/_/g, ' ');
}

export default function AuditTimeline({ dossierId, isOpen }: AuditTimelineProps) {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        setError(null);

        // Fetch audit logs for this dossier
        fetch(`/api/audit/${dossierId}`)
            .then(res => {
                if (!res.ok) throw new Error('Erreur de chargement');
                return res.json();
            })
            .then(data => {
                setEntries(data.entries || []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [dossierId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="px-5 py-4 bg-slate-900/50 border-t border-slate-700/50">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-slate-300">
                    Historique du dossier
                </span>
                <span className="text-xs text-slate-500 ml-auto">
                    {entries.length} entrées
                </span>
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="text-center py-4 text-sm text-red-400">
                    ⚠️ {error}
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && entries.length === 0 && (
                <div className="text-center py-4 text-sm text-slate-500">
                    Aucun historique disponible
                </div>
            )}

            {/* Timeline */}
            {!loading && !error && entries.length > 0 && (
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[72px] top-0 bottom-0 w-px bg-slate-700" />

                    <div className="space-y-3">
                        {entries.map((entry, idx) => {
                            const { time, date } = formatDate(entry.timestamp);
                            const icon = getActionIcon(entry.action, entry.niveauAction);
                            const colorClass = getLevelColor(entry.niveauAction);

                            return (
                                <div key={entry.id} className="flex items-start gap-3">
                                    {/* Date/Time column */}
                                    <div className="w-16 text-right flex-shrink-0">
                                        <div className="text-xs font-medium text-slate-300">{time}</div>
                                        <div className="text-[10px] text-slate-500">{date}</div>
                                    </div>

                                    {/* Icon node */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center 
                                                    border-2 ${colorClass} flex-shrink-0 z-10`}>
                                        <span className="text-sm">{icon}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-slate-200">
                                            {describeAction(entry)}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Par {entry.userRole === 'ADMIN' ? 'Admin' : 'System'}
                                            {entry.newState && (entry.newState as any).stagiaire && (
                                                <span> • {(entry.newState as any).stagiaire}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

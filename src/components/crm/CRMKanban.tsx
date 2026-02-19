'use client';

import { useState, useTransition } from 'react';
import { updateCRMStatus, reassignLead } from '@/app/actions/leads';

// --- Types ---

interface Lead {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    source: string;
    status: string;
    notes: string | null;
    dateRdv: string | null;
    lostReason: string | null;
    formationSouhaitee: string | null;
    convertedAt: string | null;
    createdAt: string;
    assignedTo: { id: string; nom: string; prenom: string } | null;
    site: { id: string; name: string } | null;
}

interface Commercial {
    id: string;
    nom: string;
    prenom: string;
}

interface CRMKanbanProps {
    leads: Lead[];
    commercials: Commercial[];
}

// --- Colonnes CRM ---

const CRM_COLUMNS = [
    { status: 'RDV_PLANIFIE', label: '📅 RDV Planifié', color: 'border-violet-500', bgHeader: 'bg-violet-500/10', textColor: 'text-violet-400' },
    { status: 'RDV_NON_HONORE', label: '❌ RDV Non Honoré', color: 'border-red-500', bgHeader: 'bg-red-500/10', textColor: 'text-red-400' },
    { status: 'COURRIERS_ENVOYES', label: '📝 Courriers Envoyés', color: 'border-blue-500', bgHeader: 'bg-blue-500/10', textColor: 'text-blue-400' },
    { status: 'COURRIERS_RECUS', label: '📬 Courriers Reçus', color: 'border-cyan-500', bgHeader: 'bg-cyan-500/10', textColor: 'text-cyan-400' },
    { status: 'NEGOCIATION', label: '🤝 Négociation', color: 'border-amber-500', bgHeader: 'bg-amber-500/10', textColor: 'text-amber-400' },
    { status: 'CONVERTI', label: '✅ Converti', color: 'border-green-500', bgHeader: 'bg-green-500/10', textColor: 'text-green-400' },
    { status: 'PROBLEMES_SAV', label: '⚠️ Problèmes/SAV', color: 'border-orange-500', bgHeader: 'bg-orange-500/10', textColor: 'text-orange-400' },
    { status: 'PERDU', label: '❌ Perdu', color: 'border-slate-500', bgHeader: 'bg-slate-500/10', textColor: 'text-slate-400' },
];

// --- Component ---

export default function CRMKanban({ leads, commercials }: CRMKanbanProps) {
    const [isPending, startTransition] = useTransition();
    const [draggedLead, setDraggedLead] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [showLostModal, setShowLostModal] = useState(false);
    const [lostReason, setLostReason] = useState('');
    const [showReassignModal, setShowReassignModal] = useState(false);

    // ---- Drag & Drop ----

    const handleDragStart = (e: React.DragEvent, leadId: string) => {
        setDraggedLead(leadId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', leadId);
    };

    const handleDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        setDragOverColumn(null);
        const leadId = e.dataTransfer.getData('text/plain');

        if (!leadId) {
            setDraggedLead(null);
            return;
        }

        // Si on drop sur PERDU, demander une raison
        if (targetStatus === 'PERDU') {
            const lead = leads.find(l => l.id === leadId);
            if (lead) {
                setSelectedLead(lead);
                setShowLostModal(true);
            }
            setDraggedLead(null);
            return;
        }

        startTransition(async () => {
            await updateCRMStatus({
                leadId,
                status: targetStatus as any,
            });
        });
        setDraggedLead(null);
    };

    // ---- Actions ----

    const handleMarkAsLost = () => {
        if (!selectedLead) return;
        startTransition(async () => {
            await updateCRMStatus({
                leadId: selectedLead.id,
                status: 'PERDU',
                lostReason: lostReason || undefined,
            });
            setShowLostModal(false);
            setLostReason('');
            setSelectedLead(null);
        });
    };

    const handleReassign = (userId: string) => {
        if (!selectedLead) return;
        startTransition(async () => {
            await reassignLead({ leadId: selectedLead.id, assignedToId: userId });
            setShowReassignModal(false);
            setSelectedLead(null);
        });
    };

    // ---- Stats ----
    const totalLeads = leads.length;
    const convertedCount = leads.filter(l => l.status === 'CONVERTI').length;
    const lostCount = leads.filter(l => l.status === 'PERDU').length;
    const inProgress = totalLeads - convertedCount - lostCount;

    return (
        <div className="space-y-6">
            {/* Global CRM Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{totalLeads}</div>
                    <div className="text-xs text-slate-400 mt-1">Total en CRM</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-blue-500/5">
                    <div className="text-2xl font-bold text-blue-400">{inProgress}</div>
                    <div className="text-xs text-slate-400 mt-1">En cours</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-green-500/5">
                    <div className="text-2xl font-bold text-green-400">{convertedCount}</div>
                    <div className="text-xs text-slate-400 mt-1">Convertis</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-red-500/5">
                    <div className="text-2xl font-bold text-red-400">{lostCount}</div>
                    <div className="text-xs text-slate-400 mt-1">Perdus</div>
                </div>
            </div>

            {/* Kanban Board - Scrollable horizontally */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-3" style={{ minWidth: `${CRM_COLUMNS.length * 280}px` }}>
                    {CRM_COLUMNS.map(col => {
                        const columnLeads = leads.filter(l => l.status === col.status);
                        const isOver = dragOverColumn === col.status;

                        return (
                            <div
                                key={col.status}
                                className={`flex-shrink-0 w-[270px] bg-slate-900/30 border-t-2 ${col.color} rounded-xl transition-all ${isOver ? 'ring-2 ring-white/20 bg-slate-800/50' : ''}`}
                                onDragOver={(e) => handleDragOver(e, col.status)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.status)}
                            >
                                {/* Column Header */}
                                <div className={`p-3 ${col.bgHeader} rounded-t-xl border-b border-slate-800`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`font-semibold text-xs ${col.textColor}`}>{col.label}</span>
                                        <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">{columnLeads.length}</span>
                                    </div>
                                </div>

                                {/* Cards */}
                                <div className="p-2 space-y-2 min-h-[150px] max-h-[65vh] overflow-y-auto">
                                    {columnLeads.map(lead => (
                                        <div
                                            key={lead.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, lead.id)}
                                            onClick={() => { setSelectedLead(lead); setShowDetailPanel(true); }}
                                            className={`bg-slate-800/80 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-slate-600 transition-all ${draggedLead === lead.id ? 'opacity-40 scale-95' : ''}`}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <div className="text-white font-medium text-sm truncate">{lead.prenom} {lead.nom}</div>
                                            </div>

                                            {lead.assignedTo && (
                                                <div className="text-[10px] text-purple-400 mb-1">
                                                    👤 {lead.assignedTo.prenom} {lead.assignedTo.nom}
                                                </div>
                                            )}

                                            {lead.telephone && (
                                                <div className="text-[10px] text-slate-400 mb-1">📱 {lead.telephone}</div>
                                            )}

                                            {lead.dateRdv && (
                                                <div className="text-[10px] text-violet-400 mb-1">
                                                    📅 {new Date(lead.dateRdv).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                                </div>
                                            )}

                                            {lead.formationSouhaitee && (
                                                <div className="text-[10px] text-cyan-400/70 mb-1 truncate">🎓 {lead.formationSouhaitee}</div>
                                            )}

                                            {lead.lostReason && (
                                                <div className="text-[10px] text-red-400 italic mb-1">💬 {lead.lostReason}</div>
                                            )}

                                            {lead.notes && (
                                                <div className="text-[10px] text-slate-500 italic line-clamp-1 border-l-2 border-slate-700 pl-1.5 mt-1">
                                                    {lead.notes.split('\n')[0]}
                                                </div>
                                            )}

                                            <div className="text-[9px] text-slate-600 mt-1.5 flex items-center gap-1">
                                                <span className="bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded">{lead.source}</span>
                                                <span>{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {columnLeads.length === 0 && (
                                        <div className="text-center py-6 text-slate-600 text-xs">
                                            Glissez un lead ici
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detail Panel (Slide-over) */}
            {showDetailPanel && selectedLead && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end" onClick={() => setShowDetailPanel(false)}>
                    <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white">Détail Lead</h3>
                                <button onClick={() => setShowDetailPanel(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
                            </div>

                            {/* Lead Info */}
                            <div className="space-y-4">
                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <h4 className="text-white font-semibold text-lg">{selectedLead.prenom} {selectedLead.nom}</h4>
                                    <div className="mt-2 space-y-1">
                                        <div className="text-sm text-slate-400">✉️ {selectedLead.email}</div>
                                        {selectedLead.telephone && <div className="text-sm text-slate-400">📱 {selectedLead.telephone}</div>}
                                        {selectedLead.formationSouhaitee && <div className="text-sm text-cyan-400">🎓 {selectedLead.formationSouhaitee}</div>}
                                    </div>
                                    {selectedLead.assignedTo && (
                                        <div className="mt-2 text-sm text-purple-400">
                                            👤 Commercial: {selectedLead.assignedTo.prenom} {selectedLead.assignedTo.nom}
                                        </div>
                                    )}
                                    {selectedLead.dateRdv && (
                                        <div className="mt-2 text-sm text-violet-400">
                                            📅 RDV: {new Date(selectedLead.dateRdv).toLocaleString('fr-FR')}
                                        </div>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <div className="text-xs text-slate-500 mb-1">Statut CRM</div>
                                    <div className="text-white font-medium">
                                        {CRM_COLUMNS.find(c => c.status === selectedLead.status)?.label || selectedLead.status}
                                    </div>
                                    {selectedLead.lostReason && (
                                        <div className="text-sm text-red-400 mt-1">Raison: {selectedLead.lostReason}</div>
                                    )}
                                    {selectedLead.convertedAt && (
                                        <div className="text-sm text-green-400 mt-1">Converti le {new Date(selectedLead.convertedAt).toLocaleDateString('fr-FR')}</div>
                                    )}
                                </div>

                                {/* Notes history */}
                                {selectedLead.notes && (
                                    <div className="bg-slate-800/50 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 mb-2">Historique</div>
                                        <div className="space-y-1.5 text-xs text-slate-300">
                                            {selectedLead.notes.split('\n').map((note, i) => (
                                                <div key={i} className="border-l-2 border-slate-700 pl-2">
                                                    {note}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            setShowDetailPanel(false);
                                            setShowReassignModal(true);
                                        }}
                                        className="w-full px-4 py-2.5 text-sm bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-lg hover:bg-purple-600/30 transition-colors"
                                    >
                                        👤 Réattribuer le commercial
                                    </button>
                                    {selectedLead.status !== 'PERDU' && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                setShowLostModal(true);
                                            }}
                                            className="w-full px-4 py-2.5 text-sm bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
                                        >
                                            ❌ Marquer comme Perdu
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lost Reason Modal */}
            {showLostModal && selectedLead && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLostModal(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">❌ Marquer comme Perdu</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            {selectedLead.prenom} {selectedLead.nom}
                        </p>

                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Raison de la perte</label>
                            <textarea
                                value={lostReason}
                                onChange={(e) => setLostReason(e.target.value)}
                                placeholder="Budget insuffisant, concurrence, timing..."
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowLostModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                                Annuler
                            </button>
                            <button
                                onClick={handleMarkAsLost}
                                disabled={isPending}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
                            >
                                {isPending ? '...' : 'Confirmer la perte'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reassign Modal */}
            {showReassignModal && selectedLead && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReassignModal(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">👤 Réattribuer le commercial</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            {selectedLead.prenom} {selectedLead.nom}
                        </p>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {commercials.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleReassign(c.id)}
                                    disabled={isPending}
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selectedLead.assignedTo?.id === c.id
                                            ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                                            : 'border-slate-700 bg-slate-800 text-white hover:border-slate-600 hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="font-medium text-sm">{c.prenom} {c.nom}</div>
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-end mt-4">
                            <button onClick={() => setShowReassignModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading */}
            {isPending && (
                <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 flex items-center gap-2 shadow-2xl z-50">
                    <div className="animate-spin w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-slate-300">Mise à jour...</span>
                </div>
            )}
        </div>
    );
}

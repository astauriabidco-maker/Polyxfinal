'use client';

import { useState, useTransition } from 'react';
import { updatePipelineStatus, registerInteraction, reassignLead } from '@/app/actions/leads';

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
    codePostal: string | null;
    ville: string | null;
    formationSouhaitee: string | null;
    nextCallDate: string | null;
    createdAt: string;
    assignedTo: { id: string; nom: string; prenom: string } | null;
    site: { id: string; name: string } | null;
}

interface Commercial {
    id: string;
    nom: string;
    prenom: string;
}

interface PipelineKanbanProps {
    leads: Lead[];
    commercials: Commercial[];
}

// --- Colonnes du Pipeline ---

const PIPELINE_COLUMNS = [
    { status: 'DISPATCHED', label: '🆕 Nouveau', color: 'border-blue-500', bgHeader: 'bg-blue-500/10', textColor: 'text-blue-400' },
    { status: 'A_RAPPELER', label: '📞 A rappeler', color: 'border-yellow-500', bgHeader: 'bg-yellow-500/10', textColor: 'text-yellow-400' },
    { status: 'NE_REPONDS_PAS', label: '📵 Ne réponds pas', color: 'border-orange-500', bgHeader: 'bg-orange-500/10', textColor: 'text-orange-400' },
    { status: 'PAS_INTERESSE', label: '🚫 Pas intéressé', color: 'border-red-500', bgHeader: 'bg-red-500/10', textColor: 'text-red-400' },
];

// --- Component ---

export default function PipelineKanban({ leads, commercials }: PipelineKanbanProps) {
    const [isPending, startTransition] = useTransition();
    const [draggedLead, setDraggedLead] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showRdvModal, setShowRdvModal] = useState(false);
    const [rdvDate, setRdvDate] = useState('');
    const [rdvNotes, setRdvNotes] = useState('');
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

        if (!leadId || leadId === draggedLead) {
            setDraggedLead(null);
            return;
        }

        startTransition(async () => {
            await updatePipelineStatus(leadId, targetStatus as any);
        });
        setDraggedLead(null);
    };

    // ---- Actions ----

    const handleBookRdv = () => {
        if (!selectedLead || !rdvDate) return;
        startTransition(async () => {
            await registerInteraction({
                leadId: selectedLead.id,
                type: 'BOOK_RDV',
                details: {
                    dateRdv: new Date(rdvDate).toISOString(),
                    notes: rdvNotes || undefined,
                },
            });
            setShowRdvModal(false);
            setRdvDate('');
            setRdvNotes('');
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
    const columnCounts = PIPELINE_COLUMNS.map(col => ({
        ...col,
        count: leads.filter(l => l.status === col.status).length,
    }));

    return (
        <div className="space-y-6">
            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {columnCounts.map(col => (
                    <div key={col.status} className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${col.bgHeader}`}>
                        <div className={`text-2xl font-bold ${col.textColor}`}>{col.count}</div>
                        <div className="text-xs text-slate-400 mt-1">{col.label}</div>
                    </div>
                ))}
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {PIPELINE_COLUMNS.map(col => {
                    const columnLeads = leads.filter(l => l.status === col.status);
                    const isOver = dragOverColumn === col.status;

                    return (
                        <div
                            key={col.status}
                            className={`bg-slate-900/30 border-t-2 ${col.color} rounded-xl transition-all ${isOver ? 'ring-2 ring-white/20 bg-slate-800/50' : ''}`}
                            onDragOver={(e) => handleDragOver(e, col.status)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.status)}
                        >
                            {/* Column Header */}
                            <div className={`p-3 ${col.bgHeader} rounded-t-xl border-b border-slate-800`}>
                                <div className="flex items-center justify-between">
                                    <span className={`font-semibold text-sm ${col.textColor}`}>{col.label}</span>
                                    <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">{columnLeads.length}</span>
                                </div>
                            </div>

                            {/* Cards */}
                            <div className="p-2 space-y-2 min-h-[200px] max-h-[70vh] overflow-y-auto">
                                {columnLeads.map(lead => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        className={`bg-slate-800/80 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-slate-600 transition-all group ${draggedLead === lead.id ? 'opacity-40 scale-95' : ''}`}
                                    >
                                        {/* Lead Name & Assigned */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="text-white font-medium text-sm">{lead.prenom} {lead.nom}</div>
                                                {lead.assignedTo && (
                                                    <div className="text-xs text-purple-400 mt-0.5">
                                                        👤 {lead.assignedTo.prenom} {lead.assignedTo.nom}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-500">{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</span>
                                        </div>

                                        {/* Contact Info */}
                                        {lead.telephone && (
                                            <div className="text-xs text-slate-400 mb-1">📱 {lead.telephone}</div>
                                        )}
                                        <div className="text-xs text-slate-500 mb-1 truncate">✉️ {lead.email}</div>

                                        {/* Formation & Location */}
                                        {lead.formationSouhaitee && (
                                            <div className="text-xs text-cyan-400/70 mb-1 truncate">🎓 {lead.formationSouhaitee}</div>
                                        )}
                                        {(lead.ville || lead.codePostal) && (
                                            <div className="text-xs text-slate-500 mb-1">📍 {[lead.ville, lead.codePostal].filter(Boolean).join(' ')}</div>
                                        )}

                                        {/* Source badge */}
                                        <div className="flex items-center gap-1 mb-2">
                                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{lead.source}</span>
                                            {lead.site && (
                                                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{lead.site.name}</span>
                                            )}
                                        </div>

                                        {/* Next call date */}
                                        {lead.nextCallDate && (
                                            <div className="text-xs text-amber-400 mb-2">⏰ Rappel: {new Date(lead.nextCallDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                                        )}

                                        {/* Last note (truncated) */}
                                        {lead.notes && (
                                            <div className="text-xs text-slate-500 italic mb-2 line-clamp-2 border-l-2 border-slate-700 pl-2">
                                                {lead.notes.split('\n')[0]}
                                            </div>
                                        )}

                                        {/* Action buttons (visible on hover) */}
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-slate-700/50">
                                            <button
                                                onClick={() => { setSelectedLead(lead); setShowRdvModal(true); }}
                                                className="text-[10px] bg-green-600/20 text-green-400 px-2 py-1 rounded hover:bg-green-600/30 transition-colors"
                                                title="Fixer un RDV → CRM"
                                            >
                                                📅 RDV
                                            </button>
                                            <button
                                                onClick={() => { setSelectedLead(lead); setShowReassignModal(true); }}
                                                className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-600/30 transition-colors"
                                                title="Réattribuer"
                                            >
                                                👤 Réattribuer
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {columnLeads.length === 0 && (
                                    <div className="text-center py-8 text-slate-600 text-xs">
                                        Glissez un lead ici
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* RDV Modal */}
            {showRdvModal && selectedLead && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRdvModal(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">📅 Fixer un RDV</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            {selectedLead.prenom} {selectedLead.nom} — Ce lead passera dans le module CRM
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">Date et heure du RDV *</label>
                                <input
                                    type="datetime-local"
                                    value={rdvDate}
                                    onChange={(e) => setRdvDate(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">Notes (optionnel)</label>
                                <textarea
                                    value={rdvNotes}
                                    onChange={(e) => setRdvNotes(e.target.value)}
                                    placeholder="Informations sur le rdv..."
                                    rows={3}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowRdvModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                                Annuler
                            </button>
                            <button
                                onClick={handleBookRdv}
                                disabled={!rdvDate || isPending}
                                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isPending ? '...' : '✅ Confirmer le RDV → CRM'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reassign Modal */}
            {showReassignModal && selectedLead && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReassignModal(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">👤 Réattribuer le lead</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            {selectedLead.prenom} {selectedLead.nom}
                            {selectedLead.assignedTo && ` — Actuellement: ${selectedLead.assignedTo.prenom} ${selectedLead.assignedTo.nom}`}
                        </p>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {commercials.length > 0 ? commercials.map(c => (
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
                                    {selectedLead.assignedTo?.id === c.id && (
                                        <span className="text-xs text-purple-400">✓ Assigné actuellement</span>
                                    )}
                                </button>
                            )) : (
                                <p className="text-sm text-slate-500 text-center py-4">Aucun commercial disponible</p>
                            )}
                        </div>

                        <div className="flex justify-end mt-4">
                            <button onClick={() => setShowReassignModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading overlay */}
            {isPending && (
                <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 flex items-center gap-2 shadow-2xl z-50">
                    <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-slate-300">Mise à jour...</span>
                </div>
            )}
        </div>
    );
}

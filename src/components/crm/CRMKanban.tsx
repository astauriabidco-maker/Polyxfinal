'use client';

import { useState, useTransition } from 'react';
import { updateCRMStatus, reassignLead } from '@/app/actions/leads';
import { RdvNonHonoreModal, WorkflowSuccessToast } from './RdvWorkflowModals';
import QualificationWizard from './QualificationWizard';
import {
    ChoixFinancementModal,
    TestDevisModal,
    ValidateFactureModal,
    PaiementModal,
    RelancePaiementModal,
    CpfInfoModal,
} from './FinancementWorkflowModals';

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
    organization?: { id: string; name: string; type: string } | null;
    // Financement fields
    financementType?: string | null;
    testVolume?: number | null;
    testTarif?: number | null;
    montantTotal?: number | null;
    montantPaye?: number | null;
    factureManuelleValidee?: boolean;
    relancePaiementCount?: number;
    dateFacture?: string | null;
    relanceCount?: number;
}

interface Commercial {
    id: string;
    nom: string;
    prenom: string;
}

interface CRMKanbanProps {
    leads: Lead[];
    commercials: Commercial[];
    organizationType?: string;
    multiOrg?: boolean;
    currentUserId?: string;
}

// --- Colonnes CRM pour OF (standard) ---

const OF_CRM_COLUMNS = [
    { status: 'RDV_PLANIFIE', label: '📅 RDV Planifié', color: 'border-violet-500', bgHeader: 'bg-violet-500/10', textColor: 'text-violet-400', description: 'RDV confirmé avec le prospect' },
    { status: 'RDV_NON_HONORE', label: '❌ RDV Non Honoré', color: 'border-red-500', bgHeader: 'bg-red-500/10', textColor: 'text-red-400', description: 'Le prospect ne s\'est pas présenté' },
    { status: 'RDV_ANNULE', label: '🚫 RDV Annulé', color: 'border-rose-500', bgHeader: 'bg-rose-500/10', textColor: 'text-rose-400', description: 'RDV annulé par le prospect ou le commercial' },
    { status: 'DECISION_EN_ATTENTE', label: '⏳ Décision en attente', color: 'border-yellow-500', bgHeader: 'bg-yellow-500/10', textColor: 'text-yellow-400', description: 'Prospect présent au RDV, reporte sa décision' },
    // === Parcours Financement Personnel ===
    { status: 'TEST_EN_COURS_PERSO', label: '📝 Test / Devis', color: 'border-teal-500', bgHeader: 'bg-teal-500/10', textColor: 'text-teal-400', description: 'Financement perso — Test ou devis en cours' },
    { status: 'EN_ATTENTE_PAIEMENT', label: '💳 Attente Paiement', color: 'border-pink-500', bgHeader: 'bg-pink-500/10', textColor: 'text-pink-400', description: 'Facture émise — en attente de paiement' },
    { status: 'INSCRIT_PERSO', label: '🎉 Inscrit (Perso)', color: 'border-lime-500', bgHeader: 'bg-lime-500/10', textColor: 'text-lime-400', description: 'Paiement reçu — Inscription validée' },
    // === Parcours CPF ===
    { status: 'CPF_COMPTE_A_DEMANDER', label: '🏛️ CPF — Compte', color: 'border-indigo-500', bgHeader: 'bg-indigo-500/10', textColor: 'text-indigo-400', description: 'CPF — Création/activation du compte' },
    // === Existants ===
    { status: 'COURRIERS_ENVOYES', label: '📝 Devis Envoyé', color: 'border-blue-500', bgHeader: 'bg-blue-500/10', textColor: 'text-blue-400', description: 'Devis / Convention envoyé' },
    { status: 'COURRIERS_RECUS', label: '📬 Convention Signée', color: 'border-cyan-500', bgHeader: 'bg-cyan-500/10', textColor: 'text-cyan-400', description: 'Documents signés et retournés' },
    { status: 'NEGOCIATION', label: '🤝 Montage Dossier', color: 'border-amber-500', bgHeader: 'bg-amber-500/10', textColor: 'text-amber-400', description: 'Financement en cours (OPCO, CPF, Pôle Emploi)' },
    { status: 'CONVERTI', label: '✅ Inscrit', color: 'border-green-500', bgHeader: 'bg-green-500/10', textColor: 'text-green-400', description: 'Inscription validée → Dossier créé' },
    { status: 'PROBLEMES_SAV', label: '⚠️ Problèmes/SAV', color: 'border-orange-500', bgHeader: 'bg-orange-500/10', textColor: 'text-orange-400', description: 'Problème à résoudre' },
    { status: 'PERDU', label: '🚫 Perdu', color: 'border-slate-500', bgHeader: 'bg-slate-500/10', textColor: 'text-slate-400', description: 'Lead abandonné' },
];

// --- Colonnes CRM pour CFA (alternance / apprentissage) ---

const CFA_CRM_COLUMNS = [
    { status: 'RDV_PLANIFIE', label: '📅 RDV / Entretien', color: 'border-violet-500', bgHeader: 'bg-violet-500/10', textColor: 'text-violet-400', description: 'Entretien de positionnement planifié' },
    { status: 'RDV_NON_HONORE', label: '❌ Absent Entretien', color: 'border-red-500', bgHeader: 'bg-red-500/10', textColor: 'text-red-400', description: 'L\'apprenti ne s\'est pas présenté' },
    { status: 'RDV_ANNULE', label: '🚫 Entretien Annulé', color: 'border-rose-500', bgHeader: 'bg-rose-500/10', textColor: 'text-rose-400', description: 'Entretien annulé' },
    { status: 'DECISION_EN_ATTENTE', label: '⏳ Réflexion', color: 'border-yellow-500', bgHeader: 'bg-yellow-500/10', textColor: 'text-yellow-400', description: 'L\'apprenti réfléchit à sa décision' },
    { status: 'COURRIERS_ENVOYES', label: '🏢 Recherche Employeur', color: 'border-indigo-500', bgHeader: 'bg-indigo-500/10', textColor: 'text-indigo-400', description: 'L\'apprenti cherche une entreprise d\'accueil' },
    { status: 'COURRIERS_RECUS', label: '🤝 Employeur Trouvé', color: 'border-cyan-500', bgHeader: 'bg-cyan-500/10', textColor: 'text-cyan-400', description: 'Entreprise d\'accueil identifiée, en attente contrat' },
    { status: 'NEGOCIATION', label: '📋 Contrat & OPCO', color: 'border-amber-500', bgHeader: 'bg-amber-500/10', textColor: 'text-amber-400', description: 'CERFA en cours, validation OPCO en attente' },
    { status: 'CONVERTI', label: '🎓 Inscrit', color: 'border-green-500', bgHeader: 'bg-green-500/10', textColor: 'text-green-400', description: 'Contrat signé, OPCO validé → Dossier créé' },
    { status: 'PROBLEMES_SAV', label: '⚠️ Rupture / Problème', color: 'border-orange-500', bgHeader: 'bg-orange-500/10', textColor: 'text-orange-400', description: 'Rupture de contrat ou problème employeur' },
    { status: 'PERDU', label: '🚫 Perdu', color: 'border-slate-500', bgHeader: 'bg-slate-500/10', textColor: 'text-slate-400', description: 'Candidat abandonné, sans employeur ou désistement' },
];

// --- Component ---

export default function CRMKanban({ leads, commercials, organizationType = 'OF_STANDARD', multiOrg = false, currentUserId = '' }: CRMKanbanProps) {
    const isCFA = organizationType === 'CFA';
    const isMixed = organizationType === 'MIXED' || multiOrg;
    const CRM_COLUMNS = isMixed ? OF_CRM_COLUMNS : (isCFA ? CFA_CRM_COLUMNS : OF_CRM_COLUMNS);

    const [isPending, startTransition] = useTransition();
    const [draggedLead, setDraggedLead] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [showLostModal, setShowLostModal] = useState(false);
    const [lostReason, setLostReason] = useState('');
    const [showReassignModal, setShowReassignModal] = useState(false);

    // Workflow RDV
    const [showQualifyModal, setShowQualifyModal] = useState(false);
    const [showNonHonoreModal, setShowNonHonoreModal] = useState(false);
    const [successToast, setSuccessToast] = useState<{ message: string; nextStep?: string | null } | null>(null);

    // Workflow Financement
    const [showFinancementModal, setShowFinancementModal] = useState(false);
    const [showTestDevisModal, setShowTestDevisModal] = useState(false);
    const [showValidateFactureModal, setShowValidateFactureModal] = useState(false);
    const [showPaiementModal, setShowPaiementModal] = useState(false);
    const [showRelancePaiementModal, setShowRelancePaiementModal] = useState(false);
    const [showCpfInfoModal, setShowCpfInfoModal] = useState(false);
    // Shortcut for CPF steps
    const [cpfInitialStep, setCpfInitialStep] = useState<string | null>(null);

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

    // CFA-specific stats
    const searchingEmployer = isCFA ? leads.filter(l => l.status === 'COURRIERS_ENVOYES').length : 0;
    const employerFound = isCFA ? leads.filter(l => l.status === 'COURRIERS_RECUS').length : 0;
    const contractPending = isCFA ? leads.filter(l => l.status === 'NEGOCIATION').length : 0;

    return (
        <div className="space-y-6">
            {/* Mode Badge */}
            <div className="flex items-center gap-3">
                {isCFA ? (
                    <div className="bg-purple-500/10 text-purple-400 px-4 py-2 rounded-xl text-sm font-medium border border-purple-500/20 flex items-center gap-2.5 shadow-sm shadow-purple-500/5">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                        </span>
                        🎓 CRM Apprentissage (CFA)
                        <span className="text-xs text-purple-500/70 ml-1">— Recherche employeur → Contrat → OPCO → Inscription</span>
                    </div>
                ) : (
                    <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-xl text-sm font-medium border border-blue-500/20 flex items-center gap-2.5 shadow-sm shadow-blue-500/5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        📋 CRM Formation Continue (OF)
                        <span className="text-xs text-blue-500/70 ml-1">— Devis → Convention → Financement → Inscription</span>
                    </div>
                )}
            </div>

            {/* Global CRM Stats */}
            {isCFA ? (
                /* CFA Stats - with apprenticeship-specific metrics */
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                        <div className="text-2xl font-bold text-white">{totalLeads}</div>
                        <div className="text-xs text-slate-400 mt-1">Total CRM</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-blue-500/5">
                        <div className="text-2xl font-bold text-blue-400">{inProgress}</div>
                        <div className="text-xs text-slate-400 mt-1">En cours</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-indigo-500/5">
                        <div className="text-2xl font-bold text-indigo-400">{searchingEmployer}</div>
                        <div className="text-xs text-slate-400 mt-1">🏢 Cherche employeur</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-cyan-500/5">
                        <div className="text-2xl font-bold text-cyan-400">{employerFound}</div>
                        <div className="text-xs text-slate-400 mt-1">🤝 Employeur trouvé</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-amber-500/5">
                        <div className="text-2xl font-bold text-amber-400">{contractPending}</div>
                        <div className="text-xs text-slate-400 mt-1">📋 Contrat/OPCO</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-green-500/5">
                        <div className="text-2xl font-bold text-green-400">{convertedCount}</div>
                        <div className="text-xs text-slate-400 mt-1">🎓 Inscrits</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 bg-red-500/5">
                        <div className="text-2xl font-bold text-red-400">{lostCount}</div>
                        <div className="text-xs text-slate-400 mt-1">Perdus</div>
                    </div>
                </div>
            ) : (
                /* OF Stats - original layout */
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
            )}

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
                                    {col.description && (
                                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">{col.description}</p>
                                    )}
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

                                            {/* Multi-org badge */}
                                            {multiOrg && lead.organization && (
                                                <div className={`mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${lead.organization.type === 'CFA' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'}`}>
                                                    {lead.organization.type === 'CFA' ? '🎓' : '🏢'} {lead.organization.name}
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

                                            {/* CFA-specific: show progress indicator */}
                                            {isCFA && (
                                                <div className="mt-2 pt-1.5 border-t border-slate-700/50">
                                                    <div className="flex items-center gap-1">
                                                        {CFA_CRM_COLUMNS.slice(0, -2).map((step, i) => {
                                                            const currentIndex = CFA_CRM_COLUMNS.findIndex(c => c.status === lead.status);
                                                            const isComplete = i < currentIndex;
                                                            const isCurrent = i === currentIndex;
                                                            return (
                                                                <div
                                                                    key={step.status}
                                                                    className={`h-1 flex-1 rounded-full transition-all ${isComplete ? 'bg-green-500' : isCurrent ? 'bg-amber-400' : 'bg-slate-700'
                                                                        }`}
                                                                    title={step.label}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="text-[9px] text-slate-600 mt-1.5 flex items-center gap-1">
                                                <span className={`px-1 py-0.5 rounded ${isCFA ? 'bg-purple-500/20 text-purple-300' : 'bg-indigo-500/20 text-indigo-300'}`}>{lead.source}</span>
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
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isCFA ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'}`}>
                                        {selectedLead.prenom[0]}{selectedLead.nom[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Détail Lead</h3>
                                        {isCFA && <span className="text-[10px] text-purple-400 font-medium">🎓 Parcours Apprentissage</span>}
                                    </div>
                                </div>
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
                                    <div className="text-xs text-slate-500 mb-1">{isCFA ? 'Étape Apprentissage' : 'Statut CRM'}</div>
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

                                {/* CFA-specific: Apprenticeship Progress Tracker */}
                                {isCFA && (
                                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                                        <div className="text-xs text-purple-400 font-semibold mb-3">📊 Progression Apprentissage</div>
                                        <div className="space-y-2">
                                            {CFA_CRM_COLUMNS.slice(0, -2).map((step, i) => {
                                                const currentIndex = CFA_CRM_COLUMNS.findIndex(c => c.status === selectedLead.status);
                                                const isComplete = i < currentIndex;
                                                const isCurrent = i === currentIndex;
                                                return (
                                                    <div key={step.status} className="flex items-center gap-2">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${isComplete ? 'bg-green-500 text-white' : isCurrent ? 'bg-amber-400 text-black ring-2 ring-amber-400/30' : 'bg-slate-700 text-slate-500'
                                                            }`}>
                                                            {isComplete ? '✓' : i + 1}
                                                        </div>
                                                        <span className={`text-xs ${isComplete ? 'text-green-400 line-through' : isCurrent ? 'text-amber-300 font-semibold' : 'text-slate-500'}`}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* CFA-specific: Quick Context */}
                                {isCFA && (
                                    <div className="bg-slate-800/50 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 mb-2">📝 Contexte CFA</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-700/30 rounded-lg p-2">
                                                <div className="text-[10px] text-slate-500">Type de contrat</div>
                                                <div className="text-xs text-white font-medium">Apprentissage</div>
                                            </div>
                                            <div className="bg-slate-700/30 rounded-lg p-2">
                                                <div className="text-[10px] text-slate-500">Financement</div>
                                                <div className="text-xs text-white font-medium">OPCO</div>
                                            </div>
                                            <div className="bg-slate-700/30 rounded-lg p-2">
                                                <div className="text-[10px] text-slate-500">Employeur</div>
                                                <div className="text-xs text-amber-400 font-medium">
                                                    {selectedLead.status === 'COURRIERS_ENVOYES' ? '🔍 En recherche'
                                                        : selectedLead.status === 'COURRIERS_RECUS' || selectedLead.status === 'NEGOCIATION' || selectedLead.status === 'CONVERTI' ? '✅ Trouvé'
                                                            : '—'}
                                                </div>
                                            </div>
                                            <div className="bg-slate-700/30 rounded-lg p-2">
                                                <div className="text-[10px] text-slate-500">CERFA</div>
                                                <div className="text-xs text-white font-medium">
                                                    {selectedLead.status === 'NEGOCIATION' ? '📋 En cours'
                                                        : selectedLead.status === 'CONVERTI' ? '✅ Validé'
                                                            : '—'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                    {/* 🎯 Workflow: Qualifier le RDV (visible seulement si RDV_PLANIFIE) */}
                                    {selectedLead.status === 'RDV_PLANIFIE' && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                setShowQualifyModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-sm bg-gradient-to-r from-violet-600/20 to-cyan-600/20 text-white border border-violet-500/40 rounded-xl hover:from-violet-600/30 hover:to-cyan-600/30 transition-all font-medium shadow-sm"
                                        >
                                            🎯 Qualifier le RDV
                                        </button>
                                    )}

                                    {/* 📞 Workflow: Suivi RDV non honoré */}
                                    {selectedLead.status === 'RDV_NON_HONORE' && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                setShowNonHonoreModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-sm bg-gradient-to-r from-amber-600/20 to-red-600/20 text-white border border-amber-500/40 rounded-xl hover:from-amber-600/30 hover:to-red-600/30 transition-all font-medium shadow-sm"
                                        >
                                            📞 Action de suivi (appel / relance)
                                        </button>
                                    )}

                                    {/* 💰 Workflow: Choix financement (accessible depuis RDV_PLANIFIE qualifié ou DECISION_EN_ATTENTE) */}
                                    {(selectedLead.status === 'RDV_PLANIFIE' || selectedLead.status === 'DECISION_EN_ATTENTE') && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                setShowFinancementModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-sm bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-white border border-emerald-500/40 rounded-xl hover:from-emerald-600/30 hover:to-teal-600/30 transition-all font-medium shadow-sm"
                                        >
                                            💰 Choisir le financement
                                        </button>
                                    )}

                                    {/* 📝 Workflow: Test / Devis (Parcours personnel) */}
                                    {selectedLead.status === 'TEST_EN_COURS_PERSO' && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setShowDetailPanel(false);
                                                    setShowTestDevisModal(true);
                                                }}
                                                className="w-full px-4 py-3 text-sm bg-gradient-to-r from-teal-600/20 to-emerald-600/20 text-white border border-teal-500/40 rounded-xl hover:from-teal-600/30 hover:to-emerald-600/30 transition-all font-medium shadow-sm"
                                            >
                                                📝 Saisir le test / devis
                                            </button>
                                            {/* Bouton de validation si devis saisi mais non validé */}
                                            {selectedLead.montantTotal && selectedLead.montantTotal > 0 && !selectedLead.factureManuelleValidee && (
                                                <button
                                                    onClick={() => {
                                                        setShowDetailPanel(false);
                                                        setShowValidateFactureModal(true);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-sm bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded-lg hover:bg-amber-600/30 transition-colors"
                                                >
                                                    ✅ Valider la facture manuelle ({selectedLead.montantTotal.toFixed(2)}€)
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {/* 💳 Workflow: Paiement */}
                                    {selectedLead.status === 'EN_ATTENTE_PAIEMENT' && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setShowDetailPanel(false);
                                                    setShowPaiementModal(true);
                                                }}
                                                className="w-full px-4 py-3 text-sm bg-gradient-to-r from-pink-600/20 to-emerald-600/20 text-white border border-pink-500/40 rounded-xl hover:from-pink-600/30 hover:to-emerald-600/30 transition-all font-medium shadow-sm"
                                            >
                                                💳 Enregistrer un paiement
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowDetailPanel(false);
                                                    setShowRelancePaiementModal(true);
                                                }}
                                                className="w-full px-4 py-2.5 text-sm bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded-lg hover:bg-amber-600/30 transition-colors"
                                            >
                                                🔔 Relancer le paiement
                                            </button>
                                        </>
                                    )}

                                    {/* 📨 Workflow: Réception Courrier CPF */}
                                    {selectedLead.status === 'COURRIERS_ENVOYES' && selectedLead.financementType === 'CPF' && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                setCpfInitialStep('cpf_courrier_recu');
                                                setShowQualifyModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-sm bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-white border border-blue-500/40 rounded-xl hover:from-blue-600/30 hover:to-cyan-600/30 transition-all font-medium shadow-sm"
                                        >
                                            📨 Gérer Réception Courrier (CPF)
                                        </button>
                                    )}

                                    {/* 🏛️ CPF Info */}
                                    {selectedLead.status === 'CPF_COMPTE_A_DEMANDER' && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                setShowCpfInfoModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-sm bg-gradient-to-r from-indigo-600/20 to-blue-600/20 text-white border border-indigo-500/40 rounded-xl hover:from-indigo-600/30 hover:to-blue-600/30 transition-all font-medium shadow-sm"
                                        >
                                            🏛️ Voir les étapes CPF
                                        </button>
                                    )}

                                    {/* 🎓 Workflow: Inscription */}
                                    {selectedLead.status === 'COURRIERS_RECUS' && (
                                        <button
                                            onClick={() => {
                                                setShowDetailPanel(false);
                                                startTransition(async () => {
                                                    await updateCRMStatus({
                                                        leadId: selectedLead.id,
                                                        status: 'CONVERTI',
                                                    });
                                                });
                                            }}
                                            disabled={isPending}
                                            className="w-full px-4 py-3 text-sm bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-white border border-green-500/40 rounded-xl hover:from-green-600/30 hover:to-emerald-600/30 transition-all font-medium shadow-sm"
                                        >
                                            {isPending ? 'Enregistrement...' : '✅ Valider l\'Inscription'}
                                        </button>
                                    )}

                                    {/* Financement info badge */}
                                    {selectedLead.financementType && (
                                        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
                                            <div className="text-xs text-slate-500 mb-1">💰 Mode de financement</div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${selectedLead.financementType === 'PERSONNEL'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {selectedLead.financementType === 'PERSONNEL' ? '💳 Personnel' : '🏛️ CPF'}
                                                </span>
                                                {selectedLead.montantTotal && selectedLead.montantTotal > 0 && (
                                                    <span className="text-xs text-slate-400">
                                                        {(selectedLead.montantPaye || 0).toFixed(2)}€ / {selectedLead.montantTotal.toFixed(2)}€
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

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
                                            {isCFA ? '🚫 Marquer comme Perdu (sans employeur / désistement)' : '❌ Marquer comme Perdu'}
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
                        <h3 className="text-lg font-bold text-white mb-1">
                            {isCFA ? '🚫 Marquer comme Perdu (CFA)' : '❌ Marquer comme Perdu'}
                        </h3>
                        <p className="text-sm text-slate-400 mb-4">
                            {selectedLead.prenom} {selectedLead.nom}
                        </p>

                        {isCFA && (
                            <div className="mb-4">
                                <label className="text-sm text-slate-300 block mb-1.5">Motif de perte</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Pas d\'employeur trouvé', 'Désistement candidat', 'Refus OPCO', 'Rupture période d\'essai', 'Orientation autre CFA', 'Autre raison'].map(reason => (
                                        <button
                                            key={reason}
                                            onClick={() => setLostReason(reason)}
                                            className={`text-xs px-3 py-2 rounded-lg border transition-all text-left ${lostReason === reason
                                                ? 'border-red-500 bg-red-500/10 text-red-300'
                                                : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                                                }`}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-sm text-slate-300 block mb-1">
                                {isCFA ? 'Détails complémentaires' : 'Raison de la perte'}
                            </label>
                            <textarea
                                value={lostReason}
                                onChange={(e) => setLostReason(e.target.value)}
                                placeholder={isCFA ? 'Pas d\'employeur trouvé, OPCO refusé, désistement...' : 'Budget insuffisant, concurrence, timing...'}
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

            {/* ═══ Workflow Modals ═══ */}

            {/* Qualification Wizard (remplace l'ancien QualifyRdvModal) */}
            {showQualifyModal && selectedLead && (selectedLead.status === 'RDV_PLANIFIE' || cpfInitialStep === 'cpf_courrier_recu') && (
                <QualificationWizard
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => {
                        setShowQualifyModal(false);
                        setSelectedLead(null);
                        setCpfInitialStep(null);
                    }}
                    onComplete={(result) => {
                        setShowQualifyModal(false);
                        setSelectedLead(null);
                        setCpfInitialStep(null);
                        setSuccessToast({ message: result.message });
                        setTimeout(() => setSuccessToast(null), 6000);
                    }}
                    initialStep={cpfInitialStep === 'cpf_courrier_recu' ? 'cpf_wizard' : undefined}
                    initialCpfStep={cpfInitialStep || undefined}
                />
            )}

            {/* Non Honoré Follow-up Modal */}
            {showNonHonoreModal && selectedLead && selectedLead.status === 'RDV_NON_HONORE' && (
                <RdvNonHonoreModal
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => { setShowNonHonoreModal(false); setSelectedLead(null); }}
                    onSuccess={(result) => {
                        setShowNonHonoreModal(false);
                        setSelectedLead(null);
                        setSuccessToast({ message: result.message || 'Action enregistrée' });
                        setTimeout(() => setSuccessToast(null), 6000);
                    }}
                />
            )}

            {/* ═══ Financement Workflow Modals ═══ */}

            {/* Choix Financement Modal */}
            {showFinancementModal && selectedLead && (
                <ChoixFinancementModal
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => { setShowFinancementModal(false); setSelectedLead(null); }}
                    onSuccess={(result) => {
                        setShowFinancementModal(false);
                        if (result.nextStep === 'SUBMIT_TEST') {
                            // Financement personnel → ouvrir directement le test/devis
                            setShowTestDevisModal(true);
                        } else if (result.nextStep === 'CPF_INFO_SCREEN') {
                            // CPF → ouvrir l'écran d'info CPF
                            setShowCpfInfoModal(true);
                        } else {
                            setSelectedLead(null);
                        }
                        setSuccessToast({ message: result.message || 'Financement sélectionné' });
                        setTimeout(() => setSuccessToast(null), 5000);
                    }}
                />
            )}

            {/* Test/Devis Modal */}
            {showTestDevisModal && selectedLead && (
                <TestDevisModal
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => { setShowTestDevisModal(false); setSelectedLead(null); }}
                    onSuccess={(result) => {
                        setShowTestDevisModal(false);
                        if (result.nextStep === 'VALIDATE_FACTURE' && result.isManual) {
                            // Saisie manuelle → ouvrir la validation
                            // On met à jour le lead sélectionné avec les nouvelles infos
                            if (selectedLead) {
                                setSelectedLead({
                                    ...selectedLead,
                                    montantTotal: result.montantTotal,
                                });
                            }
                            setShowValidateFactureModal(true);
                        } else {
                            setSelectedLead(null);
                        }
                        setSuccessToast({ message: result.message || 'Test/Devis enregistré' });
                        setTimeout(() => setSuccessToast(null), 5000);
                    }}
                />
            )}

            {/* Validate Facture Modal */}
            {showValidateFactureModal && selectedLead && (
                <ValidateFactureModal
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => { setShowValidateFactureModal(false); setSelectedLead(null); }}
                    onSuccess={(result) => {
                        setShowValidateFactureModal(false);
                        setSelectedLead(null);
                        setSuccessToast({ message: result.message || 'Facture validée' });
                        setTimeout(() => setSuccessToast(null), 5000);
                    }}
                />
            )}

            {/* Paiement Modal */}
            {showPaiementModal && selectedLead && (
                <PaiementModal
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => { setShowPaiementModal(false); setSelectedLead(null); }}
                    onSuccess={(result) => {
                        setShowPaiementModal(false);
                        setSelectedLead(null);
                        setSuccessToast({ message: result.message || 'Paiement enregistré' });
                        setTimeout(() => setSuccessToast(null), 6000);
                    }}
                />
            )}

            {/* Relance Paiement Modal */}
            {showRelancePaiementModal && selectedLead && (
                <RelancePaiementModal
                    lead={selectedLead}
                    performedBy={currentUserId}
                    onClose={() => { setShowRelancePaiementModal(false); setSelectedLead(null); }}
                    onSuccess={(result) => {
                        setShowRelancePaiementModal(false);
                        setSelectedLead(null);
                        setSuccessToast({ message: result.message || 'Relance envoyée' });
                        setTimeout(() => setSuccessToast(null), 5000);
                    }}
                />
            )}

            {/* CPF Info Modal */}
            {showCpfInfoModal && selectedLead && (
                <CpfInfoModal
                    lead={selectedLead}
                    onClose={() => { setShowCpfInfoModal(false); setSelectedLead(null); }}
                />
            )}

            {/* Success Toast */}
            {successToast && (
                <WorkflowSuccessToast
                    message={successToast.message}
                    nextStep={successToast.nextStep}
                    onDismiss={() => setSuccessToast(null)}
                />
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

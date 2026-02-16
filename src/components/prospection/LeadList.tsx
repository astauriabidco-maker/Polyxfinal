'use client';

import { useState } from 'react';
import { Lead, LeadStatus, Campaign, Site } from '@prisma/client';
import LeadInteractionPanel from './LeadInteractionPanel';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LeadWithRelations extends Lead {
    campaign?: Pick<Campaign, 'name' | 'id' | 'source'> | null;
    site?: { name: string } | null;
}

interface LeadListProps {
    initialLeads: LeadWithRelations[];
    sites?: Site[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    'DISPATCHED': { label: 'A traiter', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '✨' },
    'ATTEMPTED': { label: 'Rappeler', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '📞' },
    'RDV_SCHEDULED': { label: 'RDV Planifié', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '📅' },
    'NURTURING': { label: 'A mûrir', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: '🌱' },
    'QUALIFIED': { label: 'Qualifié', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '⭐' },
    'NOT_ELIGIBLE': { label: 'Non éligible', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '❌' },
};

export default function LeadList({ initialLeads, sites = [] }: LeadListProps) {
    const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
    const [filterStatus, setFilterStatus] = useState<LeadStatus | 'ALL'>('DISPATCHED');
    const [filterSiteId, setFilterSiteId] = useState<string>('ALL');

    const filteredLeads = initialLeads.filter(lead => {
        const statusMatch = filterStatus === 'ALL' ? true : lead.status === filterStatus;
        const siteMatch = filterSiteId === 'ALL' ? true : lead.siteId === filterSiteId;
        return statusMatch && siteMatch;
    });

    return (
        <div className="flex h-[calc(100vh-100px)]">
            {/* Left Sidebar: List */}
            <div className="w-1/3 border-r border-slate-700/50 flex flex-col">
                <div className="p-4 border-b border-slate-700/50 space-y-2">
                    <h2 className="text-lg font-medium text-white">Mes Leads</h2>
                    <select
                        className="block w-full rounded-lg bg-slate-700/50 border border-slate-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'ALL')}
                    >
                        <option value="ALL">Tous les statuts</option>
                        <option value="DISPATCHED">✨ Nouveaux (A traiter)</option>
                        <option value="ATTEMPTED">📞 Tentative (Rappeler)</option>
                        <option value="RDV_SCHEDULED">📅 RDV Planifié</option>
                        <option value="QUALIFIED">⭐ Qualifié</option>
                        <option value="NURTURING">🌱 A mûrir</option>
                        <option value="NOT_ELIGIBLE">❌ Non éligible</option>
                    </select>
                    {sites.length > 0 && (
                        <select
                            className="block w-full rounded-lg bg-slate-700/50 border border-slate-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            value={filterSiteId}
                            onChange={(e) => setFilterSiteId(e.target.value)}
                        >
                            <option value="ALL">Tous les sites</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    )}
                    <p className="text-xs text-slate-500">{filteredLeads.length} lead{filteredLeads.length > 1 ? 's' : ''}</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <ul className="divide-y divide-slate-700/50">
                        {filteredLeads.map((lead) => {
                            const cfg = STATUS_CONFIG[lead.status] || { label: lead.status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: '📊' };
                            return (
                                <li
                                    key={lead.id}
                                    onClick={() => setSelectedLead(lead)}
                                    className={`cursor-pointer transition-colors ${selectedLead?.id === lead.id ? 'bg-cyan-500/10 border-l-4 border-cyan-500' : 'hover:bg-slate-800/50'}`}
                                >
                                    <div className="px-4 py-4">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-medium text-white truncate">
                                                {lead.nom} {lead.prenom}
                                            </p>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                                                {cfg.icon} {cfg.label}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-400 truncate">{lead.email}</p>
                                        <div className="mt-2 flex items-center justify-between">
                                            <p className="text-xs text-slate-500">
                                                {lead.telephone || 'Aucun téléphone'}
                                            </p>
                                            {lead.site && (
                                                <span className="text-xs text-slate-500">📍 {lead.site.name}</span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-600">
                                            Il y a {formatDistanceToNow(new Date(lead.createdAt), { locale: fr })}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                        {filteredLeads.length === 0 && (
                            <li className="p-8 text-center">
                                <p className="text-3xl mb-2">📭</p>
                                <p className="text-sm text-slate-500">Aucun lead trouvé.</p>
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Right Content: Detail & Action */}
            <div className="flex-1 p-6 overflow-y-auto">
                {selectedLead ? (
                    <div>
                        {/* Detail Card */}
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 mb-6 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-700/50">
                                <h3 className="text-lg font-medium text-white">
                                    Détails du Lead
                                </h3>
                            </div>
                            <div className="px-6 py-4">
                                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-xs font-medium text-slate-500 uppercase">Nom complet</dt>
                                        <dd className="mt-1 text-sm text-white">{selectedLead.prenom} {selectedLead.nom}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-500 uppercase">Email</dt>
                                        <dd className="mt-1 text-sm text-white">{selectedLead.email}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-500 uppercase">Téléphone</dt>
                                        <dd className="mt-1 text-sm text-white">{selectedLead.telephone || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-500 uppercase">Ville / CP</dt>
                                        <dd className="mt-1 text-sm text-white">{selectedLead.ville || '—'} {selectedLead.codePostal ? `(${selectedLead.codePostal})` : ''}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-500 uppercase">Formation souhaitée</dt>
                                        <dd className="mt-1 text-sm text-white">{selectedLead.formationSouhaitee || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-500 uppercase">Source</dt>
                                        <dd className="mt-1 text-sm text-white">
                                            {selectedLead.source} {selectedLead.origin ? `(${selectedLead.origin})` : ''}
                                            {selectedLead.campaign ? ` — ${selectedLead.campaign.name}` : ''}
                                        </dd>
                                    </div>
                                    {selectedLead.message && (
                                        <div className="col-span-2">
                                            <dt className="text-xs font-medium text-slate-500 uppercase">Message</dt>
                                            <dd className="mt-1 text-sm text-slate-300">{selectedLead.message}</dd>
                                        </div>
                                    )}
                                    {selectedLead.notes && (
                                        <div className="col-span-2">
                                            <dt className="text-xs font-medium text-slate-500 uppercase">Historique Notes</dt>
                                            <dd className="mt-1 text-sm text-slate-300 whitespace-pre-line bg-slate-700/30 rounded-lg p-3 border border-slate-600/50 max-h-40 overflow-y-auto">{selectedLead.notes}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>

                        <LeadInteractionPanel lead={selectedLead} onInteractionComplete={() => { }} />
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-4xl mb-3">👈</p>
                            <p className="text-slate-500">Sélectionnez un lead pour commencer la qualification</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

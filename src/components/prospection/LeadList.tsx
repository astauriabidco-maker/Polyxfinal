'use client';

import { useState } from 'react';
import { Lead, LeadStatus, Campaign } from '@prisma/client';
import LeadInteractionPanel from './LeadInteractionPanel';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LeadWithRelations extends Lead {
    campaign?: Campaign | null;
    site?: { name: string } | null;
}

interface LeadListProps {
    initialLeads: LeadWithRelations[];
}

export default function LeadList({ initialLeads }: LeadListProps) {
    const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
    const [filterStatus, setFilterStatus] = useState<LeadStatus | 'ALL'>('DISPATCHED');

    const filteredLeads = initialLeads.filter(lead =>
        filterStatus === 'ALL' ? true : lead.status === filterStatus
    );

    return (
        <div className="flex h-[calc(100vh-100px)]">
            {/* Left Sidebar: List */}
            <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Mes Leads</h2>
                    <div className="mt-2">
                        <select
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'ALL')}
                        >
                            <option value="ALL">Tous les statuts</option>
                            <option value="DISPATCHED">✨ Nouveaux (A traiter)</option>
                            <option value="ATTEMPTED">📞 Tentative (Rappeler)</option>
                            <option value="RDV_SCHEDULED">📅 RDV Planifié</option>
                            <option value="NURTURING">🌱 A mûrir</option>
                            <option value="NOT_ELIGIBLE">❌ Non éligible</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <ul className="divide-y divide-gray-200">
                        {filteredLeads.map((lead) => (
                            <li
                                key={lead.id}
                                onClick={() => setSelectedLead(lead)}
                                className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedLead?.id === lead.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                            >
                                <div className="px-4 py-4 sm:px-6">
                                    <div className="flex justify-between">
                                        <p className="text-sm font-medium text-indigo-600 truncate">
                                            {lead.nom} {lead.prenom}
                                        </p>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${lead.status === 'DISPATCHED' ? 'bg-green-100 text-green-800' :
                                                    lead.status === 'ATTEMPTED' ? 'bg-yellow-100 text-yellow-800' :
                                                        lead.status === 'RDV_SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'}`}>
                                                {lead.status}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-500">
                                        <p className="truncate">{lead.email}</p>
                                        <p className="truncate text-xs mt-1">
                                            {lead.telephone || 'Aucun téléphone'}
                                        </p>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-400">
                                        Il y a {formatDistanceToNow(new Date(lead.createdAt), { locale: fr })}
                                    </div>
                                </div>
                            </li>
                        ))}
                        {filteredLeads.length === 0 && (
                            <li className="p-4 text-center text-sm text-gray-500">Aucun lead trouvé.</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Right Content: Detail & Action */}
            <div className="flex-1 bg-gray-50 p-6 overflow-y-auto">
                {selectedLead ? (
                    <div>
                        <div className="bg-white shadow sm:rounded-lg mb-6 overflow-hidden">
                            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Détails du Lead
                                </h3>
                            </div>
                            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                                <dl className="sm:divide-y sm:divide-gray-200">
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Nom complet</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedLead.prenom} {selectedLead.nom}</dd>
                                    </div>
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Email</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedLead.email}</dd>
                                    </div>
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Téléphone</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedLead.telephone || '-'}</dd>
                                    </div>
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Ville / CP</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedLead.ville} ({selectedLead.codePostal})</dd>
                                    </div>
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Formation souhaitée</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedLead.formationSouhaitee || '-'}</dd>
                                    </div>
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Message</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedLead.message || '-'}</dd>
                                    </div>
                                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-500">Source / Origine</dt>
                                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                            {selectedLead.source} {selectedLead.origin ? `(${selectedLead.origin})` : ''}
                                            {selectedLead.campaign ? ` - Campagne: ${selectedLead.campaign.name}` : ''}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        <LeadInteractionPanel lead={selectedLead} onInteractionComplete={() => {
                            // Refresh or update local state could happen here,
                            // but server component refresh handles it via router.refresh in the child
                            // We might want to clear selection or just let it reload
                        }} />
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Sélectionnez un lead pour commencer la qualification
                    </div>
                )}
            </div>
        </div>
    );
}

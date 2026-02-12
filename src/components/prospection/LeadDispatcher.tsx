'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dispatchLead } from '@/app/actions/leads';
import { Lead, Site } from '@prisma/client';

interface LeadDispatcherProps {
    leads: (Lead & { campaign?: { name: string } | null })[];
    sites: Site[];
}

export default function LeadDispatcher({ leads, sites }: LeadDispatcherProps) {
    const router = useRouter();
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [targetSiteId, setTargetSiteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDispatch = async () => {
        if (!targetSiteId || selectedLeads.length === 0) return;

        setIsSubmitting(true);
        try {
            // In a real app, we might want to do this in bulk
            // For now, let's do it one by one or Promise.all
            await Promise.all(selectedLeads.map(leadId =>
                dispatchLead({ leadId, siteId: targetSiteId })
            ));

            router.refresh();
            setSelectedLeads([]);
            setTargetSiteId('');
        } catch (error) {
            console.error('Failed to dispatch:', error);
            alert('Erreur lors du dispatch');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
        );
    };

    if (leads.length === 0) {
        return (
            <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500">Aucun nouveau lead à dispatcher.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-700">{selectedLeads.length} sélectionné(s)</span>
                    <select
                        className="form-select rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={targetSiteId}
                        onChange={(e) => setTargetSiteId(e.target.value)}
                    >
                        <option value="">Choisir une agence...</option>
                        {sites.map(site => (
                            <option key={site.id} value={site.id}>{site.name} ({site.city})</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleDispatch}
                    disabled={!targetSiteId || selectedLeads.length === 0 || isSubmitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Dispatch...' : 'Dispatcher'}
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {leads.map((lead) => (
                        <li key={lead.id}>
                            <div className="flex items-center px-4 py-4 sm:px-6">
                                <div className="min-w-0 flex-1 flex items-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-4"
                                        checked={selectedLeads.includes(lead.id)}
                                        onChange={() => toggleLead(lead.id)}
                                    />
                                    <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-indigo-600 truncate">{lead.nom} {lead.prenom}</p>
                                            <p className="mt-2 flex items-center text-sm text-gray-500">
                                                <span className="truncate">{lead.email}</span>
                                            </p>
                                        </div>
                                        <div className="hidden md:block">
                                            <div className="text-sm text-gray-900">
                                                Origine: {lead.origin || lead.source || 'N/A'}
                                            </div>
                                            <div className="mt-2 text-sm text-gray-500">
                                                {lead.campaign?.name ? `Campagne: ${lead.campaign.name}` : 'Organique'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {lead.ville || 'Ville inconnue'} ({lead.codePostal})
                                    </span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

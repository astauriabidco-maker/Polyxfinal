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

    const selectAll = () => {
        if (selectedLeads.length === leads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
        }
    };

    if (leads.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-slate-400">Aucun nouveau lead à dispatcher.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between bg-slate-700/30 p-4 rounded-xl border border-slate-600/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={selectAll}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        {selectedLeads.length === leads.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                    <span className="font-medium text-slate-300">{selectedLeads.length} sélectionné(s)</span>
                    <select
                        className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
                >
                    {isSubmitting ? 'Dispatch...' : '🚀 Dispatcher'}
                </button>
            </div>

            {/* Leads List */}
            <div className="divide-y divide-slate-700/50">
                {leads.map((lead) => (
                    <div
                        key={lead.id}
                        onClick={() => toggleLead(lead.id)}
                        className={`flex items-center px-4 py-4 cursor-pointer transition-colors rounded-lg ${selectedLeads.includes(lead.id) ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-slate-700/30 border border-transparent'}`}
                    >
                        <input
                            type="checkbox"
                            className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-slate-600 rounded bg-slate-700 mr-4"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={() => toggleLead(lead.id)}
                        />
                        <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm font-medium text-white truncate">{lead.nom} {lead.prenom}</p>
                                <p className="mt-1 text-sm text-slate-400 truncate">{lead.email}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-300">{lead.origin || lead.source || 'N/A'}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    {lead.campaign?.name ? `Campagne: ${lead.campaign.name}` : 'Organique'}
                                </p>
                            </div>
                            <div className="flex items-center justify-end">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {lead.ville || 'Ville inconnue'} ({lead.codePostal})
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

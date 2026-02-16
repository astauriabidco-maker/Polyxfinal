'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerInteraction } from '@/app/actions/leads';
import { Lead } from '@prisma/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LeadInteractionPanelProps {
    lead: Lead;
    onInteractionComplete?: () => void;
}

export default function LeadInteractionPanel({ lead, onInteractionComplete }: LeadInteractionPanelProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notes, setNotes] = useState('');
    const [rdvDate, setRdvDate] = useState('');
    const [activeAction, setActiveAction] = useState<string | null>(null);

    const handleInteraction = async (type: 'CALL_NO_ANSWER' | 'CALL_INTERESTED' | 'CALL_NOT_INTERESTED' | 'BOOK_RDV') => {
        setIsSubmitting(true);
        try {
            const result = await registerInteraction({
                leadId: lead.id,
                type,
                details: {
                    notes,
                    dateRdv: type === 'BOOK_RDV' && rdvDate ? new Date(rdvDate).toISOString() : undefined
                }
            });

            if (result.success) {
                setNotes('');
                setActiveAction(null);
                router.refresh();
                if (onInteractionComplete) onInteractionComplete();
            } else {
                alert('Erreur: ' + result.error);
            }
        } catch (error) {
            console.error('Interaction error:', error);
            alert('Une erreur est survenue');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-medium text-white mb-4">
                🎯 Qualification: {lead.prenom} {lead.nom}
            </h3>

            <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-slate-400 mb-1">Notes d&apos;appel</label>
                <textarea
                    id="notes"
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Résumé de l'échange..."
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                    onClick={() => handleInteraction('CALL_NO_ANSWER')}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
                >
                    📞 Pas de réponse
                </button>
                <button
                    onClick={() => handleInteraction('CALL_NOT_INTERESTED')}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                >
                    ❌ Pas intéressé
                </button>
                <button
                    onClick={() => handleInteraction('CALL_INTERESTED')}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 hover:bg-amber-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                >
                    🤔 Intéressé (Rappel)
                </button>
                <button
                    onClick={() => setActiveAction('BOOK_RDV')}
                    disabled={isSubmitting}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium disabled:opacity-50 ${activeAction === 'BOOK_RDV' ? 'ring-2 ring-emerald-500' : ''}`}
                >
                    📅 Réserver RDV
                </button>
            </div>

            {activeAction === 'BOOK_RDV' && (
                <div className="mt-4 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                    <label htmlFor="rdv-date" className="block text-sm font-medium text-emerald-400 mb-2">Date et heure du RDV</label>
                    <div className="flex gap-2">
                        <input
                            type="datetime-local"
                            id="rdv-date"
                            className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            value={rdvDate}
                            onChange={(e) => setRdvDate(e.target.value)}
                        />
                        <button
                            onClick={() => handleInteraction('BOOK_RDV')}
                            disabled={!rdvDate || isSubmitting}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 transition-all text-sm"
                        >
                            Confirmer
                        </button>
                    </div>
                </div>
            )}

            {lead.dateRdv && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span><strong>RDV Programmé :</strong> {format(new Date(lead.dateRdv), 'PPP à p', { locale: fr })}</span>
                </div>
            )}
        </div>
    );
}

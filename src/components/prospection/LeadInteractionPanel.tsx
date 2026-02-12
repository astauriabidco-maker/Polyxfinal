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
    const [notes, setNotes] = useState(lead.notes || '');
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
                router.refresh();
                if (onInteractionComplete) onInteractionComplete();
                setActiveAction(null);
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
        <div className="bg-white shadow sm:rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                Qualification: {lead.prenom} {lead.nom}
            </h3>

            <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes d'appel</label>
                <textarea
                    id="notes"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Résumé de l'échange..."
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                    onClick={() => handleInteraction('CALL_NO_ANSWER')}
                    disabled={isSubmitting}
                    className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    📞 Pas de réponse
                </button>
                <button
                    onClick={() => handleInteraction('CALL_NOT_INTERESTED')}
                    disabled={isSubmitting}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    ❌ Pas intéressé
                </button>
                <button
                    onClick={() => handleInteraction('CALL_INTERESTED')}
                    disabled={isSubmitting}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                    🤔 Intéressé (Rappel)
                </button>
                <button
                    onClick={() => setActiveAction('BOOK_RDV')}
                    disabled={isSubmitting}
                    className={`inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${activeAction === 'BOOK_RDV' ? 'ring-2 ring-offset-2 ring-green-500' : ''}`}
                >
                    📅 Réserver RDV
                </button>
            </div>

            {activeAction === 'BOOK_RDV' && (
                <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200 animate-in fade-in slide-in-from-top-2">
                    <label htmlFor="rdv-date" className="block text-sm font-medium text-green-800">Date et heure du RDV</label>
                    <div className="mt-1 flex gap-2">
                        <input
                            type="datetime-local"
                            id="rdv-date"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                            value={rdvDate}
                            onChange={(e) => setRdvDate(e.target.value)}
                        />
                        <button
                            onClick={() => handleInteraction('BOOK_RDV')}
                            disabled={!rdvDate || isSubmitting}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            Confirmer
                        </button>
                    </div>
                </div>
            )}

            {lead.dateRdv && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
                    <strong>RDV Programmé :</strong> {format(new Date(lead.dateRdv), 'PPP à p', { locale: fr })}
                </div>
            )}
        </div>
    );
}

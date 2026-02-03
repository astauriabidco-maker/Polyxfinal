/**
 * TIMELINE TOGGLE - Client Component Wrapper
 * ===========================================
 * Bouton et wrapper pour afficher/masquer l'historique d'audit.
 */
'use client';

import { useState } from 'react';
import AuditTimeline from './AuditTimeline';

interface TimelineToggleProps {
    dossierId: string;
}

export default function TimelineToggle({ dossierId }: TimelineToggleProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-full">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 
                           text-xs font-medium transition-all duration-200
                           border-t border-slate-700/50
                           ${isOpen
                        ? 'bg-slate-800/50 text-slate-200'
                        : 'bg-slate-900/30 text-slate-400 hover:bg-slate-800/30 hover:text-slate-300'
                    }`}
            >
                <svg
                    width="14"
                    height="14"
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isOpen ? 'Masquer l\'historique' : 'Voir l\'historique'}
                <svg
                    width="12"
                    height="12"
                    className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Timeline Content */}
            <AuditTimeline dossierId={dossierId} isOpen={isOpen} />
        </div>
    );
}

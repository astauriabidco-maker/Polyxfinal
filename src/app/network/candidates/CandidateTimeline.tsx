'use client';

import { useState, useEffect } from 'react';

interface Activity {
    id: string;
    type: string;
    description: string;
    createdAt: string;
    metadata: any;
    performedBy: string | null;
}

interface Props {
    candidateId: string;
    isOpen: boolean;
}

function getActivityIcon(type: string): string {
    switch (type) {
        case 'STATUS_CHANGE': return '🔄';
        case 'QUALIFICATION_SCORE': return '📊';
        case 'EMAIL_SENT': return '📧';
        case 'NOTE_ADDED': return '📝';
        case 'DOCUMENT_UPLOADED': return '📄';
        case 'SYSTEM_ALERT': return '⚠️';
        default: return '📋';
    }
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return {
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    };
}

export default function CandidateTimeline({ candidateId, isOpen }: Props) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        fetch(`/api/network/candidates/${candidateId}/activities`)
            .then(res => res.json())
            .then(data => {
                setActivities(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [candidateId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="mt-4 pt-4 border-t border-slate-700/30 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Journal d'activité
            </div>

            {loading ? (
                <div className="flex justify-center py-4">
                    <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            ) : activities.length === 0 ? (
                <p className="text-xs text-slate-600 italic">Aucune activité enregistrée</p>
            ) : (
                <div className="space-y-3 relative">
                    <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-700/50" />

                    {activities.map(activity => {
                        const { time, date } = formatDate(activity.createdAt);
                        return (
                            <div key={activity.id} className="flex gap-3 relative z-10">
                                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] flex-shrink-0">
                                    {getActivityIcon(activity.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-300 leading-tight">
                                        {activity.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-500">{date} à {time}</span>
                                        {activity.performedBy && (
                                            <span className="text-[10px] text-blue-400/60 font-medium">Par Admin</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

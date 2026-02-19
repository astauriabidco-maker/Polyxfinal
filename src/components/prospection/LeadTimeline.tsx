'use client';

import { useEffect, useState } from 'react';
import { Clock, Phone, Send, Edit, RefreshCw, FileText, CheckCircle, Smartphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TimelineEvent {
    id: string;
    type: 'AUDIT' | 'CALL';
    action: string;
    date: string;
    user: string;
    details?: string;
    outcome?: string;
    duration?: number;
}

export default function LeadTimeline({ leadId }: { leadId: string }) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTimeline = async () => {
        try {
            const res = await fetch(`/api/leads/${leadId}/timeline`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (error) {
            console.error('Failed to fetch timeline', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeline();
        // Poll every 30s to keep updated (optional)
        const interval = setInterval(fetchTimeline, 30000);
        return () => clearInterval(interval);
    }, [leadId]);

    const getIcon = (type: string, action: string, outcome?: string) => {
        if (type === 'CALL') {
            if (outcome === 'INTERESSE') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            if (outcome === 'NRP') return <Smartphone className="w-4 h-4 text-orange-400" />;
            return <Phone className="w-4 h-4 text-blue-400" />;
        }
        switch (action) {
            case 'CREATE': return <FileText className="w-4 h-4 text-purple-400" />;
            case 'DISPATCH': return <Send className="w-4 h-4 text-cyan-400" />;
            case 'UPDATE': return <Edit className="w-4 h-4 text-amber-400" />;
            case 'STATUS_CHANGE': return <RefreshCw className="w-4 h-4 text-indigo-400" />;
            default: return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    if (loading) return <div className="p-4 text-slate-500 text-sm animate-pulse">Chargement de l'historique...</div>;

    if (events.length === 0) return <div className="p-4 text-slate-500 text-sm italic">Aucun événement enregistré.</div>;

    return (
        <div className="space-y-4 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Chronologie des actions</h3>
            <div className="relative border-l border-slate-700/50 ml-2 space-y-6">
                {events.map((event) => (
                    <div key={event.id} className="relative pl-6">
                        <div className="absolute -left-[9px] top-0 bg-slate-800 p-1 rounded-full border border-slate-700">
                            {getIcon(event.type, event.action, event.outcome)}
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-medium text-slate-200">
                                    {event.type === 'CALL' ? `Appel sortant (${event.outcome})` : event.action}
                                </span>
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                    {formatDistanceToNow(new Date(event.date), { addSuffix: true, locale: fr })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                <span className="text-slate-500 mr-1">Par {event.user}</span>
                            </p>
                            {event.details && (
                                <div className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-700/30 mt-1">
                                    {event.details}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

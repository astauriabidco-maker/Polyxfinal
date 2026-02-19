'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, CheckCheck, Clock, XCircle, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface LeadMessage {
    id: string;
    direction: 'OUTBOUND' | 'INBOUND';
    channel: 'WHATSAPP' | 'SMS';
    status: string;
    content: string;
    templateKey: string | null;
    createdAt: string;
    sentBy?: { nom: string; prenom: string } | null;
}

// ─── Status Indicator ────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'QUEUED': return <Clock size={10} className="text-slate-500" />;
        case 'SENT': return <Check size={10} className="text-slate-400" />;
        case 'DELIVERED': return <CheckCheck size={10} className="text-slate-400" />;
        case 'READ': return <CheckCheck size={10} className="text-blue-400" />;
        case 'FAILED': return <XCircle size={10} className="text-red-400" />;
        default: return null;
    }
}

// ─── Component ───────────────────────────────────────────────

interface Props {
    phone: string;       // Phone number to filter on
    leadId?: string;     // Optional lead ID
    maxMessages?: number;
}

export default function LeadMessageHistory({ phone, leadId, maxMessages = 20 }: Props) {
    const [messages, setMessages] = useState<LeadMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!phone) return;

        const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        const phoneDigits = normalizedPhone.startsWith('0')
            ? `33${normalizedPhone.slice(1)}`
            : normalizedPhone;

        const loadMessages = async () => {
            try {
                const res = await fetch(`/api/messaging/conversations/${phoneDigits}`);
                const data = await res.json();
                if (res.ok) {
                    setMessages(data.messages || []);
                }
            } catch {
                // silent
            } finally {
                setLoading(false);
            }
        };

        loadMessages();
    }, [phone, leadId]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-3 text-slate-500 text-xs">
                <Loader2 size={14} className="animate-spin" /> Chargement des messages...
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex items-center gap-2 py-3 text-slate-500 text-xs">
                <MessageSquare size={14} />
                Aucun message échangé
            </div>
        );
    }

    const displayedMessages = expanded ? messages : messages.slice(-maxMessages);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <MessageSquare size={12} />
                    Historique ({messages.length} message{messages.length > 1 ? 's' : ''})
                </span>
                {messages.length > maxMessages && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                        {expanded ? 'Voir moins' : `Voir tout (${messages.length})`}
                    </button>
                )}
            </div>

            {displayedMessages.map(msg => (
                <div
                    key={msg.id}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs ${msg.direction === 'OUTBOUND'
                            ? 'bg-green-500/5 border-l-2 border-green-500/30'
                            : 'bg-blue-500/5 border-l-2 border-blue-500/30'
                        }`}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {msg.direction === 'OUTBOUND' ? (
                            <span className="text-green-400">→</span>
                        ) : (
                            <span className="text-blue-400">←</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-300 line-clamp-2">{msg.content}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span>
                                {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                            {msg.direction === 'OUTBOUND' && <StatusIcon status={msg.status} />}
                            {msg.sentBy && (
                                <span className="text-slate-600">par {msg.sentBy.prenom}</span>
                            )}
                            {msg.templateKey && (
                                <span className="text-amber-500/60">📋 {msg.templateKey}</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

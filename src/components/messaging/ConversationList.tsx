'use client';

import { Loader2 } from 'lucide-react';
import type { Conversation } from './InboxClient';

// ─── Status Indicators ──────────────────────────────────────

const LEAD_STATUS_COLORS: Record<string, string> = {
    NEW: 'bg-blue-500',
    CONTACTED: 'bg-yellow-500',
    QUALIFIED: 'bg-purple-500',
    RDV_PRIS: 'bg-green-500',
    CONVERTED: 'bg-emerald-500',
    LOST: 'bg-red-500',
};

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) {
        const mins = Math.floor(diff / (1000 * 60));
        return mins <= 0 ? 'À l\'instant' : `${mins}min`;
    }
    if (hours < 24) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (hours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatPhone(phone: string): string {
    if (phone.startsWith('33') && phone.length === 11) {
        return `0${phone.slice(2)}`.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
    return `+${phone}`;
}

// ─── Component ───────────────────────────────────────────────

interface Props {
    conversations: Conversation[];
    selectedPhone: string | null;
    loading: boolean;
    onSelect: (phone: string) => void;
}

export default function ConversationList({ conversations, selectedPhone, loading, onSelect }: Props) {
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-500" size={24} />
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center text-slate-500">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-sm font-medium">Aucune conversation</p>
                    <p className="text-xs mt-1">Les messages envoyés depuis<br />le CallCockpit apparaîtront ici.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => {
                const isSelected = selectedPhone === conv.phone;
                const hasUnread = conv.unreadCount > 0;
                const statusColor = conv.leadStatus ? LEAD_STATUS_COLORS[conv.leadStatus] : null;

                return (
                    <button
                        key={conv.phone}
                        onClick={() => onSelect(conv.phone)}
                        className={`w-full flex items-start gap-3 p-3 text-left transition-colors border-b border-slate-800/50 ${isSelected
                                ? 'bg-green-600/10 border-l-2 border-l-green-500'
                                : 'hover:bg-slate-800/50 border-l-2 border-l-transparent'
                            }`}
                    >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${hasUnread ? 'bg-green-600/20 text-green-400' : 'bg-slate-700/50 text-slate-400'
                                }`}>
                                {conv.contactName
                                    ? conv.contactName.charAt(0).toUpperCase()
                                    : '📱'}
                            </div>
                            {statusColor && (
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} rounded-full border-2 border-slate-900`} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className={`text-sm truncate ${hasUnread ? 'font-bold text-white' : 'font-medium text-slate-300'
                                    }`}>
                                    {conv.contactName || formatPhone(conv.phone)}
                                </span>
                                <span className={`text-[11px] flex-shrink-0 ml-2 ${hasUnread ? 'text-green-400 font-medium' : 'text-slate-500'
                                    }`}>
                                    {formatTime(conv.lastMessageAt)}
                                </span>
                            </div>

                            {conv.contactName && (
                                <p className="text-[11px] text-slate-500 mb-0.5">{formatPhone(conv.phone)}</p>
                            )}

                            <div className="flex items-center justify-between">
                                <p className={`text-xs truncate ${hasUnread ? 'text-slate-300' : 'text-slate-500'
                                    }`}>
                                    {conv.lastDirection === 'OUTBOUND' && (
                                        <span className="mr-1">
                                            {conv.lastStatus === 'READ' ? '✓✓' :
                                                conv.lastStatus === 'DELIVERED' ? '✓✓' :
                                                    conv.lastStatus === 'SENT' ? '✓' : '⏳'}
                                        </span>
                                    )}
                                    {conv.lastMessage || '...'}
                                </p>

                                {hasUnread && (
                                    <span className="flex-shrink-0 ml-2 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                    </span>
                                )}
                            </div>

                            {conv.formation && (
                                <p className="text-[10px] text-cyan-500/60 mt-0.5 truncate">{conv.formation}</p>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

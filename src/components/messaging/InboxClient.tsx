'use client';

import { useState, useEffect, useCallback } from 'react';
import ConversationList from './ConversationList';
import ChatThread from './ChatThread';

// ─── Types ────────────────────────────────────────────────────

export interface Conversation {
    phone: string;
    leadId: string | null;
    contactName: string | null;
    contactEmail: string | null;
    leadStatus: string | null;
    formation: string | null;
    lastMessage: string | null;
    lastDirection: 'OUTBOUND' | 'INBOUND';
    lastStatus: string | null;
    lastMessageAt: string;
    totalMessages: number;
    unreadCount: number;
}

// ─── Component ───────────────────────────────────────────────

export default function InboxClient() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalUnread, setTotalUnread] = useState(0);

    const loadConversations = useCallback(async () => {
        try {
            const res = await fetch(`/api/messaging/conversations?search=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (res.ok) {
                setConversations(data.conversations || []);
                setTotalUnread(data.totalUnread || 0);
            }
        } catch (err) {
            console.error('Failed to load conversations:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        loadConversations();
        // Poll every 15 seconds for new messages
        const interval = setInterval(loadConversations, 15000);
        return () => clearInterval(interval);
    }, [loadConversations]);

    const handleSelectConversation = async (phone: string) => {
        setSelectedPhone(phone);

        // Mark messages as read
        try {
            await fetch(`/api/messaging/conversations/${phone}/read`, { method: 'PUT' });
            setConversations(prev =>
                prev.map(c => c.phone === phone ? { ...c, unreadCount: 0 } : c)
            );
        } catch {
            // silent
        }
    };

    const handleMessageSent = () => {
        // Refresh conversations list after sending
        loadConversations();
    };

    const selectedConversation = conversations.find(c => c.phone === selectedPhone);

    return (
        <div className="flex h-full bg-slate-950">
            {/* Left Panel — Conversation List */}
            <div className={`${selectedPhone ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-slate-700/50 bg-slate-900`}>
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-white">💬 Messagerie</h1>
                            {totalUnread > 0 && (
                                <span className="px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded-full animate-pulse">
                                    {totalUnread}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Rechercher un contact..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500/50"
                        />
                    </div>
                </div>

                {/* Conversation List */}
                <ConversationList
                    conversations={conversations}
                    selectedPhone={selectedPhone}
                    loading={loading}
                    onSelect={handleSelectConversation}
                />
            </div>

            {/* Right Panel — Chat Thread */}
            <div className={`${selectedPhone ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
                {selectedPhone && selectedConversation ? (
                    <ChatThread
                        phone={selectedPhone}
                        conversation={selectedConversation}
                        onBack={() => setSelectedPhone(null)}
                        onMessageSent={handleMessageSent}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-6xl mb-4">💬</div>
                            <h2 className="text-xl font-semibold text-white mb-2">Messagerie WhatsApp</h2>
                            <p className="text-sm text-slate-400">
                                Sélectionnez une conversation pour commencer
                            </p>
                            {conversations.length === 0 && !loading && (
                                <p className="text-xs text-slate-500 mt-4">
                                    Aucune conversation pour le moment.<br />
                                    Les messages envoyés depuis le CallCockpit apparaîtront ici.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

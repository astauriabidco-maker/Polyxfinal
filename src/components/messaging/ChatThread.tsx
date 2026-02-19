'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Loader2, Check, CheckCheck, Clock, XCircle, Paperclip, FileText, X, Image as ImageIcon } from 'lucide-react';
import type { Conversation } from './InboxClient';

// ─── Types ────────────────────────────────────────────────────

interface ChatMessage {
    id: string;
    direction: 'OUTBOUND' | 'INBOUND';
    channel: 'WHATSAPP' | 'SMS';
    status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    content: string;
    templateKey: string | null;
    mediaUrl: string | null;
    mediaType: string | null;
    createdAt: string;
    sentBy?: { id: string; nom: string; prenom: string } | null;
    lead?: { id: string; nom: string; prenom: string; status: string } | null;
}

// ─── Status Icons ────────────────────────────────────────────

function DeliveryStatus({ status }: { status: string }) {
    switch (status) {
        case 'QUEUED': return <Clock size={12} className="text-slate-500" />;
        case 'SENT': return <Check size={12} className="text-slate-400" />;
        case 'DELIVERED': return <CheckCheck size={12} className="text-slate-400" />;
        case 'READ': return <CheckCheck size={12} className="text-blue-400" />;
        case 'FAILED': return <XCircle size={12} className="text-red-400" />;
        default: return null;
    }
}

function formatMessageTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Quick Templates ─────────────────────────────────────────

const QUICK_TEMPLATES = [
    { label: '👋 Bonjour', text: 'Bonjour, comment puis-je vous aider ?' },
    { label: '📅 RDV', text: 'Je vous propose un rendez-vous pour discuter de votre projet de formation. Quand êtes-vous disponible ?' },
    { label: '📞 Rappel', text: "J'ai tenté de vous joindre. Quand puis-je vous rappeler ?" },
    { label: '✅ Merci', text: 'Merci pour votre retour. Je reste à votre disposition.' },
];

// ─── Component ───────────────────────────────────────────────

interface Props {
    phone: string;
    conversation: Conversation;
    onBack: () => void;
    onMessageSent: () => void;
}

export default function ChatThread({ phone, conversation, onBack, onMessageSent }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Load Messages ───────────────────────────────────────

    const loadMessages = useCallback(async () => {
        try {
            const res = await fetch(`/api/messaging/conversations/${phone}`);
            const data = await res.json();
            if (res.ok) {
                setMessages(data.messages || []);
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setLoading(false);
        }
    }, [phone]);

    useEffect(() => {
        setLoading(true);
        loadMessages();
        const interval = setInterval(loadMessages, 10000);
        return () => clearInterval(interval);
    }, [loadMessages]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Send Message ────────────────────────────────────────

    const sendMessage = async (text?: string) => {
        const messageText = text || inputText.trim();
        if (!messageText || sending) return;

        setSending(true);
        setInputText('');
        setShowTemplates(false);

        // Optimistic update
        const optimisticMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            direction: 'OUTBOUND',
            channel: 'WHATSAPP',
            status: 'QUEUED',
            content: messageText,
            templateKey: null,
            mediaUrl: null,
            mediaType: null,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const res = await fetch(`/api/messaging/conversations/${phone}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: messageText,
                    channel: 'whatsapp',
                    leadId: conversation.leadId,
                }),
            });

            const data = await res.json();

            // Replace optimistic with real
            setMessages(prev =>
                prev.map(m =>
                    m.id === optimisticMsg.id
                        ? { ...m, id: data.dbMessageId || m.id, status: data.success ? 'SENT' : 'FAILED' }
                        : m
                )
            );

            onMessageSent();
        } catch {
            setMessages(prev =>
                prev.map(m =>
                    m.id === optimisticMsg.id ? { ...m, status: 'FAILED' } : m
                )
            );
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    // ─── Send File ───────────────────────────────────────────

    const sendFile = async () => {
        if (!attachedFile || uploadProgress) return;
        setUploadProgress(true);

        // Optimistic update
        const optimisticMsg: ChatMessage = {
            id: `temp-file-${Date.now()}`,
            direction: 'OUTBOUND',
            channel: 'WHATSAPP',
            status: 'QUEUED',
            content: inputText.trim() || `[${attachedFile.type.startsWith('image/') ? 'Image' : 'Document'}: ${attachedFile.name}]`,
            templateKey: null,
            mediaUrl: filePreviewUrl,
            mediaType: attachedFile.type,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const formData = new FormData();
            formData.append('file', attachedFile);
            formData.append('phone', phone);
            if (inputText.trim()) formData.append('caption', inputText.trim());
            if (conversation.leadId) formData.append('leadId', conversation.leadId);

            const res = await fetch('/api/messaging/media/send', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            setMessages(prev =>
                prev.map(m =>
                    m.id === optimisticMsg.id
                        ? { ...m, status: data.success ? 'SENT' : 'FAILED', mediaUrl: data.localUrl || m.mediaUrl }
                        : m
                )
            );

            onMessageSent();
        } catch {
            setMessages(prev =>
                prev.map(m =>
                    m.id === optimisticMsg.id ? { ...m, status: 'FAILED' } : m
                )
            );
        } finally {
            setUploadProgress(false);
            clearAttachment();
            inputRef.current?.focus();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate size (16MB)
        if (file.size > 16 * 1024 * 1024) {
            alert('Fichier trop volumineux (max 16 MB)');
            return;
        }

        setAttachedFile(file);
        if (file.type.startsWith('image/')) {
            setFilePreviewUrl(URL.createObjectURL(file));
        } else {
            setFilePreviewUrl(null);
        }
    };

    const clearAttachment = () => {
        setAttachedFile(null);
        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
        setFilePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ─── Group messages by date ──────────────────────────────

    const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
        const msgDate = new Date(msg.createdAt).toDateString();
        if (msgDate !== currentDate) {
            currentDate = msgDate;
            groupedMessages.push({ date: msg.createdAt, messages: [msg] });
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(msg);
        }
    }

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur">
                <button
                    onClick={onBack}
                    className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>

                <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center text-green-400 font-bold">
                    {conversation.contactName?.charAt(0).toUpperCase() || '📱'}
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-white truncate">
                        {conversation.contactName || `+${phone}`}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>+{phone}</span>
                        {conversation.leadStatus && (
                            <>
                                <span>•</span>
                                <span className="text-cyan-400">{conversation.leadStatus}</span>
                            </>
                        )}
                        {conversation.formation && (
                            <>
                                <span>•</span>
                                <span className="truncate">{conversation.formation}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '24px 24px' }}>

                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-slate-500" size={24} />
                    </div>
                )}

                {!loading && messages.length === 0 && (
                    <div className="flex justify-center py-12">
                        <p className="text-sm text-slate-500">Début de la conversation</p>
                    </div>
                )}

                {groupedMessages.map((group, gi) => (
                    <div key={gi}>
                        {/* Date Separator */}
                        <div className="flex justify-center my-3">
                            <span className="px-3 py-1 bg-slate-800/80 text-slate-400 text-[11px] rounded-full">
                                {formatDateSeparator(group.date)}
                            </span>
                        </div>

                        {/* Messages */}
                        {group.messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex mb-1 ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`relative max-w-[75%] px-3 py-2 rounded-2xl ${msg.direction === 'OUTBOUND'
                                    ? 'bg-green-800/40 border border-green-700/30 rounded-br-md'
                                    : 'bg-slate-800 border border-slate-700/50 rounded-bl-md'
                                    }`}>
                                    {/* Sender name for outbound */}
                                    {msg.direction === 'OUTBOUND' && msg.sentBy && (
                                        <p className="text-[10px] text-green-400/60 font-medium mb-0.5">
                                            {msg.sentBy.prenom} {msg.sentBy.nom}
                                        </p>
                                    )}

                                    {/* Template badge */}
                                    {msg.templateKey && (
                                        <span className="inline-block mb-1 px-1.5 py-0.5 text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded">
                                            📋 {msg.templateKey}
                                        </span>
                                    )}

                                    {/* Media Display */}
                                    {msg.mediaUrl && msg.mediaType?.startsWith('image/') && (
                                        <div className="mb-1.5 rounded-lg overflow-hidden">
                                            <img
                                                src={msg.mediaUrl}
                                                alt="Image"
                                                className="max-w-full max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                            />
                                        </div>
                                    )}
                                    {msg.mediaUrl && msg.mediaType && !msg.mediaType.startsWith('image/') && (
                                        <a
                                            href={msg.mediaUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 mb-1.5 p-2 bg-slate-900/50 border border-slate-600/30 rounded-lg hover:bg-slate-900/80 transition-colors"
                                        >
                                            <FileText size={20} className="text-red-400 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-slate-300 truncate">{msg.content.replace(/^\[.*?: /, '').replace(/\]$/, '') || 'Document'}</p>
                                                <p className="text-[10px] text-slate-500">{msg.mediaType}</p>
                                            </div>
                                        </a>
                                    )}

                                    {/* Content */}
                                    {(!msg.mediaUrl || (msg.content && !msg.content.startsWith('['))) && (
                                        <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                                            {msg.content}
                                        </p>
                                    )}

                                    {/* Time + Status */}
                                    <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'
                                        }`}>
                                        <span className="text-[10px] text-slate-500">
                                            {formatMessageTime(msg.createdAt)}
                                        </span>
                                        {msg.direction === 'OUTBOUND' && (
                                            <DeliveryStatus status={msg.status} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates Bar */}
            {showTemplates && (
                <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/80 flex gap-2 overflow-x-auto">
                    {QUICK_TEMPLATES.map((t, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(t.text)}
                            className="flex-shrink-0 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Attached File Preview */}
            {attachedFile && (
                <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/80">
                    <div className="flex items-center gap-3 p-2 bg-slate-800/80 rounded-lg">
                        {filePreviewUrl ? (
                            <img src={filePreviewUrl} alt="Preview" className="w-12 h-12 object-cover rounded" />
                        ) : (
                            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded flex items-center justify-center">
                                <FileText size={20} className="text-red-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{attachedFile.name}</p>
                            <p className="text-[10px] text-slate-500">{(attachedFile.size / 1024).toFixed(0)} Ko • {attachedFile.type}</p>
                        </div>
                        <button onClick={clearAttachment} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-900/80">
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,video/mp4,audio/mpeg,audio/ogg"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                <div className="flex items-end gap-2">
                    {/* Attachment Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploadProgress}
                        className="p-2.5 rounded-full transition-colors flex-shrink-0 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                        title="Joindre un fichier"
                    >
                        <Paperclip size={18} />
                    </button>

                    {/* Template Toggle */}
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${showTemplates
                            ? 'bg-green-600/20 text-green-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        title="Templates rapides"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h7" />
                        </svg>
                    </button>

                    {/* Text Input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={attachedFile ? 'Ajouter une légende...' : 'Écrire un message...'}
                            rows={1}
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500/50 resize-none max-h-32"
                            style={{ minHeight: '42px' }}
                        />
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={() => attachedFile ? sendFile() : sendMessage()}
                        disabled={(!inputText.trim() && !attachedFile) || sending || uploadProgress}
                        className="p-2.5 bg-green-600 hover:bg-green-500 text-white rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-green-600 flex-shrink-0"
                    >
                        {sending || uploadProgress
                            ? <Loader2 size={18} className="animate-spin" />
                            : attachedFile
                                ? <ImageIcon size={18} />
                                : <Send size={18} />
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

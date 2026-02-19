'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Phone, Clock, Save, X, MessageCircle, MessageSquare, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MESSAGE_TEMPLATES, getTemplate } from './MessageTemplates';

interface PrequalScript {
    id: string;
    question: string;
    ordre: number;
}

interface Props {
    leadId: string;
    phone: string | null;
    leadName: string; // Used for templates
    scripts: PrequalScript[];
    onClose: () => void;
    onStatusChange: () => void; // Refresh parent
}

export default function CallCockpit({ leadId, phone, leadName, scripts, onClose, onStatusChange }: Props) {
    const router = useRouter();
    const [isCalling, setIsCalling] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
    const [checkedQuestions, setCheckedQuestions] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    // Callback & RDV States
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [nextCallDate, setNextCallDate] = useState('');
    const [showRdvPicker, setShowRdvPicker] = useState(false);
    const [rdvDate, setRdvDate] = useState('');

    // Messaging state
    const [sendingMsg, setSendingMsg] = useState<string | null>(null); // templateKey being sent
    const [msgResult, setMsgResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Timer logic
    useEffect(() => {
        if (isCalling) {
            const int = setInterval(() => setElapsed(prev => prev + 1), 1000);
            setTimerInterval(int);
        } else {
            if (timerInterval) clearInterval(timerInterval);
        }
        return () => { if (timerInterval) clearInterval(timerInterval); };
    }, [isCalling]);

    // Auto-clear message result
    useEffect(() => {
        if (msgResult) {
            const timeout = setTimeout(() => setMsgResult(null), 4000);
            return () => clearTimeout(timeout);
        }
    }, [msgResult]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    /**
     * Send WhatsApp via API, falls back to wa.me if messaging not configured
     */
    const sendWhatsApp = async (type: keyof typeof MESSAGE_TEMPLATES, date?: string) => {
        if (!phone) return;

        setSendingMsg(type);
        setMsgResult(null);

        try {
            const res = await fetch('/api/messaging/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: phone,
                    templateKey: type,
                    params: { name: leadName, ...(date && { date }) },
                    channel: 'whatsapp',
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMsgResult({ type: 'success', text: '✅ WhatsApp envoyé' });
            } else {
                // Fallback to wa.me link if messaging not configured
                openWhatsAppFallback(type, date);
                setMsgResult({ type: 'success', text: '↗ Ouvert dans WhatsApp Web' });
            }
        } catch {
            // Network error → fallback
            openWhatsAppFallback(type, date);
            setMsgResult({ type: 'success', text: '↗ Ouvert dans WhatsApp Web' });
        } finally {
            setSendingMsg(null);
        }
    };

    /**
     * Fallback: open wa.me link (original behavior)
     */
    const openWhatsAppFallback = (type: keyof typeof MESSAGE_TEMPLATES, date?: string) => {
        if (!phone) return;
        const text = getTemplate(type, { name: leadName, date });
        const url = `https://wa.me/${phone.replace(/^0/, '33').replace(/\s/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const openSMS = (type: keyof typeof MESSAGE_TEMPLATES, date?: string) => {
        if (!phone) return;
        const text = getTemplate(type, { name: leadName, date });
        const url = `sms:${phone}?body=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const startCall = () => {
        if (!phone) return;
        window.location.href = `tel:${phone}`;
        setIsCalling(true);
        setElapsed(0);
    };

    const endCall = async (outcome: 'INTERESSE' | 'A_RAPPELER' | 'NRP' | 'PAS_INTERESSE' | 'RDV') => {
        setIsCalling(false);
        if (timerInterval) clearInterval(timerInterval);

        if (outcome === 'A_RAPPELER' && !nextCallDate && !showDatePicker && !showRdvPicker) {
            setShowDatePicker(true);
            return;
        }

        if (outcome === 'RDV' && !rdvDate && !showRdvPicker && !showDatePicker) {
            setShowRdvPicker(true);
            return;
        }

        const apiOutcome = outcome === 'RDV' ? 'INTERESSE' : outcome;

        try {
            const res = await fetch('/api/leads/call-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId,
                    outcome: apiOutcome,
                    duration: elapsed,
                    notes,
                    questionsAsked: checkedQuestions,
                    nextCallDate: outcome === 'A_RAPPELER' ? nextCallDate : null,
                    rdvDate: outcome === 'RDV' ? rdvDate : null
                }),
            });

            if (res.ok) {
                onStatusChange();
                onClose();
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4 mb-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isCalling ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                        <Phone size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Cockpit d&apos;appel</h3>
                        <p className="text-xs text-slate-400">{isCalling ? 'Appel en cours...' : 'Prêt à appeler'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Message Result Toast */}
                    {msgResult && (
                        <span className={`text-xs px-2 py-1 rounded-full animate-in fade-in ${msgResult.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                            {msgResult.text}
                        </span>
                    )}

                    {/* Quick Messages */}
                    <div className="flex gap-2 mr-2">
                        <button
                            onClick={() => sendWhatsApp('NO_ANSWER')}
                            disabled={!phone || sendingMsg === 'NO_ANSWER'}
                            className="bg-green-600/20 hover:bg-green-600/40 text-green-400 p-2 rounded-full transition-colors disabled:opacity-50"
                            title="WhatsApp (Relance)"
                        >
                            {sendingMsg === 'NO_ANSWER' ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                        </button>
                        <button
                            onClick={() => openSMS('NO_ANSWER')}
                            disabled={!phone}
                            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 p-2 rounded-full transition-colors disabled:opacity-50"
                            title="SMS (Relance)"
                        >
                            <MessageSquare size={18} />
                        </button>
                    </div>

                    <div className="text-2xl font-mono text-cyan-400 font-bold w-16 text-center">
                        {formatTime(elapsed)}
                    </div>
                    {!isCalling ? (
                        <button onClick={startCall} disabled={!phone}
                            className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Play size={20} fill="currentColor" />
                        </button>
                    ) : (
                        <button onClick={() => setIsCalling(false)} className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-full transition-colors">
                            <Square size={20} fill="currentColor" />
                        </button>
                    )}
                </div>
            </div>

            {/* Script */}
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Script de qualification</h4>
                {scripts.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Aucun script configuré.</p>
                ) : (
                    scripts.map(s => (
                        <label key={s.id} className="flex items-start gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={checkedQuestions.includes(s.id)}
                                onChange={(e) => {
                                    if (e.target.checked) setCheckedQuestions([...checkedQuestions, s.id]);
                                    else setCheckedQuestions(checkedQuestions.filter(id => id !== s.id));
                                }}
                                className="mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-offset-slate-900 focus:ring-cyan-500"
                            />
                            <span className={`text-sm transition-colors ${checkedQuestions.includes(s.id) ? 'text-slate-500 line-through' : 'text-slate-300 group-hover:text-white'}`}>
                                {s.question}
                            </span>
                        </label>
                    ))
                )}
            </div>

            {/* Notes */}
            <div className="mb-4">
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes rapides pendant l'appel..."
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-600 resize-none h-20"
                />
            </div>

            {/* Rappel Picker */}
            {showDatePicker && (
                <div className="mb-4 bg-slate-700/50 p-3 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Date et heure du rappel</label>
                    <div className="flex gap-2">
                        <input
                            type="datetime-local"
                            value={nextCallDate}
                            onChange={(e) => setNextCallDate(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg block w-full p-2.5"
                        />
                        <button onClick={() => endCall('A_RAPPELER')} disabled={!nextCallDate} className="px-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">OK</button>
                        <button
                            onClick={() => sendWhatsApp('NO_ANSWER')}
                            disabled={sendingMsg === 'NO_ANSWER'}
                            className="px-3 bg-green-600/20 text-green-400 border border-green-600/40 rounded-lg hover:bg-green-600/30"
                            title="Envoyer message WhatsApp"
                        >
                            {sendingMsg === 'NO_ANSWER' ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                        </button>
                        <button onClick={() => setShowDatePicker(false)} className="px-3 bg-slate-600 text-white rounded-lg"><X size={16} /></button>
                    </div>
                </div>
            )}

            {/* RDV Picker */}
            {showRdvPicker && (
                <div className="mb-4 bg-purple-900/30 p-3 rounded-lg border border-purple-500/50 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-medium text-purple-300 mb-1">📅 Confirmer le Rendez-vous</label>
                    <div className="flex gap-2">
                        <input
                            type="datetime-local"
                            value={rdvDate}
                            onChange={(e) => setRdvDate(e.target.value)}
                            className="bg-slate-800 border border-purple-500/50 text-white text-sm rounded-lg block w-full p-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <button onClick={() => endCall('RDV')} disabled={!rdvDate} className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 transition-colors">Confirmer</button>
                        <button
                            onClick={() => sendWhatsApp('RDV_CONFIRMATION', new Date(rdvDate).toLocaleString())}
                            disabled={!rdvDate || sendingMsg === 'RDV_CONFIRMATION'}
                            className="px-3 bg-green-600/20 text-green-400 border border-green-600/40 rounded-lg hover:bg-green-600/30 disabled:opacity-30"
                            title="Envoyer confirmation WhatsApp"
                        >
                            {sendingMsg === 'RDV_CONFIRMATION' ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                        </button>
                        <button onClick={() => setShowRdvPicker(false)} className="px-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"><X size={16} /></button>
                    </div>
                </div>
            )}

            {/* Actions Buttons */}
            {!showDatePicker && !showRdvPicker && (
                <div className="space-y-2">
                    {/* RDV Button */}
                    <button
                        onClick={() => endCall('RDV')}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] font-semibold"
                    >
                        <Clock size={18} />
                        Prise de RDV
                    </button>

                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={() => endCall('INTERESSE')} className="flex flex-col items-center justify-center p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors group">
                            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">✅</span>
                            <span className="text-[10px] font-medium text-emerald-400">Intéressé</span>
                        </button>
                        <button onClick={() => endCall('A_RAPPELER')} className="flex flex-col items-center justify-center p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors group">
                            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">📅</span>
                            <span className="text-[10px] font-medium text-blue-400">Rappel</span>
                        </button>
                        <button onClick={() => endCall('NRP')} className="flex flex-col items-center justify-center p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors group">
                            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">📵</span>
                            <span className="text-[10px] font-medium text-amber-400">NRP</span>
                        </button>
                        <button onClick={() => endCall('PAS_INTERESSE')} className="flex flex-col items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors group">
                            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">❌</span>
                            <span className="text-[10px] font-medium text-red-400">Stop</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

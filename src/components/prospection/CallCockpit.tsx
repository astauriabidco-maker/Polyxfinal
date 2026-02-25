'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Phone, Clock, X, MessageCircle, MessageSquare, Loader2, ChevronRight, RotateCcw, Star, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MESSAGE_TEMPLATES, getTemplate } from './MessageTemplates';

// ─── Types ────────────────────────────────────────────────────

interface PrequalScript {
    id: string;
    question: string;
    ordre: number;
}

interface ScriptNodeOption {
    value: string;
    label: string;
    nextNodeId: string | null;
    scoreImpact: number;
}

interface ScriptNode {
    id: string;
    question: string;
    helpText: string | null;
    type: 'YES_NO' | 'CHOICE' | 'OPEN_TEXT' | 'RATING' | 'INFO';
    ordre: number;
    isRequired: boolean;
    scoreWeight: number;
    options: ScriptNodeOption[] | null;
}

interface ExecutionState {
    executionId: string;
    scriptName: string;
    currentNode: ScriptNode | null;
    answeredCount: number;
    totalScore: number;
    maxPossibleScore: number;
    isComplete: boolean;
    recommendation: string | null;
    recommendedAction: string | null;
    triggeredActions: any[];
    history: { nodeId: string; question: string; answer: string; scoreEarned: number }[];
}

interface Props {
    leadId: string;
    phone: string | null;
    leadName: string;
    scripts: PrequalScript[]; // Legacy scripts (backward compat)
    onClose: () => void;
    onStatusChange: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function CallCockpit({ leadId, phone, leadName, scripts, onClose, onStatusChange }: Props) {
    const router = useRouter();
    const [isCalling, setIsCalling] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
    const [notes, setNotes] = useState('');

    // Script engine state
    const [scriptState, setScriptState] = useState<ExecutionState | null>(null);
    const [scriptLoading, setScriptLoading] = useState(false);
    const [openTextAnswer, setOpenTextAnswer] = useState('');
    const [ratingValue, setRatingValue] = useState(0);

    // Callback & RDV States
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [nextCallDate, setNextCallDate] = useState('');
    const [showRdvPicker, setShowRdvPicker] = useState(false);
    const [rdvDate, setRdvDate] = useState('');

    // Messaging state
    const [sendingMsg, setSendingMsg] = useState<string | null>(null);
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

    // Load script on mount
    useEffect(() => {
        loadScript();
    }, [leadId]);

    const loadScript = async () => {
        setScriptLoading(true);
        try {
            const res = await fetch('/api/leads/script-execution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', leadId }),
            });
            const data = await res.json();
            if (data.success) {
                setScriptState(data.state);
            }
        } catch (err) {
            console.error('[CallCockpit] Failed to load script:', err);
        } finally {
            setScriptLoading(false);
        }
    };

    const submitAnswer = async (answer: string) => {
        if (!scriptState?.currentNode || !scriptState.executionId) return;
        setScriptLoading(true);
        try {
            const res = await fetch('/api/leads/script-execution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'answer',
                    executionId: scriptState.executionId,
                    nodeId: scriptState.currentNode.id,
                    answer,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setScriptState(data.state);
                setOpenTextAnswer('');
                setRatingValue(0);
            }
        } catch (err) {
            console.error('[CallCockpit] Failed to submit answer:', err);
        } finally {
            setScriptLoading(false);
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const sendWhatsApp = async (type: keyof typeof MESSAGE_TEMPLATES, date?: string) => {
        if (!phone) return;
        setSendingMsg(type);
        setMsgResult(null);
        try {
            const res = await fetch('/api/messaging/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: phone, templateKey: type, params: { name: leadName, ...(date && { date }) }, channel: 'whatsapp' }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setMsgResult({ type: 'success', text: '✅ WhatsApp envoyé' });
            } else {
                openWhatsAppFallback(type, date);
                setMsgResult({ type: 'success', text: '↗ Ouvert dans WhatsApp Web' });
            }
        } catch {
            openWhatsAppFallback(type, date);
            setMsgResult({ type: 'success', text: '↗ Ouvert dans WhatsApp Web' });
        } finally {
            setSendingMsg(null);
        }
    };

    const openWhatsAppFallback = (type: keyof typeof MESSAGE_TEMPLATES, date?: string) => {
        if (!phone) return;
        const text = getTemplate(type, { name: leadName, date });
        const url = `https://wa.me/${phone.replace(/^0/, '33').replace(/\s/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const openSMS = (type: keyof typeof MESSAGE_TEMPLATES, date?: string) => {
        if (!phone) return;
        const text = getTemplate(type, { name: leadName, date });
        window.open(`sms:${phone}?body=${encodeURIComponent(text)}`, '_blank');
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
                    questionsAsked: scriptState?.history.map(h => h.nodeId) || [],
                    nextCallDate: outcome === 'A_RAPPELER' ? nextCallDate : null,
                    rdvDate: outcome === 'RDV' ? rdvDate : null,
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

    // ─── Score Progress ───────────────────────────────────────
    const scorePercent = scriptState
        ? scriptState.maxPossibleScore > 0
            ? Math.round((scriptState.totalScore / scriptState.maxPossibleScore) * 100)
            : 0
        : 0;

    const scoreColor = scorePercent >= 75 ? 'text-emerald-400' : scorePercent >= 50 ? 'text-yellow-400' : scorePercent >= 25 ? 'text-orange-400' : 'text-red-400';
    const scoreBg = scorePercent >= 75 ? 'bg-emerald-500' : scorePercent >= 50 ? 'bg-yellow-500' : scorePercent >= 25 ? 'bg-orange-500' : 'bg-red-500';

    // ─── Render ───────────────────────────────────────────────
    return (
        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4 mb-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isCalling ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                        <Phone size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white text-sm">Cockpit d&apos;appel</h3>
                        <p className="text-[10px] text-slate-400">{isCalling ? 'Appel en cours...' : 'Prêt à appeler'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Message Result Toast */}
                    {msgResult && (
                        <span className={`text-xs px-2 py-0.5 rounded-full animate-in fade-in ${msgResult.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {msgResult.text}
                        </span>
                    )}
                    {/* Quick Messages */}
                    <div className="flex gap-1">
                        <button onClick={() => sendWhatsApp('NO_ANSWER')} disabled={!phone || sendingMsg === 'NO_ANSWER'}
                            className="bg-green-600/20 hover:bg-green-600/40 text-green-400 p-1.5 rounded-full transition-colors disabled:opacity-50" title="WhatsApp">
                            {sendingMsg === 'NO_ANSWER' ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                        </button>
                        <button onClick={() => openSMS('NO_ANSWER')} disabled={!phone}
                            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 p-1.5 rounded-full transition-colors disabled:opacity-50" title="SMS">
                            <MessageSquare size={14} />
                        </button>
                    </div>
                    <div className="text-xl font-mono text-cyan-400 font-bold w-14 text-center">{formatTime(elapsed)}</div>
                    {!isCalling ? (
                        <button onClick={startCall} disabled={!phone}
                            className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded-full transition-colors disabled:opacity-50">
                            <Play size={16} fill="currentColor" />
                        </button>
                    ) : (
                        <button onClick={() => setIsCalling(false)}
                            className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors">
                            <Square size={16} fill="currentColor" />
                        </button>
                    )}
                </div>
            </div>

            {/* ═══ SMART SCRIPT — Decision Tree ═══ */}
            <div className="mb-3 bg-slate-900/60 rounded-lg border border-slate-700/50 overflow-hidden">
                {/* Script Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700/30">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-cyan-400" />
                        <span className="text-xs font-medium text-slate-300">
                            {scriptState?.scriptName || 'Script de qualification'}
                        </span>
                    </div>
                    {scriptState && !scriptState.isComplete && (
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${scoreColor}`}>{scriptState.totalScore} pts</span>
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full ${scoreBg} transition-all duration-500`} style={{ width: `${scorePercent}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Script Content */}
                <div className="p-3 max-h-52 overflow-y-auto">
                    {scriptLoading && !scriptState ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="animate-spin text-cyan-400" size={20} />
                            <span className="text-xs text-slate-400 ml-2">Chargement du script...</span>
                        </div>
                    ) : scriptState?.isComplete ? (
                        /* ═══ COMPLETION VIEW ═══ */
                        <div className="space-y-3">
                            {/* Score Final */}
                            <div className="text-center">
                                <div className={`text-3xl font-bold ${scoreColor}`}>{scorePercent}%</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {scriptState.totalScore}/{scriptState.maxPossibleScore} points • {scriptState.answeredCount} questions
                                </div>
                            </div>

                            {/* Recommandation */}
                            {scriptState.recommendation && (
                                <div className={`p-2.5 rounded-lg border text-sm ${scriptState.recommendedAction === 'BOOK_RDV'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                        : scriptState.recommendedAction === 'DISQUALIFY'
                                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                    }`}>
                                    {scriptState.recommendation}
                                </div>
                            )}

                            {/* Résumé des réponses */}
                            <div className="space-y-1">
                                {scriptState.history.map((h, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                        <span className={`mt-0.5 ${h.scoreEarned > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {h.scoreEarned > 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-slate-400 truncate block">{h.question.substring(0, 50)}...</span>
                                            <span className="text-white font-medium">{h.answer}</span>
                                        </div>
                                        <span className={`shrink-0 font-mono ${h.scoreEarned > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                            +{h.scoreEarned}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button onClick={loadScript}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/10 transition-colors">
                                <RotateCcw size={12} /> Relancer le script
                            </button>
                        </div>
                    ) : scriptState?.currentNode ? (
                        /* ═══ QUESTION VIEW ═══ */
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
                            {/* Question */}
                            <div>
                                <p className="text-sm text-white font-medium leading-relaxed">{scriptState.currentNode.question}</p>
                                {scriptState.currentNode.helpText && (
                                    <p className="text-[10px] text-slate-500 mt-1 italic">💡 {scriptState.currentNode.helpText}</p>
                                )}
                            </div>

                            {/* Answer Input — based on type */}
                            {scriptState.currentNode.type === 'YES_NO' && (
                                <div className="flex gap-2">
                                    <button onClick={() => submitAnswer('oui')} disabled={scriptLoading}
                                        className="flex-1 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-all text-sm font-medium disabled:opacity-50">
                                        ✅ Oui
                                    </button>
                                    <button onClick={() => submitAnswer('non')} disabled={scriptLoading}
                                        className="flex-1 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-all text-sm font-medium disabled:opacity-50">
                                        ❌ Non
                                    </button>
                                </div>
                            )}

                            {scriptState.currentNode.type === 'CHOICE' && scriptState.currentNode.options && (
                                <div className="space-y-1.5">
                                    {scriptState.currentNode.options.map((opt) => (
                                        <button key={opt.value} onClick={() => submitAnswer(opt.value)} disabled={scriptLoading}
                                            className="w-full text-left py-2 px-3 bg-slate-800/60 text-slate-200 border border-slate-600/50 rounded-lg hover:bg-slate-700/60 hover:border-cyan-500/30 transition-all text-sm disabled:opacity-50 flex items-center justify-between group">
                                            <span>{opt.label}</span>
                                            <ChevronRight size={14} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {scriptState.currentNode.type === 'OPEN_TEXT' && (
                                <div className="flex gap-2">
                                    <input
                                        value={openTextAnswer}
                                        onChange={(e) => setOpenTextAnswer(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && openTextAnswer.trim()) submitAnswer(openTextAnswer.trim()); }}
                                        placeholder="Réponse du prospect..."
                                        className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none"
                                    />
                                    <button onClick={() => { if (openTextAnswer.trim()) submitAnswer(openTextAnswer.trim()); }}
                                        disabled={scriptLoading || !openTextAnswer.trim()}
                                        className="px-3 bg-cyan-600 text-white rounded-lg disabled:opacity-50 hover:bg-cyan-500 transition-colors">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}

                            {scriptState.currentNode.type === 'RATING' && (
                                <div className="flex items-center justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map(v => (
                                        <button key={v}
                                            onClick={() => { setRatingValue(v); submitAnswer(v.toString()); }}
                                            disabled={scriptLoading}
                                            className={`p-2 rounded-lg transition-all ${ratingValue >= v
                                                    ? 'text-yellow-400 scale-110'
                                                    : 'text-slate-600 hover:text-yellow-400/50'
                                                }`}>
                                            <Star size={24} fill={ratingValue >= v ? 'currentColor' : 'none'} />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {scriptState.currentNode.type === 'INFO' && (
                                <button onClick={() => submitAnswer('vu')} disabled={scriptLoading}
                                    className="w-full py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm disabled:opacity-50">
                                    Compris → Continuer
                                </button>
                            )}

                            {/* Progress indicator */}
                            <div className="flex items-center justify-between text-[10px] text-slate-600">
                                <span>Question {scriptState.answeredCount + 1}</span>
                                <span>{scriptState.totalScore} pts accumulés</span>
                            </div>
                        </div>
                    ) : (
                        /* ═══ NO SCRIPT ═══ */
                        <p className="text-xs text-slate-600 italic py-4 text-center">Aucun script de qualification configuré.</p>
                    )}
                </div>
            </div>

            {/* Notes */}
            <div className="mb-3">
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes rapides pendant l'appel..."
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-600 resize-none h-16"
                />
            </div>

            {/* Rappel Picker */}
            {showDatePicker && (
                <div className="mb-3 bg-slate-700/50 p-3 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Date et heure du rappel</label>
                    <div className="flex gap-2">
                        <input type="datetime-local" value={nextCallDate} onChange={(e) => setNextCallDate(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg block w-full p-2" />
                        <button onClick={() => endCall('A_RAPPELER')} disabled={!nextCallDate} className="px-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">OK</button>
                        <button onClick={() => sendWhatsApp('NO_ANSWER')} disabled={sendingMsg === 'NO_ANSWER'}
                            className="px-3 bg-green-600/20 text-green-400 border border-green-600/40 rounded-lg hover:bg-green-600/30" title="WhatsApp">
                            {sendingMsg === 'NO_ANSWER' ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                        </button>
                        <button onClick={() => setShowDatePicker(false)} className="px-3 bg-slate-600 text-white rounded-lg"><X size={14} /></button>
                    </div>
                </div>
            )}

            {/* RDV Picker */}
            {showRdvPicker && (
                <div className="mb-3 bg-purple-900/30 p-3 rounded-lg border border-purple-500/50 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-medium text-purple-300 mb-1">📅 Confirmer le Rendez-vous</label>
                    <div className="flex gap-2">
                        <input type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)}
                            className="bg-slate-800 border border-purple-500/50 text-white text-sm rounded-lg block w-full p-2 outline-none focus:ring-1 focus:ring-purple-500" />
                        <button onClick={() => endCall('RDV')} disabled={!rdvDate} className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 transition-colors">Confirmer</button>
                        <button onClick={() => sendWhatsApp('RDV_CONFIRMATION', new Date(rdvDate).toLocaleString())}
                            disabled={!rdvDate || sendingMsg === 'RDV_CONFIRMATION'}
                            className="px-3 bg-green-600/20 text-green-400 border border-green-600/40 rounded-lg hover:bg-green-600/30 disabled:opacity-30" title="WhatsApp">
                            {sendingMsg === 'RDV_CONFIRMATION' ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                        </button>
                        <button onClick={() => setShowRdvPicker(false)} className="px-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"><X size={14} /></button>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {!showDatePicker && !showRdvPicker && (
                <div className="space-y-2">
                    {/* Smart Suggestion from Script */}
                    {scriptState?.isComplete && scriptState.recommendedAction === 'BOOK_RDV' && (
                        <button onClick={() => endCall('RDV')}
                            className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02] font-semibold animate-pulse">
                            <Zap size={18} /> 🎯 Proposer un RDV (recommandé par le script)
                        </button>
                    )}

                    {/* Standard RDV Button (if not already suggested) */}
                    {(!scriptState?.isComplete || scriptState?.recommendedAction !== 'BOOK_RDV') && (
                        <button onClick={() => endCall('RDV')}
                            className="w-full flex items-center justify-center gap-2 p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.01] font-semibold text-sm">
                            <Clock size={16} /> Prise de RDV
                        </button>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={() => endCall('INTERESSE')} className="flex flex-col items-center justify-center p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors group">
                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">✅</span>
                            <span className="text-[9px] font-medium text-emerald-400">Intéressé</span>
                        </button>
                        <button onClick={() => endCall('A_RAPPELER')} className="flex flex-col items-center justify-center p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors group">
                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">📅</span>
                            <span className="text-[9px] font-medium text-blue-400">Rappel</span>
                        </button>
                        <button onClick={() => endCall('NRP')} className="flex flex-col items-center justify-center p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors group">
                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">📵</span>
                            <span className="text-[9px] font-medium text-amber-400">NRP</span>
                        </button>
                        <button onClick={() => endCall('PAS_INTERESSE')} className="flex flex-col items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors group">
                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">❌</span>
                            <span className="text-[9px] font-medium text-red-400">Stop</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

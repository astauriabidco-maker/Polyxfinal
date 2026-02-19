'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';

// ─── Types ────────────────────────────────────────────────────

interface AnalyticsData {
    period: { days: number; since: string };
    kpi: {
        totalOutbound: number;
        totalInbound: number;
        delivered: number;
        read: number;
        failed: number;
        deliveryRate: number;
        readRate: number;
        failRate: number;
        responseRate: number;
        uniqueContacts: number;
        respondedContacts: number;
        avgResponseMinutes: number | null;
        avgResponseFormatted: string | null;
    };
    hourlyStats: Array<{
        hour: number;
        label: string;
        sent: number;
        read: number;
        readRate: number;
    }>;
    dailyTrend: Array<{
        date: string;
        outbound: number;
        inbound: number;
        delivered: number;
        read: number;
        failed: number;
    }>;
    cost: {
        templateMessages: number;
        freeformMessages: number;
        estimatedCostBest: number;
        estimatedCostWorst: number;
        note: string;
    };
    broadcasts: Array<{
        id: string;
        name: string;
        status: string;
        totalRecipients: number;
        sentCount: number;
        deliveredCount: number;
        failedCount: number;
        startedAt: string | null;
    }>;
}

// ─── Helpers ──────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, color }: {
    icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
    return (
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4 text-center hover:border-slate-600/50 transition-colors">
            <div className="text-lg mb-1">{icon}</div>
            <div className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</div>
            {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
        </div>
    );
}

function BarChart({ data, maxHeight = 80 }: { data: Array<{ label: string; value: number; accent?: boolean }>; maxHeight?: number }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-0.5 h-[100px]">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] text-slate-500">{d.value > 0 ? d.value : ''}</span>
                    <div
                        className={`w-full rounded-t transition-all ${d.accent ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        style={{ height: `${Math.max(2, (d.value / max) * maxHeight)}px` }}
                    />
                    <span className="text-[8px] text-slate-500">{d.label}</span>
                </div>
            ))}
        </div>
    );
}

function ProgressRing({ percent, color, size = 56 }: { percent: number; color: string; size?: number }) {
    const r = (size - 8) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-700" />
        </svg>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/messaging/analytics?days=${days}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error('Analytics load error:', err);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
            <Sidebar />
            <main className="flex-1 ml-64 text-white">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-bold">📊 Analytics Messagerie</h1>
                            <p className="text-sm text-slate-400 mt-1">Performance, engagement, et coûts de vos communications</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {[7, 14, 30, 90].map(d => (
                                <button key={d} onClick={() => setDays(d)}
                                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${days === d
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50'}`}>
                                    {d}j
                                </button>
                            ))}
                            <a href="/messaging" className="ml-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 border border-slate-700/50 rounded-lg">
                                ← Messagerie
                            </a>
                        </div>
                    </div>

                    {loading && (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
                        </div>
                    )}

                    {data && !loading && (
                        <>
                            {/* ═══════ KPI Row ═══════ */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                                <KPICard icon="📤" label="Messages envoyés" value={data.kpi.totalOutbound} />
                                <KPICard icon="📥" label="Messages reçus" value={data.kpi.totalInbound} />
                                <KPICard icon="✅" label="Taux délivraison" value={`${data.kpi.deliveryRate}%`}
                                    color={data.kpi.deliveryRate >= 90 ? 'text-green-400' : data.kpi.deliveryRate >= 70 ? 'text-amber-400' : 'text-red-400'}
                                    sub={`${data.kpi.delivered} délivrés`} />
                                <KPICard icon="👁️" label="Taux de lecture" value={`${data.kpi.readRate}%`}
                                    color={data.kpi.readRate >= 50 ? 'text-blue-400' : 'text-slate-400'}
                                    sub={`${data.kpi.read} lus`} />
                                <KPICard icon="💬" label="Taux de réponse" value={`${data.kpi.responseRate}%`}
                                    color={data.kpi.responseRate >= 30 ? 'text-emerald-400' : 'text-slate-400'}
                                    sub={`${data.kpi.respondedContacts}/${data.kpi.uniqueContacts}`} />
                                <KPICard icon="⏱️" label="Temps moyen réponse" value={data.kpi.avgResponseFormatted || '—'}
                                    color="text-cyan-400" />
                                <KPICard icon="❌" label="Taux d'échec" value={`${data.kpi.failRate}%`}
                                    color={data.kpi.failRate <= 5 ? 'text-green-400' : 'text-red-400'}
                                    sub={`${data.kpi.failed} échoués`} />
                            </div>

                            {/* ═══════ Rate Gauges ═══════ */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {[
                                    { label: 'Délivraison', value: data.kpi.deliveryRate, color: '#22c55e', target: 95 },
                                    { label: 'Lecture', value: data.kpi.readRate, color: '#3b82f6', target: 50 },
                                    { label: 'Réponse', value: data.kpi.responseRate, color: '#10b981', target: 30 },
                                ].map((gauge, i) => (
                                    <div key={i} className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-4 flex items-center gap-4">
                                        <div className="relative flex items-center justify-center">
                                            <ProgressRing percent={gauge.value} color={gauge.color} />
                                            <span className="absolute text-sm font-bold text-white">{gauge.value}%</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white">{gauge.label}</p>
                                            <p className="text-[10px] text-slate-500">
                                                Objectif : {gauge.target}% —{' '}
                                                {gauge.value >= gauge.target
                                                    ? <span className="text-green-400">✓ Atteint</span>
                                                    : <span className="text-amber-400">↑ {(gauge.target - gauge.value).toFixed(1)}% restant</span>}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ═══════ Daily Trend + Hourly Heatmap ═══════ */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                {/* Daily Trend */}
                                <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                                    <h3 className="text-sm font-semibold text-white mb-3">📈 Volume quotidien</h3>
                                    {data.dailyTrend.length > 0 ? (
                                        <BarChart data={data.dailyTrend.map(d => ({
                                            label: formatDate(d.date),
                                            value: d.outbound + d.inbound,
                                            accent: d.inbound > 0,
                                        }))} />
                                    ) : (
                                        <p className="text-sm text-slate-500 py-4 text-center">Aucune donnée</p>
                                    )}
                                    <div className="flex items-center gap-4 mt-2 justify-center">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded bg-slate-700" />
                                            <span className="text-[9px] text-slate-500">Envoyés seuls</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
                                            <span className="text-[9px] text-slate-500">Avec réponses</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Hourly Heatmap */}
                                <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                                    <h3 className="text-sm font-semibold text-white mb-3">🕐 Meilleurs créneaux d'envoi</h3>
                                    <p className="text-[10px] text-slate-500 mb-3">Taux de lecture par heure — les barres indigo montrent les meilleurs créneaux</p>
                                    {data.hourlyStats.length > 0 ? (
                                        <>
                                            <BarChart data={data.hourlyStats
                                                .sort((a, b) => a.hour - b.hour)
                                                .filter(h => h.hour >= 7 && h.hour <= 21)
                                                .map(h => ({
                                                    label: h.label,
                                                    value: h.readRate,
                                                    accent: h.readRate >= (data.hourlyStats.reduce((sum, s) => sum + s.readRate, 0) / data.hourlyStats.filter(s => s.sent > 0).length || 1),
                                                }))} />
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {data.hourlyStats.filter(h => h.sent > 0).slice(0, 3).map((h, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300">
                                                        🏆 {h.label} — {h.readRate}% lu ({h.sent} msg)
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-500 py-4 text-center">Aucune donnée</p>
                                    )}
                                </div>
                            </div>

                            {/* ═══════ Cost Panel ═══════ */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                                    <h3 className="text-sm font-semibold text-white mb-4">💰 Coût estimé</h3>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                                            <div>
                                                <p className="text-sm text-green-300">Messages gratuits (service 24h)</p>
                                                <p className="text-[10px] text-slate-500">Réponses dans la fenêtre de conversation</p>
                                            </div>
                                            <span className="text-lg font-bold text-green-400">{data.cost.freeformMessages}</span>
                                        </div>

                                        <div className="flex justify-between items-center p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                                            <div>
                                                <p className="text-sm text-amber-300">Messages template</p>
                                                <p className="text-[10px] text-slate-500">Utility + Marketing templates Meta</p>
                                            </div>
                                            <span className="text-lg font-bold text-amber-400">{data.cost.templateMessages}</span>
                                        </div>

                                        <div className="border-t border-slate-700/50 pt-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm text-slate-400">Scénario Utility (tout gratuit/~0.005€)</span>
                                                <span className="text-sm font-bold text-green-400">{data.cost.estimatedCostBest.toFixed(2)}€</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-400">Scénario Marketing (~0.014€/msg)</span>
                                                <span className="text-sm font-bold text-amber-400">{data.cost.estimatedCostWorst.toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[9px] text-slate-600 mt-3">{data.cost.note}</p>
                                </div>

                                {/* Broadcast Summary */}
                                <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-5">
                                    <h3 className="text-sm font-semibold text-white mb-3">📢 Derniers Broadcasts</h3>
                                    {data.broadcasts.length === 0 ? (
                                        <p className="text-sm text-slate-500 py-4 text-center">Aucun broadcast</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {data.broadcasts.map(b => {
                                                const dRate = b.totalRecipients > 0
                                                    ? Math.round((b.deliveredCount / b.totalRecipients) * 100) : 0;
                                                return (
                                                    <div key={b.id} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/20">
                                                        <div>
                                                            <p className="text-sm text-white font-medium">{b.name}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {b.sentCount}/{b.totalRecipients} envoyés · {b.deliveredCount} délivrés · {b.failedCount} échoués
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${b.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400'
                                                                : b.status === 'SENDING' ? 'bg-blue-500/10 text-blue-400'
                                                                    : 'bg-slate-800 text-slate-500'
                                                                }`}>{b.status}</span>
                                                            <p className="text-[10px] text-slate-600 mt-0.5">{dRate}% délivré</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

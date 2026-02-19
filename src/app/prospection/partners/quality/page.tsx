/**
 * DASHBOARD QUALITÉ LEADS v2 — KPIs financiers + filtres + export
 * ================================================================
 * /prospection/partners/quality
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

// ─── Types ────────────────────────────────────────────────────

interface KPIs {
    totalLeads: number;
    conversionRate: number;
    rejectionRate: number;
    avgScore: number;
    avgGrade: string;
    leadsThisMonth: number;
    trend: number;
}

interface CostKPIs {
    avgCostPerLead: number;
    totalCost: number;
    cac: number;
    costThisMonth: number;
    budgetTrend: number;
}

interface PartnerMetrics {
    partnerId: string;
    companyName: string;
    status: string;
    totalLeads: number;
    convertedLeads: number;
    rejectedLeads: number;
    avgScore: number;
    conversionRate: number;
    rejectionRate: number;
    grade: string;
    lastLeadAt: string | null;
    costPerLead: number | null;
    totalCost: number;
    cac: number | null;
}

interface StatusDistribution {
    status: string;
    count: number;
    percentage: number;
}

interface DailyTrend {
    date: string;
    count: number;
    avgScore: number;
    dailyCost: number;
}

interface FormationStat {
    formation: string;
    count: number;
    percentage: number;
}

interface GeoStat {
    department: string;
    count: number;
    percentage: number;
}

interface DashboardData {
    period: string;
    kpis: KPIs;
    costs: CostKPIs;
    partners: PartnerMetrics[];
    statusDistribution: StatusDistribution[];
    dailyTrend: DailyTrend[];
    topFormations: FormationStat[];
    geoDistribution: GeoStat[];
}

// ─── Helpers ──────────────────────────────────────────────────

function gradeColor(grade: string): string {
    switch (grade) {
        case 'A': return '#059669';
        case 'B': return '#d97706';
        case 'C': return '#ea580c';
        case 'D': return '#dc2626';
        default: return '#64748b';
    }
}

function gradeBg(grade: string): string {
    switch (grade) {
        case 'A': return 'rgba(5, 150, 105, 0.15)';
        case 'B': return 'rgba(217, 119, 6, 0.15)';
        case 'C': return 'rgba(234, 88, 12, 0.15)';
        case 'D': return 'rgba(220, 38, 38, 0.15)';
        default: return 'rgba(100, 116, 139, 0.15)';
    }
}

function gradeEmoji(grade: string): string {
    switch (grade) {
        case 'A': return '🟢';
        case 'B': return '🟡';
        case 'C': return '🟠';
        case 'D': return '🔴';
        default: return '⚪';
    }
}

const STATUS_LABELS: Record<string, string> = {
    NEW: 'Nouveau',
    DISPATCHED: 'Dispatché',
    A_RAPPELER: 'A rappeler',
    NE_REPONDS_PAS: 'Ne réponds pas',
    PAS_INTERESSE: 'Pas intéressé',
    RDV_PLANIFIE: 'RDV Planifié',
    RDV_NON_HONORE: 'RDV Non Honoré',
    COURRIERS_ENVOYES: 'Courriers Envoyés',
    COURRIERS_RECUS: 'Courriers Reçus',
    NEGOCIATION: 'Négociation',
    CONVERTI: 'Converti',
    PROBLEMES_SAV: 'Problèmes/SAV',
    PERDU: 'Perdu',
};

const STATUS_COLORS: Record<string, string> = {
    NEW: '#818cf8',
    DISPATCHED: '#38bdf8',
    A_RAPPELER: '#fbbf24',
    NE_REPONDS_PAS: '#fb923c',
    PAS_INTERESSE: '#f87171',
    RDV_PLANIFIE: '#a78bfa',
    RDV_NON_HONORE: '#ef4444',
    COURRIERS_ENVOYES: '#60a5fa',
    COURRIERS_RECUS: '#22d3ee',
    NEGOCIATION: '#f59e0b',
    CONVERTI: '#34d399',
    PROBLEMES_SAV: '#fb923c',
    PERDU: '#94a3b8',
};

const PERIODS = [
    { value: '7', label: '7 jours' },
    { value: '30', label: '30 jours' },
    { value: '90', label: '90 jours' },
    { value: 'all', label: 'Tout' },
];

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(n);
}

// ─── Page Component ───────────────────────────────────────────

export default function LeadQualityDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState('all');

    const fetchData = useCallback(async (p: string) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/partners/quality-dashboard?period=${p}`);
            if (!res.ok) throw new Error('Erreur lors du chargement');
            const json = await res.json();
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(period); }, [fetchData, period]);

    const handlePeriodChange = (p: string) => {
        setPeriod(p);
    };

    const handleExportCsv = () => {
        window.open(`/api/partners/quality-dashboard?period=${period}&format=csv`, '_blank');
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
                </div>
            </DashboardLayout>
        );
    }

    if (error || !data) {
        return (
            <DashboardLayout>
                <div className="text-center py-20">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-white mb-2">Erreur</h2>
                    <p className="text-slate-400">{error || 'Données non disponibles'}</p>
                    <button onClick={() => fetchData(period)} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors">
                        Réessayer
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const { kpis, costs, partners, statusDistribution, dailyTrend, topFormations, geoDistribution } = data;
    const maxDailyCount = Math.max(...dailyTrend.map(d => d.count), 1);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* ─── Header + Controls ──────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">📊</span>
                            Qualité des Leads Partenaires
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Performance, qualité et métriques financières
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Filtre Période */}
                        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            {PERIODS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => handlePeriodChange(p.value)}
                                    className={`px-3 py-2 text-sm transition-all ${period === p.value
                                        ? 'bg-purple-600 text-white font-medium'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {/* Export CSV */}
                        <button
                            onClick={handleExportCsv}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 hover:border-slate-600 transition-all text-sm flex items-center gap-2"
                            title="Exporter en CSV"
                        >
                            📥 CSV
                        </button>
                        {/* Refresh */}
                        <button
                            onClick={() => fetchData(period)}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 hover:border-slate-600 transition-all text-sm"
                            title="Actualiser"
                        >
                            🔄
                        </button>
                    </div>
                </div>

                {/* ─── KPIs Performance ───────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard icon="📮" label="Total Leads" value={kpis.totalLeads.toString()} sub={`${kpis.leadsThisMonth} ce mois`} trend={kpis.trend} />
                    <KpiCard icon="✅" label="Taux Conversion" value={`${kpis.conversionRate}%`} sub={`${Math.round(kpis.totalLeads * kpis.conversionRate / 100)} convertis`} />
                    <KpiCard icon="❌" label="Taux Rejet" value={`${kpis.rejectionRate}%`} sub={`${Math.round(kpis.totalLeads * kpis.rejectionRate / 100)} perdus`} negative />
                    <KpiCard icon="⭐" label="Score Moyen" value={`${kpis.avgScore}/100`} sub={`Grade ${kpis.avgGrade}`} accentColor={gradeColor(kpis.avgGrade)} />
                    <KpiCard icon="📈" label="Tendance Volume" value={`${kpis.trend > 0 ? '+' : ''}${kpis.trend}%`} sub="vs mois précédent" trend={kpis.trend} />
                </div>

                {/* ─── KPIs Financiers ─────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        icon="💰"
                        label="CPL Moyen"
                        value={costs.avgCostPerLead > 0 ? formatCurrency(costs.avgCostPerLead) : '—'}
                        sub="Coût Par Lead moyen"
                        gradient="from-amber-600/20 to-orange-600/20"
                    />
                    <KpiCard
                        icon="💸"
                        label="Coût Total"
                        value={costs.totalCost > 0 ? formatCurrency(costs.totalCost) : '—'}
                        sub={costs.costThisMonth > 0 ? `${formatCurrency(costs.costThisMonth)} ce mois` : 'Aucun coût configuré'}
                        trend={costs.budgetTrend}
                        gradient="from-red-600/20 to-pink-600/20"
                    />
                    <KpiCard
                        icon="🎯"
                        label="CAC"
                        value={costs.cac > 0 ? formatCurrency(costs.cac) : '—'}
                        sub="Coût par client acquis"
                        gradient="from-purple-600/20 to-violet-600/20"
                    />
                    <KpiCard
                        icon="📊"
                        label="Budget Tendance"
                        value={`${costs.budgetTrend > 0 ? '+' : ''}${costs.budgetTrend}%`}
                        sub="vs mois précédent"
                        trend={costs.budgetTrend}
                        negative={costs.budgetTrend > 0}
                        gradient="from-cyan-600/20 to-teal-600/20"
                    />
                </div>

                {/* ─── Row 2: Tendance + Distribution ─────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Tendance */}
                    <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            📈 Volume & Coûts ({PERIODS.find(p => p.value === period)?.label})
                        </h3>
                        <div className="flex items-end gap-[3px] h-40">
                            {dailyTrend.map((day, i) => {
                                const height = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
                                const scoreColor = day.avgScore >= 80 ? '#059669' : day.avgScore >= 60 ? '#d97706' : day.avgScore >= 40 ? '#ea580c' : '#dc2626';
                                return (
                                    <div key={i} className="relative group flex-1 min-w-0">
                                        <div
                                            className="w-full rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer"
                                            style={{
                                                height: `${Math.max(height, 2)}%`,
                                                background: day.count > 0
                                                    ? `linear-gradient(to top, ${scoreColor}40, ${scoreColor}90)`
                                                    : 'rgba(100, 116, 139, 0.2)',
                                            }}
                                        />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                                                <div className="text-white font-medium">{day.date}</div>
                                                <div className="text-slate-400">{day.count} lead{day.count > 1 ? 's' : ''}</div>
                                                {day.avgScore > 0 && <div style={{ color: scoreColor }}>Score: {day.avgScore}/100</div>}
                                                {day.dailyCost > 0 && <div className="text-amber-400">Coût: {formatCurrency(day.dailyCost)}</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-500">
                            <span>{dailyTrend[0]?.date || ''}</span>
                            <span>{dailyTrend[dailyTrend.length - 1]?.date || ''}</span>
                        </div>
                    </div>

                    {/* Distribution statuts */}
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            🥧 Distribution Statuts
                        </h3>
                        <div className="space-y-3">
                            {statusDistribution.map((s) => (
                                <div key={s.status}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-slate-300">{STATUS_LABELS[s.status] || s.status}</span>
                                        <span className="text-sm font-medium text-white">{s.count} ({s.percentage}%)</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${s.percentage}%`, backgroundColor: STATUS_COLORS[s.status] || '#64748b' }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {statusDistribution.length === 0 && <p className="text-slate-500 text-sm text-center py-6">Aucun lead</p>}
                        </div>
                    </div>
                </div>

                {/* ─── Row 3: Classement Partenaires (avec coûts) ── */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        🏆 Classement Partenaires — Performance & Coûts
                    </h3>
                    {partners.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-800">
                                        <th className="pb-3 font-medium">#</th>
                                        <th className="pb-3 font-medium">Partenaire</th>
                                        <th className="pb-3 font-medium text-center">Leads</th>
                                        <th className="pb-3 font-medium text-center">Conv.</th>
                                        <th className="pb-3 font-medium text-center">Score</th>
                                        <th className="pb-3 font-medium text-center">Grade</th>
                                        <th className="pb-3 font-medium text-center">CPL</th>
                                        <th className="pb-3 font-medium text-center">Coût Total</th>
                                        <th className="pb-3 font-medium text-center">CAC</th>
                                        <th className="pb-3 font-medium text-right">Dernier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partners.map((p, i) => (
                                        <tr key={p.partnerId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 text-slate-500 font-mono">{i + 1}</td>
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 flex items-center justify-center text-xs font-bold text-purple-300">
                                                        {p.companyName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-medium">{p.companyName}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {p.status === 'ACTIVE' ? '🟢 Actif' : p.status === 'SUSPENDED' ? '🟡 Suspendu' : '⚪ ' + p.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center text-white font-medium">{p.totalLeads}</td>
                                            <td className="py-3 text-center">
                                                <span className="text-emerald-400 font-medium">{p.conversionRate}%</span>
                                                <div className="text-xs text-slate-500">{p.convertedLeads} conv.</div>
                                            </td>
                                            <td className="py-3 text-center">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <div className="w-10 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${p.avgScore}%`, backgroundColor: gradeColor(p.grade) }} />
                                                    </div>
                                                    <span className="text-white font-mono text-xs">{p.avgScore}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: gradeColor(p.grade), backgroundColor: gradeBg(p.grade) }}>
                                                    {gradeEmoji(p.grade)} {p.grade}
                                                </span>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="text-amber-400 font-medium">
                                                    {p.costPerLead !== null ? formatCurrency(p.costPerLead) : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className={`font-medium ${p.totalCost > 0 ? 'text-white' : 'text-slate-500'}`}>
                                                    {p.totalCost > 0 ? formatCurrency(p.totalCost) : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className={`font-medium ${p.cac !== null && p.cac > 0 ? 'text-purple-400' : 'text-slate-500'}`}>
                                                    {p.cac !== null ? formatCurrency(p.cac) : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right text-slate-400 text-xs">
                                                {p.lastLeadAt ? new Date(p.lastLeadAt).toLocaleDateString('fr-FR') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-8">Aucun partenaire avec des leads</p>
                    )}
                </div>

                {/* ─── Row 4: Formations + Géo ────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Top formations */}
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            🎓 Top Formations Demandées
                        </h3>
                        <div className="space-y-3">
                            {topFormations.map((f, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-sm font-mono text-slate-500 w-6 text-right">{i + 1}.</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-sm text-white truncate">{f.formation}</span>
                                            <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">{f.count} ({f.percentage}%)</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500" style={{ width: `${f.percentage}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {topFormations.length === 0 && <p className="text-slate-500 text-sm text-center py-6">Aucune formation</p>}
                        </div>
                    </div>

                    {/* Distribution géographique */}
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            🗺️ Couverture Géographique
                        </h3>
                        <div className="space-y-3">
                            {geoDistribution.map((g, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-sm font-mono text-purple-400 w-8 text-center bg-purple-900/30 rounded px-1 py-0.5">{g.department}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-sm text-slate-300">Département {g.department}</span>
                                            <span className="text-xs text-slate-400">{g.count} ({g.percentage}%)</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500" style={{ width: `${g.percentage}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {geoDistribution.length === 0 && <p className="text-slate-500 text-sm text-center py-6">Aucune donnée géographique</p>}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

// ─── KPI Card Component ──────────────────────────────────────

function KpiCard({
    icon,
    label,
    value,
    sub,
    trend,
    negative,
    accentColor,
    gradient,
}: {
    icon: string;
    label: string;
    value: string;
    sub: string;
    trend?: number;
    negative?: boolean;
    accentColor?: string;
    gradient?: string;
}) {
    return (
        <div className={`relative overflow-hidden bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all group`}>
            {/* Gradient background subtil */}
            {gradient && (
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 group-hover:opacity-70 transition-opacity`} />
            )}
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{icon}</span>
                    {trend !== undefined && trend !== 0 && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(negative ? trend < 0 : trend > 0)
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : 'bg-red-900/40 text-red-400'
                            }`}>
                            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                        </span>
                    )}
                </div>
                <div
                    className="text-2xl font-bold mb-1 transition-colors"
                    style={{ color: accentColor || (negative ? '#f87171' : '#ffffff') }}
                >
                    {value}
                </div>
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-xs text-slate-600 mt-1">{sub}</div>
            </div>
        </div>
    );
}

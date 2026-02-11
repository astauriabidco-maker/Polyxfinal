/**
 * DASHBOARD QUALIFICATION PARTENAIRES — Qualiopi Ind. 17 & 26
 * ===============================================================
 * Affiche le scoring, la checklist documentaire, et les conventions
 * de sous-traitance pour tous les partenaires.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────

interface QualificationDetail {
    criterion: string;
    label: string;
    category: string;
    points: number;
    maxPoints: number;
    met: boolean;
    detail?: string;
}

interface PartnerQualification {
    partnerId: string;
    companyName: string;
    score: number;
    maxScore: number;
    grade: string;
    isQualified: boolean;
    details: QualificationDetail[];
    missingCriteria: string[];
    conventionStatus: 'SIGNED' | 'EXPIRED' | 'MISSING';
    alerts: string[];
}

interface QualificationStats {
    total: number;
    qualified: number;
    nonQualified: number;
    avgScore: number;
    gradeDistribution: Record<string, number>;
    commonMissing: { criterion: string; count: number }[];
    conventionsSigned: number;
    conventionsExpired: number;
    conventionsMissing: number;
    reviewsDueSoon: number;
}

// ─── Helpers ──────────────────────────────────────────────────

function gradeColor(grade: string): string {
    switch (grade) {
        case 'A': return '#10b981';
        case 'B': return '#3b82f6';
        case 'C': return '#f59e0b';
        case 'D': return '#ef4444';
        default: return '#6b7280';
    }
}

function gradeBg(grade: string): string {
    switch (grade) {
        case 'A': return 'rgba(16, 185, 129, 0.15)';
        case 'B': return 'rgba(59, 130, 246, 0.15)';
        case 'C': return 'rgba(245, 158, 11, 0.15)';
        case 'D': return 'rgba(239, 68, 68, 0.15)';
        default: return 'rgba(107, 114, 128, 0.15)';
    }
}

function gradeEmoji(grade: string): string {
    switch (grade) {
        case 'A': return '🏆';
        case 'B': return '✅';
        case 'C': return '⚠️';
        case 'D': return '🔴';
        default: return '⚪';
    }
}

function conventionBadge(status: string): { label: string; color: string; bg: string } {
    switch (status) {
        case 'SIGNED': return { label: 'Signée', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
        case 'EXPIRED': return { label: 'Expirée', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
        default: return { label: 'Non signée', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    }
}

// ─── Component ────────────────────────────────────────────────

export default function PartnerQualificationDashboard() {
    const [stats, setStats] = useState<QualificationStats | null>(null);
    const [partners, setPartners] = useState<PartnerQualification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
    const [evaluating, setEvaluating] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/partners/qualification');
            if (!res.ok) throw new Error('Erreur lors du chargement');
            const json = await res.json();
            setStats(json.stats);
            setPartners(json.partners || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEvaluateAll = async () => {
        if (!partners.length) return;
        setEvaluating(true);
        try {
            await fetch('/api/partners/qualification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'evaluate-all',
                    partnerId: partners[0].partnerId,
                }),
            });
            await fetchData();
        } catch {
            // Ignore
        } finally {
            setEvaluating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500" />
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="text-center py-20">
                <div className="text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-white mb-2">Erreur</h2>
                <p className="text-slate-400">{error || 'Données non disponibles'}</p>
                <button onClick={fetchData} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">
                    Réessayer
                </button>
            </div>
        );
    }

    const qualifiedPct = stats.total > 0 ? Math.round((stats.qualified / stats.total) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* ─── Header ────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">🎯</span>
                        Qualification Partenaires
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Contrôle qualité Qualiopi Ind. 17 (Sous-traitance) & Ind. 26 (Intervenants externes)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleEvaluateAll}
                        disabled={evaluating}
                        className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {evaluating ? '⏳ Évaluation...' : '🔄 Réévaluer tout'}
                    </button>
                    <button
                        onClick={fetchData}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 transition-all text-sm"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {/* ─── Score Gauge + KPIs ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Score Gauge */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center">
                    <div className="relative w-32 h-32 mb-3">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(51, 65, 85, 0.5)" strokeWidth="8" />
                            <circle
                                cx="60" cy="60" r="54" fill="none"
                                stroke={qualifiedPct >= 80 ? '#10b981' : qualifiedPct >= 50 ? '#3b82f6' : '#ef4444'}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${qualifiedPct * 3.39} 339.3`}
                                className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white">{qualifiedPct}%</span>
                            <span className="text-xs text-slate-400">conformes</span>
                        </div>
                    </div>
                    <div className="text-sm text-slate-400">
                        {stats.qualified}/{stats.total} qualifiés
                    </div>
                </div>

                {/* KPIs */}
                <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon="📊" label="Score Moyen" value={`${stats.avgScore}/100`} sub={`Seuil : 60/100`} />
                    <KpiCard icon="📋" label="Conventions" value={`${stats.conventionsSigned}`} sub={`${stats.conventionsExpired} expirée(s), ${stats.conventionsMissing} manquante(s)`} />
                    <KpiCard icon="📅" label="Revues < 30j" value={`${stats.reviewsDueSoon}`} sub="Prochaines évaluations" />
                    <KpiCard icon="🚨" label="Non qualifiés" value={`${stats.nonQualified}`} sub="Actions correctives requises" negative />
                </div>
            </div>

            {/* ─── Grade Distribution ────────────────────── */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    📊 Distribution des Grades
                </h3>
                <div className="grid grid-cols-4 gap-4">
                    {['A', 'B', 'C', 'D'].map(grade => (
                        <div key={grade} className="flex flex-col items-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mb-2 transition-all"
                                style={{ backgroundColor: gradeBg(grade), color: gradeColor(grade) }}
                            >
                                {grade}
                            </div>
                            <div className="text-xl font-bold text-white">{stats.gradeDistribution[grade] || 0}</div>
                            <div className="text-xs text-slate-500">
                                {grade === 'A' ? '≥ 80' : grade === 'B' ? '60-79' : grade === 'C' ? '40-59' : '< 40'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Critères les plus manquants ───────────── */}
            {stats.commonMissing.length > 0 && (
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        ⚠️ Critères les plus souvent manquants
                    </h3>
                    <div className="space-y-3">
                        {stats.commonMissing.slice(0, 5).map((m, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">{m.criterion}</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-500"
                                            style={{ width: `${stats.total > 0 ? (m.count / stats.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-amber-400 w-20 text-right">
                                        {m.count}/{stats.total}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Liste des Partenaires ─────────────────── */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🏢 Détail par Partenaire
                </h3>

                {partners.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Aucun partenaire actif</p>
                ) : (
                    <div className="space-y-3">
                        {partners
                            .sort((a, b) => b.score - a.score)
                            .map(p => (
                                <PartnerCard
                                    key={p.partnerId}
                                    partner={p}
                                    expanded={expandedPartner === p.partnerId}
                                    onToggle={() => setExpandedPartner(
                                        expandedPartner === p.partnerId ? null : p.partnerId
                                    )}
                                />
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Partner Card ──────────────────────────────────────────────

function PartnerCard({
    partner,
    expanded,
    onToggle,
}: {
    partner: PartnerQualification;
    expanded: boolean;
    onToggle: () => void;
}) {
    const conv = conventionBadge(partner.conventionStatus);

    return (
        <div className="border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all">
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: gradeBg(partner.grade), color: gradeColor(partner.grade) }}
                    >
                        {partner.grade}
                    </div>
                    <div className="text-left">
                        <div className="text-white font-medium flex items-center gap-2">
                            {partner.companyName}
                            {partner.isQualified ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">
                                    Qualifié
                                </span>
                            ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">
                                    Non qualifié
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-slate-500 flex items-center gap-3 mt-1">
                            <span>{partner.score}/{partner.maxScore} points</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: conv.color, backgroundColor: conv.bg }}>
                                Convention : {conv.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Score bar */}
                    <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${partner.score}%`,
                                    backgroundColor: gradeColor(partner.grade),
                                }}
                            />
                        </div>
                        <span className="text-xs font-mono text-slate-400 w-8">{partner.score}%</span>
                    </div>

                    {/* Alerts count */}
                    {partner.alerts.length > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-900/30 text-amber-400">
                            {partner.alerts.length} alerte{partner.alerts.length > 1 ? 's' : ''}
                        </span>
                    )}

                    <span className="text-slate-500">{expanded ? '▲' : '▼'}</span>
                </div>
            </button>

            {/* Detail */}
            {expanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-800">
                    {/* Alerts */}
                    {partner.alerts.length > 0 && (
                        <div className="mt-4 p-3 bg-amber-900/10 border border-amber-800/30 rounded-xl">
                            <div className="text-sm font-medium text-amber-400 mb-2">🚨 Alertes</div>
                            <ul className="space-y-1">
                                {partner.alerts.map((a, i) => (
                                    <li key={i} className="text-xs text-amber-300/80 flex items-start gap-2">
                                        <span className="mt-0.5">•</span>{a}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Scoring Grid */}
                    <div className="mt-4">
                        <div className="text-sm font-medium text-slate-300 mb-3">📋 Grille de Scoring</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {partner.details.map(d => (
                                <div
                                    key={d.criterion}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${d.met ? 'bg-emerald-900/10 border border-emerald-800/20' : 'bg-slate-800/30 border border-slate-700/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{d.met ? '✅' : '❌'}</span>
                                        <div>
                                            <div className="text-sm text-white">{d.label}</div>
                                            <div className="text-xs text-slate-500">
                                                {d.category}
                                                {d.detail && <span className="text-amber-400 ml-1">({d.detail})</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold ${d.met ? 'text-emerald-400' : 'text-slate-600'}`}>
                                        {d.points}/{d.maxPoints}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Missing Criteria Summary */}
                    {partner.missingCriteria.length > 0 && (
                        <div className="p-3 bg-red-900/10 border border-red-800/20 rounded-xl">
                            <div className="text-sm font-medium text-red-400 mb-2">❌ Critères manquants</div>
                            <div className="flex flex-wrap gap-2">
                                {partner.missingCriteria.map((c, i) => (
                                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-red-900/20 text-red-300">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── KPI Card Component ───────────────────────────────────────

function KpiCard({
    icon,
    label,
    value,
    sub,
    negative,
}: {
    icon: string;
    label: string;
    value: string;
    sub: string;
    negative?: boolean;
}) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className={`text-2xl font-bold mb-1 ${negative ? 'text-red-400' : 'text-white'}`}>
                {value}
            </div>
            <div className="text-xs text-slate-500">{sub}</div>
        </div>
    );
}

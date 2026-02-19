/**
 * DASHBOARD COMPLIANCE — Page principale
 * ========================================
 * Centre de pilotage conformité intégrant les 4 modules :
 *   - BPF (Bilan Pédagogique et Financier)
 *   - DRIEETS (Rapport annuel)
 *   - OPCO (Export dossiers)
 *   - CPF / CDC (Conformité CPF)
 *
 * URL: /compliance
 *
 * @Compliance: Qualiopi — Indicateurs 1 à 32
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

// ─── Types ────────────────────────────────────────────────────

interface ModuleStatus {
    id: string;
    label: string;
    description: string;
    icon: string;
    status: 'loading' | 'success' | 'warning' | 'error' | 'idle';
    score: number | null;
    details: string;
    apiUrl: string;
    downloadUrl: string;
    color: string;
    data?: any;
}

interface ChecklistItem {
    label: string;
    reference: string;
    status: 'OK' | 'KO' | 'PARTIEL' | 'NA';
    detail: string;
}

// ─── Composant principal ──────────────────────────────────────

export default function ComplianceDashboard() {
    const [modules, setModules] = useState<ModuleStatus[]>(getInitialModules());
    const [activeModule, setActiveModule] = useState<string | null>(null);
    const [exercice, setExercice] = useState(new Date().getFullYear() - 1);
    const [isLoading, setIsLoading] = useState(false);
    const [globalScore, setGlobalScore] = useState<number | null>(null);

    // ── Chargement des données ───────────────────────────────

    const loadModule = useCallback(async (moduleId: string) => {
        setModules(prev => prev.map(m =>
            m.id === moduleId ? { ...m, status: 'loading' } : m
        ));

        try {
            const module = modules.find(m => m.id === moduleId);
            if (!module) return;

            const url = `${module.apiUrl}?exercice=${exercice}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erreur');

            let score = 0;
            let details = '';
            let status: ModuleStatus['status'] = 'success';

            switch (moduleId) {
                case 'bpf': {
                    const report = data.report;
                    const alertes = report?.alertes?.length || 0;
                    score = alertes === 0 ? 100 : Math.max(0, 100 - alertes * 15);
                    details = `${report?.bilanPedagogique?.totalStagiaires || 0} stagiaires · ${report?.bilanFinancier?.produitsFormation?.caTotal?.toLocaleString('fr-FR') || 0}€ CA`;
                    if (alertes > 0) status = 'warning';
                    break;
                }
                case 'drieets': {
                    const report = data.report;
                    const checklist: ChecklistItem[] = report?.checklist || [];
                    const okCount = checklist.filter(c => c.status === 'OK').length;
                    const total = checklist.length || 1;
                    score = Math.round((okCount / total) * 100);
                    details = `${okCount}/${total} obligations validées`;
                    if (score < 80) status = 'warning';
                    if (score < 60) status = 'error';
                    break;
                }
                case 'opco': {
                    const contrats = data.contrats || [];
                    const totalContrats = data.total || 0;
                    score = totalContrats > 0 ? 85 : 100;
                    details = `${totalContrats} contrat(s) OPCO`;
                    break;
                }
                case 'cpf': {
                    const recap = data.recap;
                    const eligibles = recap?.eligibilite?.programmesEligibles || 0;
                    const totalProg = recap?.eligibilite?.totalProgrammes || 1;
                    const retractConf = recap?.retractation?.tauxConformiteRetractation || 100;
                    score = Math.round((eligibles / totalProg) * 50 + retractConf * 0.5);
                    details = `${eligibles}/${totalProg} programmes éligibles · Rétractation: ${retractConf}%`;
                    if (score < 80) status = 'warning';
                    if (recap?.alertes?.length > 3) status = 'error';
                    break;
                }
                case 'rgpd': {
                    const stats = data.register;
                    const retention = data.retention;

                    // Score calculation:
                    // - DPA missing: -20 per missing DPA
                    // - DPIA required but not completed: -30
                    // - Retention policy respected (olderThan36Months == 0): +10
                    let calcScore = 100;

                    if (stats.dpaPending > 0) calcScore -= (stats.dpaPending * 20);
                    if (stats.dpiaRequired > stats.dpiaCompleted) calcScore -= 30;
                    if (retention.nextPurgeEligible > 0) calcScore -= 10;

                    score = Math.max(0, calcScore);
                    details = `${stats.activeTreatments} traitements actifs · ${stats.dpaPending} DPA manquants`;

                    if (stats.dpaPending > 0) status = 'error';
                    else if (retention.nextPurgeEligible > 0) status = 'warning';

                    break;
                }
            }

            setModules(prev => prev.map(m =>
                m.id === moduleId ? { ...m, status, score, details, data } : m
            ));
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Erreur inconnue';
            setModules(prev => prev.map(m =>
                m.id === moduleId ? { ...m, status: 'error', details: errMsg } : m
            ));
        }
    }, [exercice, modules]);

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        await Promise.all(modules.map(m => loadModule(m.id)));
        setIsLoading(false);
    }, [loadModule, modules]);

    // ── Calcul score global ──────────────────────────────────

    useEffect(() => {
        const scores = modules.filter(m => m.score !== null).map(m => m.score!);
        if (scores.length > 0) {
            setGlobalScore(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
        }
    }, [modules]);

    // ── Téléchargement ───────────────────────────────────────

    const downloadReport = async (moduleId: string) => {
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        const url = `${module.downloadUrl}?exercice=${exercice}&format=text`;
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${moduleId}-${exercice}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ─── Rendu ────────────────────────────────────────────────

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 lg:p-10">
                {/* ── Header ──────────────────────────────────── */}
                <header className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                Centre de Pilotage Conformité
                            </h1>
                            <p className="text-slate-400 mt-1">
                                Supervision Qualiopi · DRIEETS · OPCO · CPF/CDC
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Sélecteur d'exercice */}
                            <div className="flex items-center gap-2 bg-slate-800/60 backdrop-blur rounded-xl px-3 py-2 border border-slate-700/50">
                                <span className="text-sm text-slate-400">Exercice</span>
                                <select
                                    id="exercice-select"
                                    value={exercice}
                                    onChange={e => setExercice(parseInt(e.target.value))}
                                    className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                        <option key={y} value={y} className="bg-slate-800">{y}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Bouton refresh */}
                            <button
                                id="btn-refresh-all"
                                onClick={loadAll}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium
                                       hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                       shadow-lg shadow-cyan-500/20"
                            >
                                <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                                {isLoading ? 'Chargement...' : 'Actualiser tout'}
                            </button>
                        </div>
                    </div>

                    {/* Score global */}
                    {globalScore !== null && (
                        <div className="mt-6 flex items-center gap-4">
                            <div className="relative w-20 h-20">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                    <path
                                        className="text-slate-700"
                                        d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none" stroke="currentColor" strokeWidth="3"
                                    />
                                    <path
                                        className={globalScore >= 80 ? 'text-emerald-400' : globalScore >= 60 ? 'text-amber-400' : 'text-red-400'}
                                        d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none" stroke="currentColor" strokeWidth="3"
                                        strokeDasharray={`${globalScore}, 100`}
                                        style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                                    {globalScore}%
                                </span>
                            </div>
                            <div>
                                <div className="text-sm text-slate-400">Score global de conformité</div>
                                <div className={`text-lg font-semibold ${globalScore >= 80 ? 'text-emerald-400' :
                                    globalScore >= 60 ? 'text-amber-400' : 'text-red-400'
                                    }`}>
                                    {globalScore >= 90 ? 'Excellent' :
                                        globalScore >= 80 ? 'Conforme' :
                                            globalScore >= 60 ? 'Attention requise' : 'Non conforme'}
                                </div>
                            </div>
                        </div>
                    )}
                </header>

                {/* ── Superviseur (Agent Watchdog) ────────────── */}
                <ComplianceSupervisor />

                {/* ── Grille des modules ──────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    {modules.map(mod => (
                        <ModuleCard
                            key={mod.id}
                            module={mod}
                            isActive={activeModule === mod.id}
                            onClick={() => setActiveModule(activeModule === mod.id ? null : mod.id)}
                            onLoad={() => loadModule(mod.id)}
                            onDownload={() => downloadReport(mod.id)}
                        />
                    ))}
                </div>

                {/* ── Détail du module actif ──────────────────── */}
                {activeModule && (
                    <ModuleDetail
                        module={modules.find(m => m.id === activeModule)!}
                        onClose={() => setActiveModule(null)}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}

// ─── Composant ModuleCard ─────────────────────────────────────

function ModuleCard({
    module, isActive, onClick, onLoad, onDownload,
}: {
    module: ModuleStatus;
    isActive: boolean;
    onClick: () => void;
    onLoad: () => void;
    onDownload: () => void;
}) {
    const statusColors = {
        loading: 'border-cyan-500/50 shadow-cyan-500/10',
        success: 'border-emerald-500/50 shadow-emerald-500/10',
        warning: 'border-amber-500/50 shadow-amber-500/10',
        error: 'border-red-500/50 shadow-red-500/10',
        idle: 'border-slate-600/50',
    };

    const scoreColor = module.score === null ? 'text-slate-500' :
        module.score >= 80 ? 'text-emerald-400' :
            module.score >= 60 ? 'text-amber-400' : 'text-red-400';

    return (
        <div
            className={`relative group rounded-2xl p-5 cursor-pointer
                bg-slate-800/40 backdrop-blur-xl border-2 transition-all duration-300
                hover:bg-slate-800/60 hover:scale-[1.02] hover:shadow-2xl
                ${statusColors[module.status]}
                ${isActive ? 'ring-2 ring-cyan-400/50 bg-slate-800/60' : ''}`}
            onClick={onClick}
            id={`module-${module.id}`}
        >
            {/* Loading indicator */}
            {module.status === 'loading' && (
                <div className="absolute top-3 right-3">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Icon + Label */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                                 ${module.color} shadow-lg`}
                    style={{ background: `linear-gradient(135deg, ${module.color.includes('cyan') ? '#0891b2, #0e7490' : module.color.includes('violet') ? '#7c3aed, #6d28d9' : module.color.includes('amber') ? '#d97706, #b45309' : module.color.includes('emerald') ? '#059669, #047857' : '#2563eb, #1d4ed8'})` }}>
                    {module.icon === 'gdpr' ? '🛡️' : module.icon}
                </div>
                <div>
                    <div className="font-semibold text-white">{module.label}</div>
                    <div className="text-xs text-slate-400">{module.description}</div>
                </div>
            </div>

            {/* Score */}
            <div className="flex items-end justify-between mt-4">
                <div className={`text-3xl font-bold ${scoreColor}`}>
                    {module.score !== null ? `${module.score}%` : '—'}
                </div>
                <div className="text-xs text-slate-400 text-right max-w-[55%] line-clamp-2">
                    {module.details}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    id={`btn-load-${module.id}`}
                    onClick={e => { e.stopPropagation(); onLoad(); }}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600/60 rounded-lg
                               border border-slate-600/50 transition-colors"
                >
                    🔄 Charger
                </button>
                <button
                    id={`btn-download-${module.id}`}
                    onClick={e => { e.stopPropagation(); onDownload(); }}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600/60 rounded-lg
                               border border-slate-600/50 transition-colors"
                >
                    📥 Exporter
                </button>
            </div>
        </div>
    );
}

// ─── Composant ModuleDetail ───────────────────────────────────

function ModuleDetail({ module, onClose }: { module: ModuleStatus; onClose: () => void }) {
    if (!module.data) {
        return (
            <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 text-center">
                <p className="text-slate-400 mb-4">Chargez les données du module pour voir les détails.</p>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                >
                    Fermer
                </button>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>{module.icon}</span>
                    <span>{module.label}</span>
                    <span className="text-sm font-normal text-slate-400">— Détails</span>
                </h2>
                <button
                    id="btn-close-detail"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700/60 hover:bg-slate-600/60 transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Contenu conditionnel par module */}
            {module.id === 'bpf' && <BPFDetail data={module.data} />}
            {module.id === 'drieets' && <DRIEETSDetail data={module.data} />}
            {module.id === 'opco' && <OPCODetail data={module.data} />}
            {module.id === 'cpf' && <CPFDetail data={module.data} />}
            {module.id === 'rgpd' && <RGPDDetail data={module.data} />}
        </div>
    );
}

// ─── Détails RGPD ─────────────────────────────────────────────

function RGPDDetail({ data }: { data: any }) {
    const stats = data.register;
    const retention = data.retention;
    if (!stats) return <EmptyState />;

    const alertes = [];
    if (stats.dpaPending > 0) alertes.push(`${stats.dpaPending} sous-traitant(s) sans DPA signé`);
    if (stats.dpiaRequired > stats.dpiaCompleted) alertes.push('Analyse d\'impact (AIPD) requise manquante');
    if (retention.nextPurgeEligible > 0) alertes.push(`${retention.nextPurgeEligible} leads à purger (> 36 mois)`);
    if (!stats.dpoDesignated) alertes.push('DPO non désigné');

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <MetricCard title="Traitements" value={stats.activeTreatments} subtitle="Actifs au registre" />
                <MetricCard title="Sous-traitants" value={stats.subProcessors} subtitle={`${stats.dpaSigned} DPA signés`} />
                <MetricCard title="Données sensibles" value={stats.sensitiveDataCategories} subtitle="Catégories identifiées" />
                <MetricCard title="Rétention" value={retention.active} subtitle={`Leads actifs (Total: ${retention.total})`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AlertCard alertes={alertes} />

                <div className="bg-slate-900/50 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                    <p className="text-slate-300 mb-4 text-sm">
                        Consultez le registre complet pour voir le détail des traitements et effectuer les actions correctives.
                    </p>
                    <a
                        href="/prospection/rgpd"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
                    >
                        <span>🛡️</span> Ouvrir le Registre RGPD
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── Détails BPF ──────────────────────────────────────────────

function BPFDetail({ data }: { data: any }) {
    const report = data.report;
    if (!report) return <EmptyState />;

    const bf = report.bilanFinancier?.produitsFormation || {};
    const bp = report.bilanPedagogique || {};

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MetricCard title="Chiffre d'affaires" value={`${(bf.caTotal || 0).toLocaleString('fr-FR')}€`} subtitle="Formation HT">
                <div className="space-y-1 text-xs text-slate-400 mt-2">
                    <div className="flex justify-between"><span>OPCO</span><span>{(bf.caOPCO || 0).toLocaleString('fr-FR')}€</span></div>
                    <div className="flex justify-between"><span>CPF</span><span>{(bf.caCPF || 0).toLocaleString('fr-FR')}€</span></div>
                    <div className="flex justify-between"><span>Entreprise</span><span>{(bf.caEntreprise || 0).toLocaleString('fr-FR')}€</span></div>
                    <div className="flex justify-between"><span>Personnel</span><span>{(bf.caPersonnel || 0).toLocaleString('fr-FR')}€</span></div>
                </div>
            </MetricCard>

            <MetricCard title="Stagiaires" value={bp.totalStagiaires || 0} subtitle={`${bp.totalHeuresDispensees || 0}h dispensées`}>
                <div className="space-y-1 text-xs text-slate-400 mt-2">
                    <div className="flex justify-between"><span>Sessions</span><span>{bp.totalSessions || 0}</span></div>
                    <div className="flex justify-between"><span>Assiduité</span><span>{bp.tauxAssiduiteGlobal || 0}%</span></div>
                    <div className="flex justify-between"><span>Réussite</span><span>{bp.tauxReussite || 0}%</span></div>
                    <div className="flex justify-between"><span>Certificats</span><span>{bp.nbCertificatsGeneres || 0}</span></div>
                </div>
            </MetricCard>

            <AlertCard alertes={report.alertes || []} />
        </div>
    );
}

// ─── Détails DRIEETS ──────────────────────────────────────────

function DRIEETSDetail({ data }: { data: any }) {
    const report = data.report;
    if (!report) return <EmptyState />;

    const checklist: ChecklistItem[] = report.checklist || [];
    const okCount = checklist.filter(c => c.status === 'OK').length;
    const koCount = checklist.filter(c => c.status === 'KO').length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <MetricCard title="Obligations" value={`${okCount}/${checklist.length}`} subtitle="Validées" />
                <MetricCard title="Sites" value={report.sites?.length || 0} subtitle="Actifs" />
                <MetricCard title="Effectifs" value={report.effectifs?.totalMembres || 0} subtitle={`dont ${report.effectifs?.formateurs?.length || 0} formateurs`} />
            </div>

            {/* Checklist */}
            <div className="bg-slate-900/50 rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm text-slate-300">Checklist réglementaire</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-shrink-0 mt-0.5">
                                {item.status === 'OK' ? '✅' : item.status === 'PARTIEL' ? '⚠️' : item.status === 'KO' ? '❌' : '⬜'}
                            </span>
                            <div>
                                <span className="text-slate-200">{item.label}</span>
                                <span className="text-xs text-slate-500 ml-2">{item.reference}</span>
                                <div className="text-xs text-slate-400">{item.detail}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Synthèse */}
            {report.synthese && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {report.synthese.pointsForts?.length > 0 && (
                        <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-4">
                            <h4 className="text-sm font-medium text-emerald-400 mb-2">✅ Points forts</h4>
                            {report.synthese.pointsForts.map((p: string, i: number) => (
                                <div key={i} className="text-xs text-slate-300 mb-1">{p}</div>
                            ))}
                        </div>
                    )}
                    {report.synthese.pointsVigilance?.length > 0 && (
                        <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4">
                            <h4 className="text-sm font-medium text-amber-400 mb-2">⚠️ Vigilance</h4>
                            {report.synthese.pointsVigilance.map((p: string, i: number) => (
                                <div key={i} className="text-xs text-slate-300 mb-1">{p}</div>
                            ))}
                        </div>
                    )}
                    {report.synthese.recommandations?.length > 0 && (
                        <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4">
                            <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Recommandations</h4>
                            {report.synthese.recommandations.map((p: string, i: number) => (
                                <div key={i} className="text-xs text-slate-300 mb-1">{p}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Détails OPCO ─────────────────────────────────────────────

function OPCODetail({ data }: { data: any }) {
    const contrats = data.contrats || [];

    if (contrats.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">📭</div>
                <p>Aucun contrat OPCO sur cet exercice.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 rounded-xl p-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-700/50">
                            <th className="pb-3 font-medium">Session</th>
                            <th className="pb-3 font-medium">Programme</th>
                            <th className="pb-3 font-medium">OPCO</th>
                            <th className="pb-3 font-medium text-right">Stagiaires</th>
                            <th className="pb-3 font-medium text-right">Montant HT</th>
                            <th className="pb-3 font-medium text-center">Statut</th>
                            <th className="pb-3 font-medium text-center">Export</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {contrats.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 text-slate-200 font-mono text-xs">{c.sessionRef}</td>
                                <td className="py-3 text-slate-300">{c.programmeIntitule}</td>
                                <td className="py-3 text-slate-300">{c.financeurNom}</td>
                                <td className="py-3 text-right text-slate-200">{c.nbStagiaires}</td>
                                <td className="py-3 text-right text-slate-200 font-medium">
                                    {c.montantHT.toLocaleString('fr-FR')}€
                                </td>
                                <td className="py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                        ${c.status === 'CONTRACTUALISE' ? 'bg-emerald-900/50 text-emerald-400' :
                                            c.status === 'BROUILLON' ? 'bg-slate-700/50 text-slate-400' :
                                                'bg-amber-900/50 text-amber-400'}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="py-3 text-center">
                                    <button
                                        className="px-2 py-1 text-xs bg-cyan-900/30 text-cyan-400 rounded-lg
                                                   hover:bg-cyan-800/40 transition-colors border border-cyan-800/30"
                                    >
                                        📥
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Détails CPF ──────────────────────────────────────────────

function CPFDetail({ data }: { data: any }) {
    const recap = data.recap;
    if (!recap) return <EmptyState />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Programmes éligibles"
                    value={`${recap.eligibilite?.programmesEligibles || 0}/${recap.eligibilite?.totalProgrammes || 0}`}
                    subtitle="Certifications actives"
                />
                <MetricCard
                    title="Sessions EDOF"
                    value={recap.sessions?.declarables || 0}
                    subtitle={`sur ${recap.sessions?.total || 0} total`}
                />
                <MetricCard
                    title="Montant CPF"
                    value={`${(recap.financier?.montantTotalCPF || 0).toLocaleString('fr-FR')}€`}
                    subtitle={`Facturé: ${(recap.financier?.montantFacture || 0).toLocaleString('fr-FR')}€`}
                />
                <MetricCard
                    title="Rétractation"
                    value={`${recap.retractation?.tauxConformiteRetractation || 0}%`}
                    subtitle="Conformité 14 jours"
                />
            </div>

            {/* Éligibilité détaillée */}
            <div className="bg-slate-900/50 rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm text-slate-300">Éligibilité par programme</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(recap.eligibilite?.details || []).map((prog: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-shrink-0 mt-0.5">{prog.isEligible ? '✅' : '❌'}</span>
                            <div>
                                <span className="text-slate-200">{prog.reference} — {prog.intitule}</span>
                                <span className="text-xs text-slate-500 ml-2">{prog.certificationCode || 'Pas de certification'}</span>
                                {prog.raisons.map((r: string, j: number) => (
                                    <div key={j} className="text-xs text-slate-400">→ {r}</div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <AlertCard alertes={recap.alertes || []} />
        </div>
    );
}

// ─── Composants réutilisables ─────────────────────────────────

function MetricCard({ title, value, subtitle, children }: {
    title: string; value: string | number; subtitle: string; children?: React.ReactNode;
}) {
    return (
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider">{title}</div>
            <div className="text-2xl font-bold text-white mt-1">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
            {children}
        </div>
    );
}

function AlertCard({ alertes }: { alertes: string[] }) {
    if (alertes.length === 0) {
        return (
            <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                    <div className="font-medium text-emerald-400">Aucune alerte</div>
                    <div className="text-xs text-slate-400">Toutes les vérifications sont passées.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4">
            <div className="text-sm font-medium text-amber-400 mb-2">⚠️ Alertes ({alertes.length})</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
                {alertes.map((a, i) => (
                    <div key={i} className="text-xs text-slate-300">{a}</div>
                ))}
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📊</div>
            <p>Chargez les données pour voir les détails.</p>
        </div>
    );
}

// ─── Données initiales ───────────────────────────────────────

function getInitialModules(): ModuleStatus[] {
    return [
        {
            id: 'bpf',
            label: 'BPF',
            description: 'Cerfa 10443',
            icon: '📋',
            status: 'idle',
            score: null,
            details: 'Bilan Pédagogique et Financier',
            apiUrl: '/api/compliance/bpf',
            downloadUrl: '/api/compliance/bpf',
            color: 'bg-cyan-600',
        },
        {
            id: 'drieets',
            label: 'DRIEETS',
            description: 'Rapport annuel',
            icon: '🏛️',
            status: 'idle',
            score: null,
            details: 'Rapport annuel d\'activité',
            apiUrl: '/api/compliance/drieets',
            downloadUrl: '/api/compliance/drieets',
            color: 'bg-violet-600',
        },
        {
            id: 'opco',
            label: 'OPCO',
            description: 'Dossiers financement',
            icon: '💼',
            status: 'idle',
            score: null,
            details: 'Dossiers de financement OPCO',
            apiUrl: '/api/compliance/opco',
            downloadUrl: '/api/compliance/opco',
            color: 'bg-amber-600',
        },
        {
            id: 'cpf',
            label: 'CPF / CDC',
            description: 'Caisse des Dépôts',
            icon: '🎯',
            status: 'idle',
            score: null,
            details: 'Conformité CPF & EDOF',
            apiUrl: '/api/compliance/cpf',
            downloadUrl: '/api/compliance/cpf',
            color: 'bg-emerald-600',
        },
        {
            id: 'rgpd',
            label: 'RGPD',
            description: 'Registre Art. 30',
            icon: 'gdpr', // Will need to handle this icon in the component
            status: 'idle',
            score: null,
            details: 'Registre des traitements & conformité',
            apiUrl: '/api/rgpd/stats', // We'll need to use the stats API here
            downloadUrl: '/api/rgpd/registre',
            color: 'bg-blue-600',
        },
    ];
}

// ─── Composant Superviseur ───────────────────────────────────

function ComplianceSupervisor() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastScan, setLastScan] = useState<Date | null>(null);

    const runScan = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/compliance/supervisor/scan');
            const data = await res.json();
            if (data.success) {
                // Aplatir les résultats pour l'affichage
                const allAlerts = [
                    ...data.details.rgpd,
                    ...data.details.qualiopi,
                    ...data.details.bpf
                ];
                setAlerts(allAlerts);
                setLastScan(new Date(data.timestamp));
            }
        } catch (err) {
            console.error('Erreur scan superviseur:', err);
        } finally {
            setLoading(false);
        }
    };

    // Scan automatique au chargement
    useEffect(() => {
        runScan();
    }, []);

    if (loading && alerts.length === 0) {
        return (
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 backdrop-blur-sm animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-indigo-200 font-medium">L'agent superviseur analyse la conformité...</span>
                </div>
            </div>
        );
    }

    if (alerts.length === 0 && lastScan) {
        return (
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-900/40 to-slate-900/40 border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/20">
                            🤖
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">Superviseur actif</h3>
                            <p className="text-emerald-400 text-sm">Aucune anomalie critique détectée lors du dernier scan.</p>
                        </div>
                    </div>
                    <button
                        onClick={runScan}
                        className="px-4 py-2 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 rounded-lg text-emerald-300 text-sm transition-colors"
                    >
                        Relancer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl shadow-lg shadow-indigo-900/20 relative">
                        🤖
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                        </span>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white">Superviseur : Anomalies détectées</h3>
                        <p className="text-indigo-200 text-sm">
                            {alerts.length} alerte(s) nécessitant votre attention.
                        </p>
                    </div>
                </div>
                <button
                    onClick={runScan}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-900/30 hover:bg-indigo-800/40 border border-indigo-700/30 rounded-lg text-indigo-300 text-sm transition-colors flex items-center gap-2"
                >
                    {loading ? <span className="animate-spin">🔄</span> : '⚡'} Relancer le scan
                </button>
            </div>

            <div className="grid gap-3">
                {alerts.map((alert) => (
                    <div
                        key={alert.id}
                        className={`p-4 rounded-xl border flex items-start gap-4 transition-all hover:translate-x-1
                        ${alert.severity === 'CRITICAL' ? 'bg-red-950/20 border-red-500/20 hover:bg-red-900/20' :
                                alert.severity === 'WARNING' ? 'bg-amber-950/20 border-amber-500/20 hover:bg-amber-900/20' :
                                    'bg-blue-950/20 border-blue-500/20 hover:bg-blue-900/20'}`}
                    >
                        <div className="text-xl mt-0.5">
                            {alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️'}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                                ${alert.severity === 'CRITICAL' ? 'bg-red-900/50 text-red-200' :
                                        alert.severity === 'WARNING' ? 'bg-amber-900/50 text-amber-200' :
                                            'bg-blue-900/50 text-blue-200'}`}>
                                    {alert.module}
                                </span>
                                <h4 className={`font-medium ${alert.severity === 'CRITICAL' ? 'text-red-300' :
                                    alert.severity === 'WARNING' ? 'text-amber-300' :
                                        'text-blue-300'}`}>
                                    {alert.message}
                                </h4>
                            </div>
                            <p className="text-sm text-slate-400 mb-2">{alert.details}</p>
                            {alert.actionRequired && (
                                <a
                                    href={alert.actionRequired}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-white bg-slate-700/50 hover:bg-slate-600/50 px-2 py-1 rounded transition-colors"
                                >
                                    👉 Voir l'action requise
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

'use client';

/**
 * COMPOSANT DASHBOARD RGPD — Registre Art. 30
 * =============================================
 * Affiche le registre des traitements RGPD avec :
 *   - Vue d'ensemble et KPIs de conformité
 *   - Liste des traitements avec détails dépliables
 *   - Export du registre en texte ou JSON
 *   - Indicateurs visuels de conformité (DPA, DPIA, etc.)
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────

interface RegisterStats {
    totalTreatments: number;
    activeTreatments: number;
    totalRecipients: number;
    subProcessors: number;
    dpaSigned: number;
    dpaPending: number;
    dpaPendingNames: string[];
    totalDataCategories: number;
    sensitiveDataCategories: number;
    transfersOutsideEU: number;
    dpiaRequired: number;
    dpiaCompleted: number;
    lastUpdate: string;
    controllerConfigured: boolean;
    dpoDesignated: boolean;
}

interface Treatment {
    id: string;
    name: string;
    description: string;
    purpose: string[];
    legalBasis: string;
    legalBasisDetail: string;
    dataCategories: { category: string; fields: string[]; sensitivity: string }[];
    dataConcernedPersons: string[];
    recipients: { name: string; type: string; dpaStatus: string; country: string }[];
    retentionPeriod: string;
    retentionDetail: string;
    securityMeasures: string[];
    transfersOutsideEU: { country: string; mechanism: string; recipient: string }[];
    dpia: { required: boolean; completed: boolean; completedAt?: string; reference?: string };
    lastReviewDate: string;
    status: string;
}

interface Register {
    metadata: {
        organizationId: string;
        organizationName: string;
        registerVersion: string;
        lastUpdate: string;
        generatedBy: string;
        cnilReference: string;
    };
    controller: {
        name: string;
        siret?: string;
        address: string;
        representant: string;
        contactEmail: string;
    };
    dpo: { designated: boolean; name?: string; email?: string; phone?: string };
    treatments: Treatment[];
    generatedAt: string;
    version: string;
}

// ─── Composant Principal ──────────────────────────────────────

export default function RGPDRegisterDashboard() {
    const [stats, setStats] = useState<RegisterStats | null>(null);
    const [register, setRegister] = useState<Register | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedTreatment, setExpandedTreatment] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'treatments' | 'export'>('overview');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [statsRes, registerRes] = await Promise.all([
                fetch('/api/rgpd/registre?stats'),
                fetch('/api/rgpd/registre'),
            ]);

            if (!statsRes.ok || !registerRes.ok) {
                throw new Error('Erreur lors du chargement des données RGPD');
            }

            const statsData = await statsRes.json();
            const registerData = await registerRes.json();

            setStats(statsData.stats);
            setRegister(registerData.register);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={fetchData} />;
    if (!stats || !register) return null;

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '28px' }}>📋</span>
                    <h1 style={{
                        fontSize: '24px', fontWeight: '700',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        margin: 0,
                    }}>
                        Registre des Traitements — Article 30 RGPD
                    </h1>
                </div>
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                    Conforme au modèle CNIL v2 • Dernière mise à jour : {new Date(stats.lastUpdate).toLocaleDateString('fr-FR')}
                </p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: '4px', marginBottom: '24px',
                background: '#f3f4f6', borderRadius: '12px', padding: '4px',
            }}>
                {(['overview', 'treatments', 'export'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                            transition: 'all 0.2s',
                            background: activeTab === tab ? '#fff' : 'transparent',
                            color: activeTab === tab ? '#1f2937' : '#6b7280',
                            boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                    >
                        {tab === 'overview' && '📊 Vue d\'ensemble'}
                        {tab === 'treatments' && '📝 Traitements'}
                        {tab === 'export' && '📤 Export'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab stats={stats} register={register} />}
            {activeTab === 'treatments' && (
                <TreatmentsTab
                    treatments={register.treatments}
                    expanded={expandedTreatment}
                    onToggle={(id) => setExpandedTreatment(expandedTreatment === id ? null : id)}
                />
            )}
            {activeTab === 'export' && <ExportTab register={register} />}
        </div>
    );
}

// ─── Vue d'ensemble ───────────────────────────────────────────

function OverviewTab({ stats, register }: { stats: RegisterStats; register: Register }) {
    const complianceScore = calculateComplianceScore(stats);

    return (
        <div>
            {/* Score de conformité */}
            <div style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d4a7a 100%)',
                borderRadius: '16px', padding: '24px', marginBottom: '24px',
                color: '#fff',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', opacity: 0.9 }}>
                            Score de Conformité RGPD
                        </h2>
                        <p style={{ fontSize: '14px', margin: 0, opacity: 0.7 }}>
                            Basé sur la complétude du registre et la conformité des sous-traitants
                        </p>
                    </div>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `conic-gradient(${complianceScore >= 80 ? '#10b981' : complianceScore >= 60 ? '#f59e0b' : '#ef4444'} ${complianceScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: '#1e3a5f', display: 'flex', alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <span style={{ fontSize: '22px', fontWeight: '700' }}>
                                {complianceScore}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px', marginBottom: '24px',
            }}>
                <KPICard icon="📝" label="Traitements actifs" value={stats.activeTreatments} total={stats.totalTreatments} />
                <KPICard
                    icon="🤝" label="Sous-traitants (DPA)"
                    value={stats.dpaSigned} total={stats.subProcessors}
                    alert={stats.dpaPending > 0}
                    alertText={`${stats.dpaPending} DPA en attente`}
                />
                <KPICard icon="📁" label="Catégories de données" value={stats.totalDataCategories} />
                <KPICard
                    icon="🌍" label="Transferts hors UE"
                    value={stats.transfersOutsideEU}
                    success={stats.transfersOutsideEU === 0}
                />
                <KPICard
                    icon="👤" label="DPO désigné"
                    value={stats.dpoDesignated ? 'Oui' : 'Non'}
                    alert={!stats.dpoDesignated}
                    alertText="Recommandé par la CNIL"
                />
                <KPICard
                    icon="📋" label="AIPD réalisées"
                    value={stats.dpiaCompleted} total={stats.dpiaRequired}
                    success={stats.dpiaRequired === 0 || stats.dpiaCompleted >= stats.dpiaRequired}
                />
            </div>

            {/* Alertes */}
            {(stats.dpaPending > 0 || !stats.dpoDesignated || !stats.controllerConfigured) && (
                <div style={{
                    background: '#fef3c7', border: '1px solid #f59e0b',
                    borderRadius: '12px', padding: '16px', marginBottom: '24px',
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#92400e', margin: '0 0 8px 0' }}>
                        ⚠️ Points d'attention
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', fontSize: '14px' }}>
                        {stats.dpaPending > 0 && (
                            <li>
                                <strong>{stats.dpaPending} DPA</strong> en attente de signature :
                                {' '}{stats.dpaPendingNames.join(', ')}
                            </li>
                        )}
                        {!stats.dpoDesignated && (
                            <li>Aucun <strong>DPO</strong> désigné — recommandé par la CNIL pour les OF</li>
                        )}
                        {!stats.controllerConfigured && (
                            <li>Les informations du <strong>responsable de traitement</strong> doivent être complétées</li>
                        )}
                    </ul>
                </div>
            )}

            {/* Info Responsable */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            }}>
                <InfoCard
                    title="Responsable de Traitement"
                    icon="🏢"
                    items={[
                        { label: 'Organisation', value: register.controller.name },
                        { label: 'Représentant', value: register.controller.representant },
                        { label: 'Contact', value: register.controller.contactEmail },
                        ...(register.controller.siret ? [{ label: 'SIRET', value: register.controller.siret }] : []),
                    ]}
                />
                <InfoCard
                    title="DPO (Délégué à la Protection des Données)"
                    icon="🛡️"
                    items={
                        register.dpo.designated
                            ? [
                                { label: 'Nom', value: register.dpo.name || '-' },
                                { label: 'Email', value: register.dpo.email || '-' },
                                { label: 'Téléphone', value: register.dpo.phone || '-' },
                            ]
                            : [{ label: 'Statut', value: 'Non désigné' }]
                    }
                />
            </div>
        </div>
    );
}

// ─── Liste des traitements ────────────────────────────────────

function TreatmentsTab({
    treatments, expanded, onToggle,
}: {
    treatments: Treatment[];
    expanded: string | null;
    onToggle: (id: string) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {treatments.map(t => (
                <TreatmentCard key={t.id} treatment={t} expanded={expanded === t.id} onToggle={() => onToggle(t.id)} />
            ))}
        </div>
    );
}

function TreatmentCard({
    treatment: t, expanded, onToggle,
}: {
    treatment: Treatment;
    expanded: boolean;
    onToggle: () => void;
}) {
    const statusColor = t.status === 'ACTIVE' ? '#10b981' : t.status === 'INACTIVE' ? '#6b7280' : '#f59e0b';

    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
            overflow: 'hidden', transition: 'box-shadow 0.2s',
            boxShadow: expanded ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        }}>
            {/* Header cliquable */}
            <button
                onClick={onToggle}
                style={{
                    width: '100%', padding: '16px 20px', border: 'none', background: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px',
                    textAlign: 'left',
                }}
            >
                <span style={{
                    fontSize: '11px', fontWeight: '700', color: '#6b7280',
                    background: '#f3f4f6', borderRadius: '6px', padding: '4px 8px',
                    fontFamily: 'monospace',
                }}>
                    {t.id}
                </span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>{t.name}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{t.legalBasis}</div>
                </div>
                <span style={{
                    fontSize: '11px', fontWeight: '600', color: statusColor,
                    background: `${statusColor}15`, borderRadius: '20px', padding: '4px 10px',
                }}>
                    {t.status}
                </span>
                <span style={{
                    fontSize: '16px', transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                    ▼
                </span>
            </button>

            {/* Détails dépliables */}
            {expanded && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '14px', color: '#4b5563', marginTop: '16px', lineHeight: '1.5' }}>
                        {t.description}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
                        {/* Finalités */}
                        <DetailSection title="📌 Finalités" items={t.purpose} />

                        {/* Personnes concernées */}
                        <DetailSection title="👥 Personnes concernées" items={t.dataConcernedPersons} />

                        {/* Catégories de données */}
                        <div>
                            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                📁 Catégories de données
                            </h4>
                            {t.dataCategories.map((cat, i) => (
                                <div key={i} style={{ marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#1f2937' }}>{cat.category}</span>
                                        <span style={{
                                            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                                            background: cat.sensitivity === 'STANDARD' ? '#dbeafe' : '#fef3c7',
                                            color: cat.sensitivity === 'STANDARD' ? '#1e40af' : '#92400e',
                                        }}>
                                            {cat.sensitivity}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                        {cat.fields.join(' • ')}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Destinataires */}
                        <div>
                            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                📨 Destinataires
                            </h4>
                            {t.recipients.map((r, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '13px', color: '#4b5563', marginBottom: '4px',
                                }}>
                                    <span style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: r.type === 'INTERNAL' ? '#10b981'
                                            : r.type === 'SUBPROCESSOR' ? '#3b82f6'
                                                : r.type === 'PARTNER' ? '#8b5cf6'
                                                    : '#6b7280',
                                    }} />
                                    <span>{r.name}</span>
                                    {r.dpaStatus !== 'NOT_REQUIRED' && (
                                        <span style={{
                                            fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                            background: r.dpaStatus === 'SIGNED' ? '#d1fae5' : '#fef3c7',
                                            color: r.dpaStatus === 'SIGNED' ? '#065f46' : '#92400e',
                                        }}>
                                            DPA: {r.dpaStatus === 'SIGNED' ? '✓ Signé' : '⏳ En attente'}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Conservation */}
                        <DetailBlock title="⏳ Conservation" main={t.retentionPeriod} detail={t.retentionDetail} />

                        {/* Base légale */}
                        <DetailBlock title="⚖️ Base légale" main={t.legalBasis} detail={t.legalBasisDetail} />
                    </div>

                    {/* Sécurité */}
                    <div style={{ marginTop: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                            🔒 Mesures de sécurité
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {t.securityMeasures.map((m, i) => (
                                <span key={i} style={{
                                    fontSize: '12px', padding: '4px 10px',
                                    background: '#f0fdf4', color: '#166534', borderRadius: '20px',
                                    border: '1px solid #bbf7d0',
                                }}>
                                    ✓ {m}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Transferts hors UE */}
                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                        🌍 Transferts hors UE : {t.transfersOutsideEU.length === 0 ? (
                            <span style={{ color: '#10b981' }}>Aucun ✓</span>
                        ) : (
                            t.transfersOutsideEU.map((tr, i) => (
                                <span key={i}>{tr.country} ({tr.recipient}) — {tr.mechanism}</span>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Export ───────────────────────────────────────────────────

function ExportTab({ register }: { register: Register }) {
    const [downloading, setDownloading] = useState(false);

    const handleExport = async (format: 'json' | 'text') => {
        setDownloading(true);
        try {
            if (format === 'text') {
                const res = await fetch('/api/rgpd/registre?format=text');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `registre-art30-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = new Blob([JSON.stringify(register, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `registre-art30-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div>
            <div style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                padding: '24px',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: '0 0 8px 0' }}>
                    📤 Exporter le registre des traitements
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                    Téléchargez le registre complet au format de votre choix.
                    Le format texte est recommandé pour l'impression et l'archivage physique.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <ExportButton
                        icon="📄"
                        label="Export Texte (CNIL)"
                        description="Format lisible, idéal pour impression et archivage"
                        onClick={() => handleExport('text')}
                        disabled={downloading}
                        primary
                    />
                    <ExportButton
                        icon="{ }"
                        label="Export JSON"
                        description="Format structuré, idéal pour intégration système"
                        onClick={() => handleExport('json')}
                        disabled={downloading}
                    />
                </div>
            </div>

            {/* Informations légales */}
            <div style={{
                marginTop: '16px', background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: '12px', padding: '16px',
            }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', margin: '0 0 8px 0' }}>
                    ℹ️ Obligation de tenue
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1e40af', lineHeight: '1.8' }}>
                    <li>Le registre doit être tenu à jour et présenté sur demande de la CNIL (Art. 30.4)</li>
                    <li>Les organismes de formation &gt; 250 salariés doivent obligatoirement tenir un registre</li>
                    <li>Les organismes &lt; 250 salariés traitant des données sensibles ou à risque doivent aussi le tenir</li>
                    <li>Ce registre est automatiquement enrichi avec les données en temps réel de votre plateforme</li>
                </ul>
            </div>

            {/* Métadonnées */}
            <div style={{
                marginTop: '16px', background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: '12px', padding: '16px', fontSize: '13px', color: '#6b7280',
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><strong>Version :</strong> {register.version}</div>
                    <div><strong>Référence CNIL :</strong> {register.metadata.cnilReference}</div>
                    <div><strong>Généré par :</strong> {register.metadata.generatedBy}</div>
                    <div><strong>Date :</strong> {new Date(register.generatedAt).toLocaleDateString('fr-FR', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}</div>
                </div>
            </div>
        </div>
    );
}

// ─── Sous-composants ──────────────────────────────────────────

function KPICard({
    icon, label, value, total, alert, alertText, success,
}: {
    icon: string;
    label: string;
    value: number | string;
    total?: number;
    alert?: boolean;
    alertText?: string;
    success?: boolean;
}) {
    return (
        <div style={{
            background: '#fff', border: `1px solid ${alert ? '#fbbf24' : success ? '#6ee7b7' : '#e5e7eb'}`,
            borderRadius: '12px', padding: '16px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <span style={{ fontSize: '24px' }}>{icon}</span>
                {alert && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>Attention</span>}
                {success && <span style={{ fontSize: '10px', background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>OK</span>}
            </div>
            <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#1f2937' }}>
                    {value}{total !== undefined && <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '400' }}>/{total}</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
                {alertText && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>⚠️ {alertText}</div>}
            </div>
        </div>
    );
}

function InfoCard({
    title, icon, items,
}: {
    title: string;
    icon: string;
    items: { label: string; value: string }[];
}) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '12px', padding: '16px',
        }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 12px 0' }}>
                {icon} {title}
            </h3>
            {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>{item.label}</span>
                    <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: '500' }}>{item.value}</span>
                </div>
            ))}
        </div>
    );
}

function DetailSection({ title, items }: { title: string; items: string[] }) {
    return (
        <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{title}</h4>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: '#4b5563' }}>
                {items.map((it, i) => <li key={i} style={{ marginBottom: '2px' }}>{it}</li>)}
            </ul>
        </div>
    );
}

function DetailBlock({ title, main, detail }: { title: string; main: string; detail: string }) {
    return (
        <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>{title}</h4>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{main}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', lineHeight: '1.5' }}>{detail}</div>
        </div>
    );
}

function ExportButton({
    icon, label, description, onClick, disabled, primary,
}: {
    icon: string;
    label: string;
    description: string;
    onClick: () => void;
    disabled: boolean;
    primary?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                flex: 1, padding: '16px', borderRadius: '12px', border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                transition: 'all 0.2s',
                background: primary ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#f9fafb',
                color: primary ? '#fff' : '#1f2937',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{icon}</div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{label}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{description}</div>
        </button>
    );
}

function LoadingState() {
    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: '400px', color: '#6b7280',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '40px', height: '40px', border: '3px solid #e5e7eb',
                    borderTopColor: '#3b82f6', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                }} />
                <p>Chargement du registre RGPD...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: '400px',
        }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                <span style={{ fontSize: '48px' }}>⚠️</span>
                <h3 style={{ color: '#dc2626', margin: '16px 0 8px' }}>Erreur</h3>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>{message}</p>
                <button
                    onClick={onRetry}
                    style={{
                        marginTop: '16px', padding: '10px 24px', borderRadius: '8px',
                        border: 'none', background: '#3b82f6', color: '#fff',
                        cursor: 'pointer', fontWeight: '600',
                    }}
                >
                    Réessayer
                </button>
            </div>
        </div>
    );
}

// ─── Utilitaires ──────────────────────────────────────────────

function calculateComplianceScore(stats: RegisterStats): number {
    let score = 0;
    let maxScore = 0;

    // Traitements documentés (30 points)
    maxScore += 30;
    score += stats.activeTreatments > 0 ? 30 : 0;

    // DPA sous-traitants (25 points)
    if (stats.subProcessors > 0) {
        maxScore += 25;
        score += Math.round((stats.dpaSigned / stats.subProcessors) * 25);
    } else {
        maxScore += 25;
        score += 25; // Pas de sous-traitants = pas de risque
    }

    // DPO désigné (15 points)
    maxScore += 15;
    score += stats.dpoDesignated ? 15 : 0;

    // Responsable de traitement configuré (15 points)
    maxScore += 15;
    score += stats.controllerConfigured ? 15 : 0;

    // Pas de transferts hors UE (10 points)
    maxScore += 10;
    score += stats.transfersOutsideEU === 0 ? 10 : 5;

    // AIPD (5 points)
    maxScore += 5;
    if (stats.dpiaRequired === 0) {
        score += 5;
    } else {
        score += Math.round((stats.dpiaCompleted / stats.dpiaRequired) * 5);
    }

    return Math.round((score / maxScore) * 100);
}

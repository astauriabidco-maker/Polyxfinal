/**
 * PARTENAIRES API — Page de gestion complète
 * =============================================
 * Workflow complet :
 *   1. Admin crée le partenaire (PENDING, pas de clé API)
 *   2. Email d'onboarding envoyé au partenaire
 *   3. Partenaire signe Contrat + DPA
 *   4. Admin active le partenaire → clé API générée
 *   5. Email avec clé API envoyé
 * 
 * Design premium dark mode cohérent avec Polyx ERP.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';

// ─── Types ────────────────────────────────────────────────────

interface Partner {
    id: string;
    companyName: string;
    formeJuridique: string | null;
    capitalSocial: number | null;
    siret: string | null;
    siren: string | null;
    codeNAF: string | null;
    rcs: string | null;
    tvaIntracom: string | null;
    adresse: string | null;
    complementAdresse: string | null;
    codePostal: string | null;
    ville: string | null;
    pays: string;
    representantNom: string | null;
    representantFonction: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    iban: string | null;
    bic: string | null;
    apiKeyPrefix: string;
    rateLimit: number;
    webhookUrl: string | null;
    contractUrl: string | null;
    contractSignedAt: string | null;
    contractExpiresAt: string | null;
    dpaSignedAt: string | null;
    ndaSignedAt: string | null;
    commissionRate: number | null;
    notes: string | null;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
    totalLeadsSubmitted: number;
    totalLeadsConverted: number;
    leadsCount: number;
    createdAt: string;
    updatedAt: string;
}

interface FormData {
    companyName: string;
    formeJuridique: string;
    capitalSocial: string;
    siret: string;
    codeNAF: string;
    rcs: string;
    tvaIntracom: string;
    adresse: string;
    complementAdresse: string;
    codePostal: string;
    ville: string;
    pays: string;
    representantNom: string;
    representantFonction: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    iban: string;
    bic: string;
    rateLimit: number;
    webhookUrl: string;
    commissionRate: string;
    notes: string;
}

// ─── Constantes ───────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    PENDING: { label: 'En attente', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/30', icon: '⏳' },
    ACTIVE: { label: 'Actif', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/30', icon: '✅' },
    SUSPENDED: { label: 'Suspendu', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30', icon: '⚠️' },
    TERMINATED: { label: 'Résilié', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30', icon: '❌' },
};

const FORMES_JURIDIQUES = [
    '', 'SAS', 'SASU', 'SARL', 'EURL', 'SA', 'SCI', 'SNC', 'SCOP',
    'Association Loi 1901', 'Auto-entrepreneur', 'Micro-entreprise', 'Autre',
];

const FONCTIONS_REP = [
    '', 'Président(e)', 'Gérant(e)', 'Directeur(trice) Général(e)', 'Administrateur(trice)',
    'Associé(e) Gérant(e)', 'Co-Gérant(e)', 'Mandataire',
];

const INITIAL_FORM: FormData = {
    companyName: '', formeJuridique: '', capitalSocial: '', siret: '', codeNAF: '',
    rcs: '', tvaIntracom: '', adresse: '', complementAdresse: '', codePostal: '',
    ville: '', pays: 'France', representantNom: '', representantFonction: '',
    contactName: '', contactEmail: '', contactPhone: '', iban: '', bic: '',
    rateLimit: 100, webhookUrl: '', commissionRate: '', notes: '',
};

// ─── Composants réutilisables ─────────────────────────────────

function FormSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 pb-2 border-b border-slate-700/50">
                <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs">{icon}</span>
                {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {children}
            </div>
        </div>
    );
}

function FormInput({
    label, name, value, onChange, required, type = 'text', placeholder, colSpan, error, maxLength,
}: {
    label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean; type?: string; placeholder?: string; colSpan?: number; error?: string[];
    maxLength?: number;
}) {
    return (
        <div style={colSpan ? { gridColumn: `span ${colSpan}` } : undefined}>
            <label htmlFor={name} className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            <input
                id={name} name={name} type={type} required={required} value={value}
                onChange={onChange} placeholder={placeholder} maxLength={maxLength}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border text-white text-sm placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 ${error ? 'border-red-500/50' : 'border-slate-700/70'}`}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error[0]}</p>}
        </div>
    );
}

function FormSelect({
    label, name, value, onChange, options, placeholder,
}: {
    label: string; name: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[]; placeholder?: string;
}) {
    return (
        <div>
            <label htmlFor={name} className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
            <select id={name} name={name} value={value} onChange={onChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70 text-white text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 appearance-none cursor-pointer">
                <option value="">{placeholder || 'Sélectionner...'}</option>
                {options.filter(o => o !== '').map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

// ─── Workflow Steps Component ─────────────────────────────────

function WorkflowSteps({ partner }: { partner: Partner }) {
    const steps = [
        { label: 'Fiche créée', done: true, icon: '📝' },
        { label: 'Email envoyé', done: true, icon: '📧' },
        { label: 'Contrat signé', done: !!partner.contractSignedAt, icon: '📄' },
        { label: 'DPA signé', done: !!partner.dpaSignedAt, icon: '🛡️' },
        { label: 'Activé', done: partner.status === 'ACTIVE', icon: '🔑' },
    ];

    return (
        <div className="flex items-center gap-1">
            {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                    <div title={step.label} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border transition-all ${step.done ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>
                        {step.done ? '✓' : step.icon}
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`w-3 h-0.5 rounded ${step.done ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Page Component ───────────────────────────────────────────

export default function PartnersPage() {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    // Modal clé API (après activation ou régénération)
    const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
    const [keyCopied, setKeyCopied] = useState(false);

    // ─── Fetch ────────────────────────────────────────────────

    const fetchPartners = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/partners');
            if (!res.ok) {
                if (res.status === 403) { setError('Accès refusé. Rôle ADMIN requis.'); return; }
                throw new Error('Erreur serveur');
            }
            const data = await res.json();
            setPartners(data.partners || []);
        } catch {
            setError('Impossible de charger les partenaires.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchPartners(); }, [fetchPartners]);

    // ─── Handlers ─────────────────────────────────────────────

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: name === 'rateLimit' ? parseInt(value) || 100 : value }));
        if (fieldErrors[name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setFieldErrors({});
        setSuccessMessage(null);

        try {
            const payload: Record<string, unknown> = {
                companyName: formData.companyName,
                contactName: formData.contactName,
                contactEmail: formData.contactEmail,
                rateLimit: formData.rateLimit,
                pays: formData.pays || 'France',
            };

            const optionalStrings: (keyof FormData)[] = [
                'formeJuridique', 'siret', 'codeNAF', 'rcs', 'tvaIntracom',
                'adresse', 'complementAdresse', 'codePostal', 'ville',
                'representantNom', 'representantFonction',
                'contactPhone', 'iban', 'bic', 'webhookUrl', 'notes',
            ];
            for (const key of optionalStrings) {
                if (formData[key]) payload[key] = formData[key];
            }
            if (formData.capitalSocial) payload.capitalSocial = parseFloat(formData.capitalSocial);
            if (formData.commissionRate) payload.commissionRate = parseFloat(formData.commissionRate);

            const res = await fetch('/api/partners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.details) setFieldErrors(data.details);
                setError(data.error || 'Erreur lors de la création');
                return;
            }

            setSuccessMessage(data.message);
            await fetchPartners();
            setFormData(INITIAL_FORM);
            setShowForm(false);
        } catch {
            setError('Erreur réseau. Veuillez réessayer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Partner Actions ──────────────────────────────────────

    const handlePartnerAction = async (partnerId: string, action: string, body: Record<string, unknown>) => {
        setActionLoading(`${partnerId}-${action}`);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch(`/api/partners/${partnerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Erreur');
                return;
            }

            setSuccessMessage(data.message);

            // Si une clé API a été générée, l'afficher dans le modal
            if (data.apiKey) {
                setRevealedApiKey(data.apiKey);
            }

            await fetchPartners();

            // Mettre à jour la modale de détail si ouverte
            if (selectedPartner?.id === partnerId) {
                const updatedPartner = (await (await fetch('/api/partners')).json()).partners?.find((p: Partner) => p.id === partnerId);
                if (updatedPartner) setSelectedPartner(updatedPartner);
            }
        } catch {
            setError('Erreur réseau.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCopyKey = async () => {
        if (!revealedApiKey) return;
        try {
            await navigator.clipboard.writeText(revealedApiKey);
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 3000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = revealedApiKey;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 3000);
        }
    };

    // ─── Stats ───────────────────────────────────────────

    const stats = {
        total: partners.length,
        active: partners.filter((p) => p.status === 'ACTIVE').length,
        pending: partners.filter((p) => p.status === 'PENDING').length,
        totalLeads: partners.reduce((acc, p) => acc + p.totalLeadsSubmitted, 0),
    };

    // ─── Render ───────────────────────────────────────────────

    return (
        <DashboardLayout>
            <div className="p-8">
                {/* ═══ Header ═══ */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-lg shadow-lg shadow-violet-500/20">🤝</span>
                            Partenaires API
                        </h1>
                        <p className="text-slate-400 mt-1">Gérez vos partenaires d&apos;ingestion de leads et leurs clés API</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/prospection/partners/templates"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/30 font-medium text-sm transition-all duration-200"
                        >
                            📝 Templates
                        </Link>
                        <button onClick={() => { setShowForm(!showForm); setSelectedPartner(null); setError(null); setFieldErrors({}); setSuccessMessage(null); }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                            </svg>
                            {showForm ? 'Annuler' : 'Nouveau Partenaire'}
                        </button>
                    </div>
                </div>

                {/* ═══ Stats Cards ═══ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total', value: stats.total, icon: '📊', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30' },
                        { label: 'Actifs', value: stats.active, icon: '✅', gradient: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/30' },
                        { label: 'En attente', value: stats.pending, icon: '⏳', gradient: 'from-amber-500/20 to-yellow-500/20', border: 'border-amber-500/30' },
                        { label: 'Leads reçus', value: stats.totalLeads, icon: '📥', gradient: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/30' },
                    ].map((stat) => (
                        <div key={stat.label} className={`bg-gradient-to-br ${stat.gradient} border ${stat.border} rounded-xl p-5 backdrop-blur-sm`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">{stat.label}</p>
                                    <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                                </div>
                                <span className="text-2xl">{stat.icon}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ═══ API Key Reveal Modal (après activation/régénération) ═══ */}
                {revealedApiKey && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-8 max-w-xl w-full shadow-2xl shadow-amber-500/10">
                            <div className="text-center mb-6">
                                <span className="text-4xl mb-3 block">🔑</span>
                                <h2 className="text-xl font-bold text-white">Clé API générée</h2>
                                <p className="text-amber-400 text-sm mt-2 font-medium">
                                    ⚠️ Copiez cette clé maintenant — elle ne sera plus jamais affichée !
                                </p>
                                <p className="text-slate-500 text-xs mt-1">
                                    La clé a aussi été envoyée par email au partenaire.
                                </p>
                            </div>
                            <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 mb-6">
                                <code className="text-emerald-400 text-sm break-all font-mono leading-relaxed">{revealedApiKey}</code>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleCopyKey} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${keyCopied ? 'bg-emerald-600 text-white' : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25'}`}>
                                    {keyCopied ? '✓ Copié !' : '📋 Copier la clé'}
                                </button>
                                <button onClick={() => { setRevealedApiKey(null); setKeyCopied(false); }}
                                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">Fermer</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Messages ═══ */}
                {successMessage && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-start gap-3">
                        <span className="mt-0.5">✅</span>
                        <div>
                            <span>{successMessage}</span>
                            <button onClick={() => setSuccessMessage(null)} className="ml-4 text-xs text-emerald-600 hover:text-emerald-400">✕</button>
                        </div>
                    </div>
                )}
                {error && !showForm && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3">
                        <span className="mt-0.5">⚠️</span>
                        <div>
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="ml-4 text-xs text-red-600 hover:text-red-400">✕</button>
                        </div>
                    </div>
                )}

                {/* ═══ Creation Form ═══ */}
                {showForm && (
                    <div className="mb-8 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">➕</span>
                            Fiche Partenaire — Personne Morale
                        </h2>
                        <p className="text-slate-500 text-xs mb-6">
                            Un email d&apos;onboarding sera envoyé au partenaire pour la signature du Contrat et du DPA.
                            La clé API sera générée uniquement après activation.
                        </p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <FormSection title="Identification de la personne morale" icon="🏢">
                                <FormInput label="Raison Sociale" name="companyName" value={formData.companyName} onChange={handleChange} required placeholder="Ex: FormaPro SAS" error={fieldErrors.companyName} />
                                <FormSelect label="Forme Juridique" name="formeJuridique" value={formData.formeJuridique} onChange={handleChange} options={FORMES_JURIDIQUES} />
                                <FormInput label="Capital Social (€)" name="capitalSocial" value={formData.capitalSocial} onChange={handleChange} type="number" placeholder="10000" />
                                <FormInput label="SIRET (14 chiffres)" name="siret" value={formData.siret} onChange={handleChange} placeholder="12345678901234" maxLength={14} error={fieldErrors.siret} />
                                <FormInput label="Code NAF / APE" name="codeNAF" value={formData.codeNAF} onChange={handleChange} placeholder="8559A" maxLength={10} />
                                <FormInput label="RCS" name="rcs" value={formData.rcs} onChange={handleChange} placeholder="RCS Paris B 123 456 789" />
                                <FormInput label="N° TVA Intracommunautaire" name="tvaIntracom" value={formData.tvaIntracom} onChange={handleChange} placeholder="FR12345678901" maxLength={20} />
                            </FormSection>

                            <FormSection title="Adresse du siège social" icon="📍">
                                <FormInput label="Adresse" name="adresse" value={formData.adresse} onChange={handleChange} placeholder="123 Avenue des Champs-Élysées" colSpan={2} />
                                <FormInput label="Complément" name="complementAdresse" value={formData.complementAdresse} onChange={handleChange} placeholder="Bâtiment B, Étage 3" />
                                <FormInput label="Code Postal" name="codePostal" value={formData.codePostal} onChange={handleChange} placeholder="75008" maxLength={10} />
                                <FormInput label="Ville" name="ville" value={formData.ville} onChange={handleChange} placeholder="Paris" />
                                <FormInput label="Pays" name="pays" value={formData.pays} onChange={handleChange} placeholder="France" />
                            </FormSection>

                            <FormSection title="Représentant légal" icon="👤">
                                <FormInput label="Nom complet" name="representantNom" value={formData.representantNom} onChange={handleChange} placeholder="M. Jean Martin" />
                                <FormSelect label="Fonction" name="representantFonction" value={formData.representantFonction} onChange={handleChange} options={FONCTIONS_REP} />
                            </FormSection>

                            <FormSection title="Contact opérationnel (technique / leads)" icon="📞">
                                <FormInput label="Nom du Contact" name="contactName" value={formData.contactName} onChange={handleChange} required placeholder="Marie Dupont" error={fieldErrors.contactName} />
                                <FormInput label="Email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} required type="email" placeholder="contact@formapro.com" error={fieldErrors.contactEmail} />
                                <FormInput label="Téléphone" name="contactPhone" value={formData.contactPhone} onChange={handleChange} type="tel" placeholder="06 12 34 56 78" />
                            </FormSection>

                            <FormSection title="Coordonnées bancaires (facturation)" icon="🏦">
                                <FormInput label="IBAN" name="iban" value={formData.iban} onChange={handleChange} placeholder="FR76 1234 5678 9012 3456 7890 123" maxLength={34} />
                                <FormInput label="BIC / SWIFT" name="bic" value={formData.bic} onChange={handleChange} placeholder="BNPAFRPPXXX" maxLength={11} />
                                <FormInput label="Taux de commission (%)" name="commissionRate" value={formData.commissionRate} onChange={handleChange} type="number" placeholder="15" />
                            </FormSection>

                            <FormSection title="Configuration technique" icon="⚙️">
                                <FormInput label="Limite de requêtes / heure" name="rateLimit" value={formData.rateLimit} onChange={handleChange} type="number" />
                                <FormInput label="URL Webhook (notifications)" name="webhookUrl" value={formData.webhookUrl} onChange={handleChange} type="url" placeholder="https://partner.com/webhook" colSpan={2} />
                            </FormSection>

                            <div className="mb-6">
                                <label htmlFor="notes" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Notes internes</label>
                                <textarea id="notes" name="notes" rows={3} value={formData.notes} onChange={handleChange}
                                    placeholder="Notes libres sur ce partenaire..."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70 text-white text-sm placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none" />
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-slate-700/50">
                                <p className="text-xs text-slate-500">
                                    Les champs marqués <span className="text-red-400">*</span> sont obligatoires.
                                    L&apos;email d&apos;onboarding sera envoyé automatiquement.
                                </p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => { setShowForm(false); setError(null); setFieldErrors({}); }}
                                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">Annuler</button>
                                    <button type="submit" disabled={isSubmitting}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isSubmitting ? (
                                            <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Création en cours...</>
                                        ) : (
                                            <>📧 Créer et envoyer l&apos;onboarding</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* ═══ Partner Detail Modal ═══ */}
                {selectedPartner && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
                            <div className="sticky top-0 bg-slate-900 p-6 pb-4 border-b border-slate-700/50 flex items-center justify-between z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedPartner.companyName}</h2>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {selectedPartner.formeJuridique || '—'} {selectedPartner.capitalSocial ? `· ${selectedPartner.capitalSocial.toLocaleString('fr-FR')} €` : ''}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedPartner(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                {/* Status + Workflow */}
                                <div className="flex items-center justify-between">
                                    {(() => {
                                        const s = STATUS_CONFIG[selectedPartner.status] || STATUS_CONFIG.PENDING; return (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${s.bgColor} ${s.color}`}>{s.icon} {s.label}</span>
                                        );
                                    })()}
                                    <WorkflowSteps partner={selectedPartner} />
                                </div>

                                {/* Boutons d'action contextuel */}
                                <div className="flex gap-2 flex-wrap">
                                    {selectedPartner.status === 'PENDING' && selectedPartner.contractSignedAt && selectedPartner.dpaSignedAt && (
                                        <button onClick={() => handlePartnerAction(selectedPartner.id, 'activate', { status: 'ACTIVE' })}
                                            disabled={actionLoading === `${selectedPartner.id}-activate`}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                                            {actionLoading === `${selectedPartner.id}-activate` ? '...' : '✅ Activer et générer la clé API'}
                                        </button>
                                    )}
                                    {selectedPartner.status === 'PENDING' && (!selectedPartner.contractSignedAt || !selectedPartner.dpaSignedAt) && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl">
                                                ⏳ En attente de la signature {!selectedPartner.contractSignedAt && !selectedPartner.dpaSignedAt ? 'du Contrat et DPA' : !selectedPartner.contractSignedAt ? 'du Contrat' : 'du DPA'}
                                            </span>
                                            <button onClick={() => handlePartnerAction(selectedPartner.id, 'resend', { action: 'resend-onboarding' })}
                                                disabled={actionLoading === `${selectedPartner.id}-resend`}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50">
                                                📧 Renvoyer l&apos;email
                                            </button>
                                        </div>
                                    )}
                                    {selectedPartner.status === 'ACTIVE' && (
                                        <>
                                            <a href={`/api/partners/${selectedPartner.id}/api-doc`}
                                                download
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-medium transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02]">
                                                📥 Documentation API
                                            </a>
                                            <button onClick={() => handlePartnerAction(selectedPartner.id, 'regen', { action: 'regenerate-key' })}
                                                disabled={actionLoading === `${selectedPartner.id}-regen`}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50">
                                                🔄 Régénérer la clé
                                            </button>
                                            <button onClick={() => handlePartnerAction(selectedPartner.id, 'suspend', { status: 'SUSPENDED' })}
                                                disabled={actionLoading === `${selectedPartner.id}-suspend`}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium transition-colors disabled:opacity-50">
                                                ⚠️ Suspendre
                                            </button>
                                        </>
                                    )}
                                    {selectedPartner.status === 'SUSPENDED' && (
                                        <button onClick={() => handlePartnerAction(selectedPartner.id, 'reactivate', { status: 'ACTIVE' })}
                                            disabled={actionLoading === `${selectedPartner.id}-reactivate`}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                                            ✅ Réactiver
                                        </button>
                                    )}
                                </div>

                                {/* API Key prefix + Doc Download */}
                                {selectedPartner.apiKeyPrefix && selectedPartner.apiKeyPrefix !== '' && (
                                    <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-xs text-slate-500">🔑 Clé API :</span>
                                            <code className="text-xs text-emerald-400 bg-slate-900 px-2.5 py-1 rounded-lg font-mono">{selectedPartner.apiKeyPrefix}...</code>
                                        </div>
                                        <a href={`/api/partners/${selectedPartner.id}/api-doc`}
                                            download
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition-all hover:scale-[1.02]">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Télécharger la doc API
                                        </a>
                                    </div>
                                )}

                                {/* Détails grille */}
                                {[
                                    {
                                        title: '🏢 Identification', items: [
                                            { label: 'SIRET', value: selectedPartner.siret },
                                            { label: 'SIREN', value: selectedPartner.siren },
                                            { label: 'Code NAF', value: selectedPartner.codeNAF },
                                            { label: 'RCS', value: selectedPartner.rcs },
                                            { label: 'TVA Intracom.', value: selectedPartner.tvaIntracom },
                                        ]
                                    },
                                    {
                                        title: '📍 Siège social', items: [
                                            { label: 'Adresse', value: [selectedPartner.adresse, selectedPartner.complementAdresse].filter(Boolean).join(', ') },
                                            { label: 'Ville', value: [selectedPartner.codePostal, selectedPartner.ville].filter(Boolean).join(' ') },
                                            { label: 'Pays', value: selectedPartner.pays },
                                        ]
                                    },
                                    {
                                        title: '👤 Représentant légal', items: [
                                            { label: 'Nom', value: selectedPartner.representantNom },
                                            { label: 'Fonction', value: selectedPartner.representantFonction },
                                        ]
                                    },
                                    {
                                        title: '📞 Contact opérationnel', items: [
                                            { label: 'Nom', value: selectedPartner.contactName },
                                            { label: 'Email', value: selectedPartner.contactEmail },
                                            { label: 'Téléphone', value: selectedPartner.contactPhone },
                                        ]
                                    },
                                    {
                                        title: '📄 Conformité', items: [
                                            { label: 'Contrat', value: selectedPartner.contractSignedAt ? `✅ Signé le ${new Date(selectedPartner.contractSignedAt).toLocaleDateString('fr-FR')}` : '❌ Non signé' },
                                            { label: 'DPA (RGPD)', value: selectedPartner.dpaSignedAt ? `✅ Signé le ${new Date(selectedPartner.dpaSignedAt).toLocaleDateString('fr-FR')}` : '❌ Non signé' },
                                            { label: 'NDA', value: selectedPartner.ndaSignedAt ? `✅ Signé le ${new Date(selectedPartner.ndaSignedAt).toLocaleDateString('fr-FR')}` : '—' },
                                        ]
                                    },
                                    {
                                        title: '📊 Métriques', items: [
                                            { label: 'Leads soumis', value: String(selectedPartner.totalLeadsSubmitted) },
                                            { label: 'Leads convertis', value: String(selectedPartner.totalLeadsConverted) },
                                            { label: 'Taux conversion', value: selectedPartner.totalLeadsSubmitted > 0 ? `${((selectedPartner.totalLeadsConverted / selectedPartner.totalLeadsSubmitted) * 100).toFixed(1)}%` : '—' },
                                            { label: 'Rate limit', value: `${selectedPartner.rateLimit}/h` },
                                        ]
                                    },
                                ].map(section => (
                                    <div key={section.title}>
                                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h4>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                                            {section.items.map(item => (
                                                <div key={item.label} className="flex justify-between">
                                                    <span className="text-xs text-slate-500">{item.label}</span>
                                                    <span className="text-xs text-white font-medium text-right">{item.value || '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {selectedPartner.notes && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📝 Notes</h4>
                                        <p className="text-sm text-slate-300 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">{selectedPartner.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Partners Table ═══ */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4">
                            <svg className="animate-spin w-8 h-8 text-violet-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <p className="text-slate-400 text-sm">Chargement des partenaires...</p>
                        </div>
                    </div>
                ) : partners.length === 0 && !showForm ? (
                    <div className="text-center py-20 bg-slate-900/30 border border-slate-700/30 rounded-2xl">
                        <span className="text-5xl mb-4 block">🤝</span>
                        <h3 className="text-lg font-semibold text-white mb-2">Aucun partenaire</h3>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                            Créez votre premier partenaire API pour commencer à recevoir des leads de sources externes.
                        </p>
                        <button onClick={() => setShowForm(true)}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-violet-500/25">
                            ➕ Ajouter un partenaire
                        </button>
                    </div>
                ) : partners.length > 0 ? (
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Partenaire</th>
                                        <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                                        <th className="text-center py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Statut</th>
                                        <th className="text-center py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Progression</th>
                                        <th className="text-center py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Leads</th>
                                        <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Créé le</th>
                                        <th className="text-center py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {partners.map((partner) => {
                                        const statusCfg = STATUS_CONFIG[partner.status] || STATUS_CONFIG.PENDING;
                                        return (
                                            <tr key={partner.id} className="hover:bg-slate-800/30 transition-colors duration-150">
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/30 border border-violet-500/20 flex items-center justify-center">
                                                            <span className="text-violet-300 font-bold text-xs">{partner.companyName.substring(0, 2).toUpperCase()}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-white">{partner.companyName}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {partner.formeJuridique || ''} {partner.siret ? `· ${partner.siret}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <p className="text-sm text-slate-300">{partner.contactName}</p>
                                                    <p className="text-xs text-slate-500">{partner.contactEmail}</p>
                                                </td>
                                                <td className="py-4 px-5 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}>
                                                        {statusCfg.icon} {statusCfg.label}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <div className="flex justify-center">
                                                        <WorkflowSteps partner={partner} />
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5 text-center">
                                                    <span className="text-sm font-semibold text-white">{partner.totalLeadsSubmitted}</span>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <p className="text-sm text-slate-400">
                                                        {new Date(partner.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => setSelectedPartner(partner)}
                                                            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                                                            title="Voir la fiche">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        </button>
                                                        {partner.status === 'PENDING' && partner.contractSignedAt && partner.dpaSignedAt && (
                                                            <button onClick={() => handlePartnerAction(partner.id, 'activate', { status: 'ACTIVE' })}
                                                                disabled={actionLoading === `${partner.id}-activate`}
                                                                className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-500 hover:text-emerald-400 transition-colors"
                                                                title="Activer le partenaire">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}

                {/* ═══ Workflow Documentation ═══ */}
                <div className="mt-8 bg-slate-900/30 border border-slate-700/30 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="text-blue-400">📘</span>
                        Workflow d&apos;onboarding partenaire
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {[
                            { step: '1', title: 'Créer la fiche', desc: 'Remplir la fiche personne morale', icon: '📝', color: 'from-violet-500/20 to-purple-500/20' },
                            { step: '2', title: 'Email envoyé', desc: 'Onboarding automatique', icon: '📧', color: 'from-blue-500/20 to-cyan-500/20' },
                            { step: '3', title: 'Signature', desc: 'Contrat + DPA par le partenaire', icon: '✍️', color: 'from-amber-500/20 to-yellow-500/20' },
                            { step: '4', title: 'Activation', desc: 'Validation admin + clé API', icon: '🔑', color: 'from-emerald-500/20 to-green-500/20' },
                            { step: '5', title: 'Opérationnel', desc: 'Le partenaire envoie des leads', icon: '🚀', color: 'from-pink-500/20 to-rose-500/20' },
                        ].map((s, i) => (
                            <div key={s.step} className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} border border-slate-700/50 flex items-center justify-center`}>
                                    <span className="text-lg">{s.icon}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-white">Étape {s.step}</p>
                                    <p className="text-xs font-medium text-slate-300">{s.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                                </div>
                                {i < 4 && <div className="hidden md:block mt-4 text-slate-600 text-xs">→</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

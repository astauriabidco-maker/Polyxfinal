/**
 * PUBLIC PARTNER ONBOARDING PAGE
 * ===============================
 * Page où le partenaire :
 *   1. Lit le contrat et le DPA (prévisualisation PDF inline)
 *   2. Signe chaque document (acceptation + horodatage)
 * 
 * Accessible via le lien envoyé par email d'onboarding.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PartnerData {
    id: string;
    companyName: string;
    contactName: string;
    status: string;
    contractSignedAt: string | null;
    dpaSignedAt: string | null;
    organization: { name: string };
    error?: string;
}

export default function PartnerOnboardingPage() {
    const { id } = useParams();
    const [partner, setPartner] = useState<PartnerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'CONTRACT' | 'DPA' | null>(null);
    const [readConfirmed, setReadConfirmed] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetch(`/api/partners/onboarding/${id}`)
            .then(res => res.json())
            .then(data => {
                setPartner(data);
                setLoading(false);
            });
    }, [id]);

    const handleSign = async (type: 'CONTRACT' | 'DPA') => {
        if (!readConfirmed[type]) return;
        setSigning(type);
        try {
            const res = await fetch(`/api/partners/${id}/documents/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentType: type }),
            });
            if (res.ok) {
                const updated = await fetch(`/api/partners/onboarding/${id}`).then(r => r.json());
                setPartner(updated);
                setPreviewType(null);
            }
        } catch (err) {
            console.error('Signature error:', err);
        } finally {
            setSigning(null);
        }
    };

    // ─── Loading ──────────────────────────────────────────────

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
                <p className="text-slate-400 text-sm">Chargement de votre espace...</p>
            </div>
        </div>
    );

    // ─── Error ────────────────────────────────────────────────

    if (partner?.error) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
            <div className="max-w-md">
                <p className="text-4xl mb-4">🚫</p>
                <h1 className="text-2xl font-bold text-white mb-2">Lien invalide</h1>
                <p className="text-slate-400">Ce lien de signature n&apos;est plus actif ou n&apos;existe plus.</p>
            </div>
        </div>
    );

    if (!partner) return null;

    const allSigned = partner.contractSignedAt && partner.dpaSignedAt;

    // ─── PDF Preview Modal ────────────────────────────────────

    const PdfPreviewModal = () => {
        if (!previewType) return null;
        const docLabel = previewType === 'CONTRACT' ? 'Contrat de Partenariat' : 'DPA (Data Processing Agreement)';
        const pdfUrl = `/api/partners/${id}/documents/preview?type=${previewType}`;

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
                {/* Header */}
                <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">{previewType === 'CONTRACT' ? '📄' : '🛡️'}</span>
                        <div>
                            <h2 className="text-white font-bold">{docLabel}</h2>
                            <p className="text-xs text-slate-400">Lisez attentivement avant de signer</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setPreviewType(null)}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* PDF Iframe */}
                <div className="flex-1 bg-slate-800">
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full"
                        title={docLabel}
                    />
                </div>

                {/* Bottom Action Bar */}
                {!(previewType === 'CONTRACT' ? partner.contractSignedAt : partner.dpaSignedAt) && (
                    <div className="bg-slate-900 border-t border-slate-700 px-6 py-4">
                        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                            <label className="flex items-center gap-3 cursor-pointer select-none group">
                                <input
                                    type="checkbox"
                                    checked={readConfirmed[previewType] || false}
                                    onChange={(e) =>
                                        setReadConfirmed((prev) => ({
                                            ...prev,
                                            [previewType]: e.target.checked,
                                        }))
                                    }
                                    className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-500"
                                />
                                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                    Je certifie avoir lu et compris l&apos;intégralité de ce document
                                </span>
                            </label>
                            <button
                                onClick={() => handleSign(previewType)}
                                disabled={!readConfirmed[previewType] || !!signing}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold text-sm transition-all duration-200 shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                {signing === previewType ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signature en cours...
                                    </>
                                ) : (
                                    <>✍️ Signer ce document</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ─── Main Render ──────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-purple-500/30">
            <PdfPreviewModal />

            <div className="max-w-4xl mx-auto py-12 px-6">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-block px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-4">
                        ONBOARDING PARTENAIRE
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-4">
                        Finalisez votre partenariat avec{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                            {partner.organization?.name}
                        </span>
                    </h1>
                    <p className="text-lg text-slate-400">
                        Bienvenue {partner.contactName}. Pour activer votre accès API,
                        veuillez lire et signer les documents de conformité ci-dessous.
                    </p>
                </div>

                {/* Steps Progress */}
                <div className="flex items-center justify-center gap-2 mb-12">
                    {[
                        { label: 'Lire le Contrat', done: !!partner.contractSignedAt },
                        { label: 'Signer le Contrat', done: !!partner.contractSignedAt },
                        { label: 'Lire le DPA', done: !!partner.dpaSignedAt },
                        { label: 'Signer le DPA', done: !!partner.dpaSignedAt },
                    ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step.done
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-500'
                                    }`}
                            >
                                {step.done ? '✓' : i + 1}
                            </div>
                            <span className={`text-xs hidden sm:block ${step.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {step.label}
                            </span>
                            {i < 3 && <div className={`w-6 h-0.5 ${step.done ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />}
                        </div>
                    ))}
                </div>

                {/* Document Cards */}
                <div className="grid gap-8 md:grid-cols-2">
                    {/* Contract Box */}
                    <div className={`p-6 rounded-2xl border transition-all ${partner.contractSignedAt
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-slate-900/50 border-slate-800 hover:border-purple-500/30'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-slate-800 text-xl">📄</div>
                            {partner.contractSignedAt ? (
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                    ✅ Signé
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                    À signer
                                </span>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Contrat de Partenariat</h3>
                        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                            Définit les conditions commerciales, les commissions, les obligations mutuelles
                            et les niveaux de service (SLA) pour la fourniture de leads.
                        </p>

                        {!partner.contractSignedAt ? (
                            <button
                                onClick={() => setPreviewType('CONTRACT')}
                                className="w-full py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                            >
                                📖 Lire et Signer le Contrat
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="py-3 px-4 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium flex items-center gap-2">
                                    ✅ Document validé et archivé
                                </div>
                                <button
                                    onClick={() => setPreviewType('CONTRACT')}
                                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    📄 Revoir le document
                                </button>
                            </div>
                        )}
                    </div>

                    {/* DPA Box */}
                    <div className={`p-6 rounded-2xl border transition-all ${partner.dpaSignedAt
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-slate-900/50 border-slate-800 hover:border-purple-500/30'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 rounded-xl bg-slate-800 text-xl">🛡️</div>
                            {partner.dpaSignedAt ? (
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                    ✅ Signé
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                    À signer
                                </span>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">DPA (Data Processing Agreement)</h3>
                        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                            Cadre légal RGPD (Article 28) pour le traitement et le transfert
                            des données personnelles des prospects.
                        </p>

                        {!partner.dpaSignedAt ? (
                            <button
                                onClick={() => setPreviewType('DPA')}
                                className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                            >
                                📖 Lire et Accepter le DPA
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="py-3 px-4 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium flex items-center gap-2">
                                    ✅ RGPD Validé
                                </div>
                                <button
                                    onClick={() => setPreviewType('DPA')}
                                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    🛡️ Revoir le document
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="mt-12 p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 text-center">
                    {allSigned ? (
                        <>
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                🎉
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Signature terminée !</h2>
                            <p className="text-slate-400 max-w-lg mx-auto">
                                Vos documents ont été transmis pour contre-signature.
                                Vous recevrez votre clé API et la documentation technique par email
                                dès la validation finale par l&apos;équipe{' '}
                                <span className="text-white font-medium">{partner.organization?.name}</span>.
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-white mb-2">Étape suivante</h2>
                            <p className="text-slate-400">
                                {!partner.contractSignedAt && !partner.dpaSignedAt
                                    ? 'Lisez et signez les deux documents ci-dessus pour finaliser votre partenariat.'
                                    : !partner.contractSignedAt
                                        ? 'Il vous reste à signer le Contrat de Partenariat.'
                                        : 'Il vous reste à signer le DPA (Data Processing Agreement).'}
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-slate-500 text-sm">
                    Propulsé par Polyx ERP Compliance Engine • &copy; 2026
                </div>
            </div>
        </div>
    );
}

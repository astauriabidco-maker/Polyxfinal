'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { submitPublicApplication } from './actions';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
    { title: 'Votre Projet', icon: '🏢' },
    { title: 'Identité', icon: '👤' },
    { title: 'Qualification', icon: '📝' },
    { title: 'Confirmation', icon: '🚀' },
];

export default function PublicApplicationForm() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState(0);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        franchiseType: 'OF' as 'OF' | 'CFA',
        companyName: '',
        siret: '',
        email: '',
        phone: '',
        representantNom: '',
        representantPrenom: '',
        representantFonction: '',
        investmentCapacity: '20K_50K' as any,
        totalBudget: '',
        hasPedagogicalExp: false,
        hasManagementExp: false,
        hasEntrepreneurialExp: false,
        targetZone: '',
        hasLocal: false,
        timing: 'MEDIUM' as any,
        motivationChoice: '',
        utmSource: '',
        utmMedium: '',
        utmCampaign: '',
    });

    useEffect(() => {
        const utmSource = searchParams.get('utm_source');
        const utmMedium = searchParams.get('utm_medium');
        const utmCampaign = searchParams.get('utm_campaign');

        if (utmSource || utmMedium || utmCampaign) {
            setFormData(prev => ({
                ...prev,
                utmSource: utmSource || '',
                utmMedium: utmMedium || '',
                utmCampaign: utmCampaign || '',
            }));
        }
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
    const prevStep = () => setStep(s => Math.max(s - 1, 0));

    const handleSubmit = async () => {
        setError(null);
        startTransition(async () => {
            const result = await submitPublicApplication(formData);
            if (result.error) {
                console.error('[PublicApplicationForm] Result Error:', result);
                setError(result.error);
            } else {
                setSuccess(true);
            }
        });
    };

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-12 text-center"
            >
                <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                    ✅
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Candidature reçue !</h2>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                    Merci {formData.representantPrenom}. Votre dossier a été transmis à notre service développement.
                    Un responsable réseau vous contactera sous 48h.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
                >
                    Revenir à l'accueil
                </button>
            </motion.div>
        );
    }

    return (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* Progress Header */}
            <div className="flex border-b border-white/5 bg-white/5">
                {STEPS.map((s, i) => (
                    <div
                        key={i}
                        className={`flex-1 py-4 text-center text-xs font-bold uppercase tracking-widest transition-all ${i <= step ? 'text-blue-400' : 'text-slate-600'
                            }`}
                    >
                        <span className="block text-lg mb-1">{s.icon}</span>
                        <span className="hidden md:inline">{s.title}</span>
                        {i === step && (
                            <motion.div layoutId="activeStep" className="h-0.5 bg-blue-500 mt-2 mx-4 rounded-full" />
                        )}
                    </div>
                ))}
            </div>

            <div className="p-8 md:p-12">
                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div
                            key="step0"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <h3 className="text-2xl font-bold text-white mb-6">Parlez-nous de votre projet</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Type de structure visée</label>
                                    <div className="flex gap-4">
                                        {['OF', 'CFA'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, franchiseType: t as any }))}
                                                className={`flex-1 py-3 rounded-xl border font-bold transition-all ${formData.franchiseType === t
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                                    : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
                                                    }`}
                                            >
                                                {t === 'OF' ? '🏫 OF' : '🎓 CFA'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Raison sociale</label>
                                    <input
                                        name="companyName"
                                        value={formData.companyName}
                                        onChange={handleChange}
                                        placeholder="Ex: SARL Formapro"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Numéro SIRET (si existant)</label>
                                    <input
                                        name="siret"
                                        value={formData.siret}
                                        onChange={handleChange}
                                        placeholder="14 chiffres"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <h3 className="text-2xl font-bold text-white mb-6">Informations personnelles</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Prénom</label>
                                    <input
                                        name="representantPrenom"
                                        value={formData.representantPrenom}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Nom</label>
                                    <input
                                        name="representantNom"
                                        value={formData.representantNom}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Email professionnel</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-400">Téléphone</label>
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <h3 className="text-2xl font-bold text-white mb-4">Pré-qualification</h3>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-slate-400 block">Capacité d'apport personnel</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { id: 'LESS_20K', label: '< 20k€' },
                                        { id: '20K_50K', label: '20-50k€' },
                                        { id: '50K_100K', label: '50-100k€' },
                                        { id: 'OVER_100K', label: '> 100k€' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, investmentCapacity: opt.id as any }))}
                                            className={`py-2 rounded-lg border text-sm font-semibold transition-all ${formData.investmentCapacity === opt.id
                                                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                                : 'bg-white/5 border-white/10 text-slate-500'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                                    <input type="checkbox" name="hasPedagogicalExp" checked={formData.hasPedagogicalExp} onChange={handleChange} className="w-5 h-5 rounded border-white/10 bg-blue-600" />
                                    <span className="text-sm text-slate-300">Exp. Pédagogique</span>
                                </label>
                                <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                                    <input type="checkbox" name="hasManagementExp" checked={formData.hasManagementExp} onChange={handleChange} className="w-5 h-5 rounded border-white/10 bg-blue-600" />
                                    <span className="text-sm text-slate-300">Exp. Management</span>
                                </label>
                                <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                                    <input type="checkbox" name="hasLocal" checked={formData.hasLocal} onChange={handleChange} className="w-5 h-5 rounded border-white/10 bg-blue-600" />
                                    <span className="text-sm text-slate-300">A déjà un local</span>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-400">Pourquoi rejoindre le réseau Polyx ?</label>
                                <textarea
                                    name="motivationChoice"
                                    value={formData.motivationChoice}
                                    onChange={handleChange}
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all resize-none"
                                    placeholder="Détaillez vos motivations..."
                                ></textarea>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="text-center py-8"
                        >
                            <div className="text-5xl mb-6">💡</div>
                            <h3 className="text-2xl font-bold text-white mb-4">Prêt à valider ?</h3>
                            <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                                En cliquant sur envoyer, votre dossier sera analysé par notre moteur de scoring et transmis à nos équipes.
                            </p>
                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm italic">
                                    ⚠️ {error}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Actions */}
                <div className="flex justify-between mt-12 pt-8 border-t border-white/5">
                    <button
                        onClick={prevStep}
                        disabled={step === 0 || isPending}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Précédent
                    </button>
                    {step < STEPS.length - 1 ? (
                        <button
                            onClick={nextStep}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
                        >
                            Continuer
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className={`px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-xl transition-all ${isPending ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            {isPending ? 'Envoi en cours...' : 'Envoyer ma candidature'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

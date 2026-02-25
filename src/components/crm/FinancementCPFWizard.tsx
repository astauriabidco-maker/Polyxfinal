'use client';

import { useState, useTransition } from 'react';
import {
    genererLienTest,
    updateLeadCPFAction,
    envoyerCourrier,
    receptionCourrier,
    planifierProchainRdvCpf,
} from '@/app/actions/qualification-wizard';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface CPFLead {
    id: string;
    prenom: string;
    nom: string;
    telephone?: string | null;
}

interface FinancementCPFWizardProps {
    lead: CPFLead;
    performedBy: string;
    onClose: () => void;
    onComplete: (data: { newStatus: string; message: string }) => void;
    initialStep?: CPFStep;
}

type CPFStep =
    | 'cpf_compte_actif'          // Q: Avez-vous un compte CPF actif ?
    | 'cpf_oui_actions'           // Oui → TEST / VERIFICATION
    | 'cpf_non_duree_id'          // Non → Durée pièce d'identité ?
    | 'cpf_id_plus5_actions'      // CNI +5 ans → ID NUM / VERIF
    | 'cpf_id_moins5_actions'     // CNI -5 ans → OUVERTURE / ID NUM / VERIF
    | 'cpf_test_options'          // Test de positionnement (shared)
    | 'cpf_verification'          // Vérification compte CPF
    | 'cpf_verif_result'          // Résultat vérification
    | 'cpf_verif_non_options'     // Non → en cours / problème
    | 'cpf_identite_numerique'    // Identité numérique validée ?
    | 'cpf_id_num_non_options'    // Non → création en cours / problème
    | 'cpf_probleme_options'      // Problème → ouverture / vérif / autres
    | 'cpf_autres_problemes'      // Autres problèmes → champ texte
    | 'cpf_ouverture_compte'      // Ouverture compte CPF → upload + courrier
    | 'cpf_courrier_envoye'       // Courrier envoyé → attente
    | 'cpf_courrier_recu'         // Courrier reçu ?
    | 'cpf_courrier_recu_date'    // Saisie date réception + confirmation
    | 'cpf_prochain_rdv_planification' // Planifier un RDV après réception
    | 'cpf_courrier_non_recu';    // Non reçu → problèmes

// ─────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────

export default function FinancementCPFWizard({
    lead,
    performedBy,
    onClose,
    onComplete,
    initialStep = 'cpf_compte_actif',
}: FinancementCPFWizardProps) {
    const [step, setStep] = useState<CPFStep>(initialStep);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // State
    const [generatedTestLink, setGeneratedTestLink] = useState<string | null>(null);
    const [problemDesc, setProblemDesc] = useState('');
    const [courrierDate, setCourrierDate] = useState('');
    const [receptionDate, setReceptionDate] = useState('');
    const [nextRdvDate, setNextRdvDate] = useState('');
    const [nextRdvTime, setNextRdvTime] = useState('');
    // Track previous step for navigation
    const [prevStep, setPrevStep] = useState<CPFStep>('cpf_compte_actif');

    const goTo = (next: CPFStep, from?: CPFStep) => {
        if (from) setPrevStep(from);
        setError(null);
        setStep(next);
    };

    // ══════════════════════════════════════════════════════
    // Q1 : Avez-vous un compte CPF actif ?
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_compte_actif') {
        return (
            <Shell lead={lead} onClose={onClose} title="Financement CPF">
                <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-2">
                        <span className="text-2xl">💳</span>
                    </div>
                    <p className="text-sm text-white font-medium">
                        Avez-vous déjà un compte CPF actif et accessible ?
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        Question à poser au lead {lead.prenom} {lead.nom}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => goTo('cpf_oui_actions', 'cpf_compte_actif')}
                        className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-green-500/30 hover:border-green-500/60 bg-gradient-to-br from-green-500/5 to-green-600/10 transition-all"
                    >
                        <span className="text-3xl">✅</span>
                        <p className="font-semibold text-sm text-green-400">Oui</p>
                        <p className="text-[10px] text-slate-500">Compte CPF existant</p>
                    </button>
                    <button
                        onClick={() => goTo('cpf_non_duree_id', 'cpf_compte_actif')}
                        className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-gradient-to-br from-red-500/5 to-red-600/10 transition-all"
                    >
                        <span className="text-3xl">❌</span>
                        <p className="font-semibold text-sm text-red-400">Non</p>
                        <p className="text-[10px] text-slate-500">Pas encore de compte</p>
                    </button>
                </div>
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // OUI → Actions réalisées
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_oui_actions') {
        return (
            <Shell lead={lead} onClose={onClose} title="Compte CPF actif">
                <div className="text-center mb-4">
                    <span className="text-3xl">✅</span>
                    <p className="text-sm text-slate-400 mt-2">Compte CPF actif — Action réalisée</p>
                </div>
                <div className="space-y-3">
                    <ActionBtn icon="📝" label="Faire test de positionnement" sub="Démarrer ou envoyer un lien" color="emerald" onClick={() => goTo('cpf_test_options', 'cpf_oui_actions')} />
                    <ActionBtn icon="🔍" label="Vérification compte CPF" sub="Vérifier le solde et l'accès" color="blue" onClick={() => goTo('cpf_verification', 'cpf_oui_actions')} />
                </div>
                <BackBtn onClick={() => goTo('cpf_compte_actif')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // NON → Durée pièce d'identité
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_non_duree_id') {
        return (
            <Shell lead={lead} onClose={onClose} title="Pièce d'identité">
                <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-2">
                        <span className="text-2xl">🪪</span>
                    </div>
                    <p className="text-sm text-white font-medium">Quelle est la durée de votre pièce d&apos;identité ?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => goTo('cpf_id_plus5_actions', 'cpf_non_duree_id')} className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-br from-amber-500/5 to-amber-600/10 transition-all">
                        <span className="text-3xl">📄</span>
                        <p className="font-semibold text-sm text-amber-400">CNI/TS + de 5 ans</p>
                        <p className="text-[10px] text-slate-500">Pièce ancienne</p>
                    </button>
                    <button onClick={() => goTo('cpf_id_moins5_actions', 'cpf_non_duree_id')} className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-green-500/30 hover:border-green-500/60 bg-gradient-to-br from-green-500/5 to-green-600/10 transition-all">
                        <span className="text-3xl">✅</span>
                        <p className="font-semibold text-sm text-green-400">CNI/TS - de 5 ans</p>
                        <p className="text-[10px] text-slate-500">Pièce récente</p>
                    </button>
                </div>
                <BackBtn onClick={() => goTo('cpf_compte_actif')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // CNI +5 ans → Identité Numérique / Vérification
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_id_plus5_actions') {
        return (
            <Shell lead={lead} onClose={onClose} title="CNI/TS + de 5 ans">
                <div className="text-center mb-4">
                    <span className="text-3xl">📄</span>
                    <p className="text-sm text-slate-400 mt-2">Pièce d&apos;identité de plus de 5 ans</p>
                </div>
                <div className="space-y-3">
                    <ActionBtn icon="🆔" label="Identité Numérique" sub="Validation via identité numérique" color="violet" onClick={() => goTo('cpf_identite_numerique', 'cpf_id_plus5_actions')} />
                    <ActionBtn icon="🔍" label="Vérification compte CPF" sub="Vérifier le solde et l'accès" color="blue" onClick={() => goTo('cpf_verification', 'cpf_id_plus5_actions')} />
                </div>
                <BackBtn onClick={() => goTo('cpf_non_duree_id')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // CNI -5 ans → Ouverture / ID Num / Vérification
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_id_moins5_actions') {
        return (
            <Shell lead={lead} onClose={onClose} title="CNI/TS - de 5 ans">
                <div className="text-center mb-4">
                    <span className="text-3xl">✅</span>
                    <p className="text-sm text-slate-400 mt-2">Pièce d&apos;identité récente — Action réalisée</p>
                </div>
                <div className="space-y-3">
                    <ActionBtn icon="📂" label="Ouverture de compte CPF" sub="Upload de documents + envoi de courrier" color="cyan" onClick={() => goTo('cpf_ouverture_compte', 'cpf_id_moins5_actions')} />
                    <ActionBtn icon="🆔" label="Identité Numérique" sub="Validation via identité numérique" color="violet" onClick={() => goTo('cpf_identite_numerique', 'cpf_id_moins5_actions')} />
                    <ActionBtn icon="🔍" label="Vérification compte CPF" sub="Vérifier le solde et l'accès" color="blue" onClick={() => goTo('cpf_verification', 'cpf_id_moins5_actions')} />
                </div>
                <BackBtn onClick={() => goTo('cpf_non_duree_id')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Test de positionnement (shared)
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_test_options') {
        const handleEnvoyerLien = () => {
            setError(null);
            startTransition(async () => {
                const result = await genererLienTest({ leadId: lead.id, performedBy });
                if (result.success) {
                    setGeneratedTestLink(result.testLink || null);
                } else {
                    setError(result.error || 'Erreur');
                }
            });
        };

        return (
            <Shell lead={lead} onClose={onClose} title="Test de positionnement">
                <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                        <span className="text-2xl">📝</span>
                    </div>
                    <p className="text-xs text-slate-500">Choisissez comment effectuer le test</p>
                </div>
                <div className="space-y-3">
                    <ActionBtn icon="🚀" label="Démarrer le test" sub="Lancer le module de test directement" color="emerald" onClick={() => window.open(`/admin/tests/nouveau?leadId=${lead.id}`, '_blank')} />
                    <button
                        onClick={handleEnvoyerLien}
                        disabled={isPending || !!generatedTestLink}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-blue-500/5 to-blue-600/10 transition-all group text-left disabled:opacity-60"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">🔗</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-sm text-blue-400">Envoyer un lien</p>
                            <p className="text-[11px] text-slate-500">{isPending ? 'Génération...' : 'Générer un lien de test'}</p>
                        </div>
                        {isPending && <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
                    </button>
                </div>
                {generatedTestLink && (
                    <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
                        <p className="text-xs text-emerald-400 font-medium mb-1">✅ Lien généré</p>
                        <div className="flex items-center gap-2">
                            <code className="text-xs text-slate-300 bg-slate-800 rounded-lg px-3 py-1.5 flex-1 overflow-hidden text-ellipsis">{generatedTestLink}</code>
                            <button onClick={() => navigator.clipboard.writeText(window.location.origin + generatedTestLink)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30">📋 Copier</button>
                        </div>
                        <button onClick={() => onComplete({ newStatus: 'TEST_EN_COURS_PERSO', message: 'Lien de test envoyé.' })} className="mt-3 w-full px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30">
                            ✅ Terminé — Fermer
                        </button>
                    </div>
                )}
                {error && <ErrorMsg msg={error} />}
                <BackBtn onClick={() => goTo(prevStep)} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Vérification compte CPF
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_verification') {
        const handleLancer = () => {
            setError(null);
            startTransition(async () => {
                const result = await updateLeadCPFAction({
                    leadId: lead.id, performedBy, action: 'VERIFICATION_CPF',
                    newStatus: 'CPF_COMPTE_A_DEMANDER',
                    noteText: '🔍 Vérification du compte CPF lancée — en attente de validation par le lead',
                });
                if (result.success) goTo('cpf_verif_result', step);
                else setError(result.error || 'Erreur');
            });
        };

        return (
            <Shell lead={lead} onClose={onClose} title="Vérification compte CPF">
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 mb-5">
                    <p className="text-sm text-slate-300 leading-relaxed">
                        La vérification de compte peut durer jusqu&apos;à <span className="text-blue-400 font-bold">48h</span>.
                        Elle est effectuée par le demandeur à partir de son compte CPF. Merci de demander au lead de se connecter
                        à son compte CPF et effectuer l&apos;opération de vérification.
                    </p>
                </div>
                <button onClick={handleLancer} disabled={isPending} className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                    {isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours...</> : <>🔍 Vérifier compte</>}
                </button>
                {error && <ErrorMsg msg={error} />}
                <BackBtn onClick={() => goTo(prevStep)} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Résultat vérification
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_verif_result') {
        return (
            <Shell lead={lead} onClose={onClose} title="Vérification CPF">
                <div className="text-center mb-5">
                    <span className="text-3xl">🔍</span>
                    <p className="text-sm text-white font-medium mt-2">La vérification du compte CPF a été validée ?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => goTo('cpf_test_options', 'cpf_verif_result')} className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-green-500/30 hover:border-green-500/60 bg-gradient-to-br from-green-500/5 to-green-600/10 transition-all">
                        <span className="text-3xl">✅</span>
                        <p className="font-semibold text-sm text-green-400">Oui</p>
                        <p className="text-[10px] text-slate-500">→ Test de positionnement</p>
                    </button>
                    <button onClick={() => goTo('cpf_verif_non_options', 'cpf_verif_result')} className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-gradient-to-br from-red-500/5 to-red-600/10 transition-all">
                        <span className="text-3xl">❌</span>
                        <p className="font-semibold text-sm text-red-400">Non</p>
                        <p className="text-[10px] text-slate-500">Problème ou en cours</p>
                    </button>
                </div>
                <BackBtn onClick={() => goTo(prevStep)} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Vérification NON → en cours / problème
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_verif_non_options') {
        return (
            <Shell lead={lead} onClose={onClose} title="Vérification en attente">
                <div className="space-y-3">
                    <ActionBtn icon="⏳" label="Vérification toujours en cours" sub="Le lead n'a pas encore finalisé" color="amber" onClick={() => {
                        startTransition(async () => {
                            await updateLeadCPFAction({ leadId: lead.id, performedBy, action: 'VERIF_EN_COURS', newStatus: 'CPF_COMPTE_A_DEMANDER', noteText: '⏳ Vérification CPF toujours en cours' });
                            onComplete({ newStatus: 'CPF_COMPTE_A_DEMANDER', message: 'Vérification CPF en cours. Bouton d\'action : VÉRIFIER COMPTE' });
                        });
                    }} />
                    <ActionBtn icon="⚠️" label="Le compte a un problème" sub="Ouverture de compte ou autre souci" color="red" onClick={() => goTo('cpf_probleme_options', 'cpf_verif_non_options')} />
                </div>
                <BackBtn onClick={() => goTo('cpf_verif_result')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Identité Numérique
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_identite_numerique') {
        return (
            <Shell lead={lead} onClose={onClose} title="Identité Numérique">
                <div className="text-center mb-5">
                    <span className="text-3xl">🆔</span>
                    <p className="text-sm text-white font-medium mt-2">Votre identité numérique a été validée ?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => goTo('cpf_test_options', 'cpf_identite_numerique')} className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-green-500/30 hover:border-green-500/60 bg-gradient-to-br from-green-500/5 to-green-600/10 transition-all">
                        <span className="text-3xl">✅</span>
                        <p className="font-semibold text-sm text-green-400">Oui</p>
                        <p className="text-[10px] text-slate-500">→ Test de positionnement</p>
                    </button>
                    <button onClick={() => goTo('cpf_id_num_non_options', 'cpf_identite_numerique')} className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-gradient-to-br from-red-500/5 to-red-600/10 transition-all">
                        <span className="text-3xl">❌</span>
                        <p className="font-semibold text-sm text-red-400">Non</p>
                        <p className="text-[10px] text-slate-500">En cours ou problème</p>
                    </button>
                </div>
                <BackBtn onClick={() => goTo(prevStep)} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // ID Numérique NON → création en cours / problème
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_id_num_non_options') {
        return (
            <Shell lead={lead} onClose={onClose} title="Identité numérique">
                <div className="space-y-3">
                    <ActionBtn icon="⏳" label="Création compte en cours" sub="Statut inchangé, même bouton d'action" color="amber" onClick={() => {
                        startTransition(async () => {
                            await updateLeadCPFAction({ leadId: lead.id, performedBy, action: 'CREATION_EN_COURS', noteText: '⏳ Création identité numérique en cours' });
                            onComplete({ newStatus: 'CPF_COMPTE_A_DEMANDER', message: 'Création identité numérique en cours.' });
                        });
                    }} />
                    <ActionBtn icon="⚠️" label="Le compte a un problème" sub="Ouverture CPF / Vérification / Autres" color="red" onClick={() => goTo('cpf_probleme_options', 'cpf_id_num_non_options')} />
                </div>
                <BackBtn onClick={() => goTo('cpf_identite_numerique')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Problème → Ouverture / Vérif / Autres
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_probleme_options') {
        return (
            <Shell lead={lead} onClose={onClose} title="Problème de compte">
                <div className="text-center mb-4">
                    <span className="text-3xl">⚠️</span>
                    <p className="text-sm text-slate-400 mt-2">Quel type de problème ?</p>
                </div>
                <div className="space-y-3">
                    <ActionBtn icon="📂" label="Ouverture un compte CPF" sub="Envoyer les documents nécessaires" color="cyan" onClick={() => goTo('cpf_ouverture_compte', 'cpf_probleme_options')} />
                    <ActionBtn icon="🔍" label="Vérification de compte" sub="Relancer la vérification" color="blue" onClick={() => goTo('cpf_verification', 'cpf_probleme_options')} />
                    <ActionBtn icon="📝" label="Autres problèmes" sub="Décrire le problème rencontré" color="red" onClick={() => goTo('cpf_autres_problemes', 'cpf_probleme_options')} />
                </div>
                <BackBtn onClick={() => goTo(prevStep)} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Autres problèmes — champ texte
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_autres_problemes') {
        const handleSubmit = () => {
            if (!problemDesc.trim()) { setError('Veuillez décrire le problème'); return; }
            setError(null);
            startTransition(async () => {
                const result = await updateLeadCPFAction({
                    leadId: lead.id, performedBy, action: 'AUTRES_PROBLEMES',
                    newStatus: 'PROBLEMES_SAV',
                    noteText: '⚠️ Problème signalé — transfert SAV',
                    problemDescription: problemDesc.trim(),
                });
                if (result.success) onComplete({ newStatus: 'PROBLEMES_SAV', message: 'Lead transféré en SAV. Bouton d\'action : QUALIFICATION' });
                else setError(result.error || 'Erreur');
            });
        };

        return (
            <Shell lead={lead} onClose={onClose} title="Autres problèmes">
                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">📝 Décrivez le problème rencontré *</label>
                    <textarea value={problemDesc} onChange={(e) => setProblemDesc(e.target.value)} placeholder="Décrivez le problème du lead..." rows={3} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 resize-none" />
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
                    <p className="text-xs text-red-400">⚠️ Le lead sera transféré en <strong>Problèmes / SAV</strong></p>
                </div>
                <button onClick={handleSubmit} disabled={isPending} className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2">
                    {isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours...</> : <>Confirmer ⚠️</>}
                </button>
                {error && <ErrorMsg msg={error} />}
                <BackBtn onClick={() => goTo('cpf_probleme_options')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Ouverture de compte CPF — Upload + Courrier
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_ouverture_compte') {
        const handleEnvoyerCourrier = () => {
            if (!courrierDate) { setError('Veuillez sélectionner une date d\'envoi'); return; }
            setError(null);
            startTransition(async () => {
                const result = await envoyerCourrier({ leadId: lead.id, performedBy, dateEnvoi: courrierDate });
                if (result.success) goTo('cpf_courrier_envoye', 'cpf_ouverture_compte');
                else setError(result.error || 'Erreur');
            });
        };

        return (
            <Shell lead={lead} onClose={onClose} title="Ouverture compte CPF">
                <div className="space-y-4">
                    {/* Upload zones (visuelles) */}
                    <div className="border border-dashed border-cyan-500/30 rounded-xl px-4 py-4 bg-cyan-500/5">
                        <p className="text-xs font-medium text-cyan-400 mb-2">📄 Formulaire / CNI / Carte Vitale</p>
                        <div className="flex items-center justify-center py-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-500">Glissez-déposez ou cliquez pour ajouter</p>
                        </div>
                    </div>
                    <div className="border border-dashed border-slate-500/30 rounded-xl px-4 py-4 bg-slate-500/5">
                        <p className="text-xs font-medium text-slate-400 mb-2">📎 Autres documents</p>
                        <div className="flex items-center justify-center py-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-500">Glissez-déposez ou cliquez pour ajouter</p>
                        </div>
                    </div>
                    {/* Date d'envoi courrier */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">📬 Date d&apos;envoi du courrier *</label>
                        <input type="date" value={courrierDate} onChange={(e) => setCourrierDate(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
                    </div>
                    <button onClick={handleEnvoyerCourrier} disabled={isPending} className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2">
                        {isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Envoi...</> : <>📬 Envoyer courrier</>}
                    </button>
                </div>
                {error && <ErrorMsg msg={error} />}
                <BackBtn onClick={() => goTo(prevStep)} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Courrier envoyé — Confirmation
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_courrier_envoye') {
        return (
            <Shell lead={lead} onClose={onClose} title="Courrier envoyé">
                <div className="text-center mb-5">
                    <span className="text-5xl">📬</span>
                    <p className="text-sm text-emerald-400 font-medium mt-3">Courrier envoyé avec succès !</p>
                    <p className="text-xs text-slate-500 mt-1">Statut : Courriers envoyés — En attente de réception</p>
                </div>
                <button onClick={() => onComplete({ newStatus: 'COURRIERS_ENVOYES', message: 'Courrier envoyé. Bouton d\'action : Courriers reçus' })} className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2">
                    ✅ Terminé — Fermer
                </button>
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Courrier reçu ? — appelé depuis le bouton d'action CRM
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_courrier_recu') {
        return (
            <Shell lead={lead} onClose={onClose} title="Réception courrier">
                <div className="text-center mb-5">
                    <span className="text-3xl">📨</span>
                    <p className="text-sm text-white font-medium mt-2">Avez-vous reçu le courrier ?</p>
                </div>
                <div className="space-y-3">
                    <ActionBtn icon="✅" label="J'ai reçu mon courrier" sub="Saisir la date de réception" color="green" onClick={() => {
                        setReceptionDate('');
                        goTo('cpf_courrier_recu_date', 'cpf_courrier_recu');
                    }} />
                    <ActionBtn icon="❌" label="Je n'ai pas reçu mon courrier" sub="Signaler un problème" color="red" onClick={() => goTo('cpf_courrier_non_recu', 'cpf_courrier_recu')} />
                </div>
                <BackBtn onClick={() => onClose()} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Courrier reçu — Saisie date de réception
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_courrier_recu_date') {
        const handleConfirmReception = () => {
            if (!receptionDate) {
                setError('Veuillez saisir la date de réception.');
                return;
            }
            startTransition(async () => {
                try {
                    const result = await updateLeadCPFAction({
                        leadId: lead.id,
                        performedBy,
                        action: 'COURRIER_RECU',
                        noteText: `Courrier reçu le ${receptionDate}`,
                        newStatus: 'COURRIERS_RECUS',
                    });
                    if (result.success) {
                        goTo('cpf_prochain_rdv_planification', 'cpf_courrier_recu_date');
                    } else {
                        setError(result.error || 'Erreur lors de la mise à jour.');
                    }
                } catch (err) {
                    setError('Erreur inattendue.');
                }
            });
        };

        return (
            <Shell lead={lead} onClose={onClose} title="Réception du courrier">
                <div className="text-center mb-4">
                    <span className="text-4xl">📨</span>
                    <p className="text-sm text-emerald-400 font-medium mt-2">Courrier reçu !</p>
                    <p className="text-xs text-slate-500 mt-1">Confirmez la date de réception</p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">📅 Date de réception *</label>
                        <input
                            type="date"
                            value={receptionDate}
                            onChange={(e) => setReceptionDate(e.target.value)}
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                    <button
                        onClick={handleConfirmReception}
                        disabled={isPending}
                        className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirmation...</>
                        ) : (
                            <>✅ Confirmer la réception</>
                        )}
                    </button>
                </div>
                {error && <ErrorMsg msg={error} />}
                <BackBtn onClick={() => goTo('cpf_courrier_recu')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Planifier Prochain RDV (Après réception courrier)
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_prochain_rdv_planification') {
        const handleConfirmRdv = () => {
            if (!nextRdvDate || !nextRdvTime) {
                setError('Veuillez saisir la date et l\'heure du RDV.');
                return;
            }
            startTransition(async () => {
                try {
                    const rdvDateTime = `${nextRdvDate}T${nextRdvTime}:00`;
                    const result = await planifierProchainRdvCpf({
                        leadId: lead.id,
                        performedBy,
                        dateRdv: rdvDateTime,
                        notes: 'Planifié suite à réception courrier',
                    });
                    if (result.success) {
                        onComplete({
                            newStatus: result.newStatus || 'COURRIERS_RECUS',
                            message: result.message || 'RDV planifié',
                        });
                    } else {
                        setError(result.error || 'Erreur lors de la planification.');
                    }
                } catch (err) {
                    setError('Erreur inattendue.');
                }
            });
        };

        const handleSkipRdv = () => {
            onComplete({
                newStatus: 'COURRIERS_RECUS',
                message: 'Courrier reçu (RDV ignoré).',
            });
        };

        return (
            <Shell lead={lead} onClose={onClose} title="Planifier Prochain RDV">
                <div className="text-center mb-4">
                    <span className="text-4xl">📅</span>
                    <p className="text-sm text-cyan-400 font-medium mt-2">Planifiez un RDV d'inscription</p>
                    <p className="text-xs text-slate-500 mt-1">Le courrier ayant été reçu, vous pouvez planifier une visio pour finaliser.</p>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Date *</label>
                            <input
                                type="date"
                                value={nextRdvDate}
                                onChange={(e) => setNextRdvDate(e.target.value)}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Heure *</label>
                            <input
                                type="time"
                                value={nextRdvTime}
                                onChange={(e) => setNextRdvTime(e.target.value)}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleConfirmRdv}
                        disabled={isPending}
                        className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
                        ) : (
                            <>📅 Enregistrer le RDV</>
                        )}
                    </button>

                    <button
                        onClick={handleSkipRdv}
                        className="w-full text-xs text-slate-500 hover:text-white transition-colors"
                        disabled={isPending}
                    >
                        Ignorer cette étape
                    </button>

                </div>
                {error && <ErrorMsg msg={error} />}
                <BackBtn onClick={() => goTo('cpf_courrier_recu_date')} />
            </Shell>
        );
    }

    // ══════════════════════════════════════════════════════
    // Courrier non reçu
    // ══════════════════════════════════════════════════════
    if (step === 'cpf_courrier_non_recu') {
        return (
            <Shell lead={lead} onClose={onClose} title="Courrier non reçu">
                <div className="space-y-3">
                    <ActionBtn icon="📝" label="Autres problèmes" sub="Décrire le problème rencontré" color="red" onClick={() => goTo('cpf_autres_problemes', 'cpf_courrier_non_recu')} />
                </div>
                <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
                    <p className="text-xs text-red-400">⚠️ Le lead sera transféré en Problèmes / SAV</p>
                </div>
                <BackBtn onClick={() => goTo('cpf_courrier_recu')} />
            </Shell>
        );
    }

    return null;
}

// ─────────────────────────────────────────────────────────
// Sous-composants réutilisables
// ─────────────────────────────────────────────────────────

function Shell({ lead, onClose, title, children }: { lead: CPFLead; onClose: () => void; title: string; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <span className="text-lg">💳</span>
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base">{title}</h2>
                            <p className="text-xs text-slate-500">{lead.prenom} {lead.nom}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800">✕</button>
                </div>
                <div className="px-6 py-5 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

function ActionBtn({ icon, label, sub, color, onClick }: { icon: string; label: string; sub: string; color: string; onClick: () => void }) {
    const colors: Record<string, { border: string; bg: string; text: string }> = {
        emerald: { border: 'border-emerald-500/30 hover:border-emerald-500/60', bg: 'from-emerald-500/5 to-emerald-600/10', text: 'text-emerald-400' },
        blue: { border: 'border-blue-500/30 hover:border-blue-500/60', bg: 'from-blue-500/5 to-blue-600/10', text: 'text-blue-400' },
        violet: { border: 'border-violet-500/30 hover:border-violet-500/60', bg: 'from-violet-500/5 to-violet-600/10', text: 'text-violet-400' },
        amber: { border: 'border-amber-500/30 hover:border-amber-500/60', bg: 'from-amber-500/5 to-amber-600/10', text: 'text-amber-400' },
        red: { border: 'border-red-500/30 hover:border-red-500/60', bg: 'from-red-500/5 to-red-600/10', text: 'text-red-400' },
        cyan: { border: 'border-cyan-500/30 hover:border-cyan-500/60', bg: 'from-cyan-500/5 to-cyan-600/10', text: 'text-cyan-400' },
        green: { border: 'border-green-500/30 hover:border-green-500/60', bg: 'from-green-500/5 to-green-600/10', text: 'text-green-400' },
    };
    const c = colors[color] || colors.blue;
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border ${c.border} bg-gradient-to-br ${c.bg} transition-all group text-left`}>
            <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-xl">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${c.text}`}>{label}</p>
                <p className="text-[11px] text-slate-500">{sub}</p>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors">→</span>
        </button>
    );
}

function BackBtn({ onClick }: { onClick: () => void }) {
    return (
        <div className="mt-5 pt-4 border-t border-slate-800">
            <button onClick={onClick} className="text-sm text-slate-500 hover:text-white transition-colors">← Retour</button>
        </div>
    );
}

function ErrorMsg({ msg }: { msg: string }) {
    return (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">⚠️ {msg}</div>
    );
}

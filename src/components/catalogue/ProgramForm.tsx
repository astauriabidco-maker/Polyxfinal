
'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProgramSchema, ProgramInput } from '@/lib/catalogue/schema';
import { createProgram, updateProgram } from '@/app/actions/programs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash, BookOpen, Clock, Euro, CheckCircle, GraduationCap, X, Sparkles } from 'lucide-react';
import { generateProgramContent } from '@/app/actions/ai-generate-program';

export default function ProgramForm({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'general' | 'pedago' | 'tarifs'>('general');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isEdit = !!initialData;

    const form = useForm<ProgramInput>({
        resolver: zodResolver(ProgramSchema),
        defaultValues: {
            // ... (rest of default values logic is fine, no need to touch if not necessary, but I must preserve it if I replace the block)
            title: initialData?.title || initialData?.intitule || '',
            reference: initialData?.reference || '',
            isTemplate: initialData?.isTemplate || false,
            isPublished: initialData?.isPublished ?? true,
            status: initialData?.status || 'ACTIF',
            dureeHeures: initialData?.dureeHeures || 0,
            dureeJours: initialData?.dureeJours || 0,
            tarifInter: initialData?.tarifInter || initialData?.tarifHT || 0,
            tarifIntra: initialData?.tarifIntra || 0,
            objectifs: initialData?.objectifs?.length ? initialData.objectifs : [''],
            contenu: initialData?.contenu || { text: '' },
            modalite: initialData?.modalite || 'PRESENTIEL',
            prerequis: initialData?.prerequis || 'Aucun prérequis technique.',
            publicCible: initialData?.publicCible || 'Tout public.',
            moyensPedago: initialData?.moyensPedago || 'Support PDF, ordinateurs fournis.',
            modalitesEval: initialData?.modalitesEval || 'QCM en fin de formation.'
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "objectifs"
    });

    const handleGenerateAI = async () => {
        const title = form.getValues('title');
        const duree = form.getValues('dureeHeures');

        if (!title) {
            toast.error("Veuillez saisir un titre pour générer le contenu.");
            return;
        }

        setIsGenerating(true);
        toast.info("L'IA rédige votre programme... (Cela peut prendre quelques secondes)");

        try {
            const result: any = await generateProgramContent(title, duree ? `${duree} heures` : undefined);

            if (result.error) {
                toast.error(result.error);
            } else if (result.data) {
                const data = result.data;
                form.setValue('objectifs', data.objectifs || []);
                form.setValue('prerequis', data.prerequis);
                form.setValue('publicCible', data.publicCible);
                form.setValue('moyensPedago', data.moyensPedago);
                form.setValue('modalitesEval', data.modalitesEval);
                form.setValue('contenu', { text: data.contenuText });

                toast.success("Programme généré ! ✨ Veuillez relire le contenu.");
                // Optional: visual feedback or tab switch
            }
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const onSubmit = async (data: ProgramInput) => {
        setIsSubmitting(true);
        try {
            if (isEdit) {
                await updateProgram(initialData.id, data);
                toast.success('Programme mis à jour avec succès');
                router.push(`/catalogue/${initialData.id}`);
            } else {
                const res = await createProgram(data);
                toast.success('Programme créé avec succès');
                router.push(`/catalogue/${res.id}`);
            }
            router.refresh();
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasErrors = (fields: (keyof ProgramInput)[]) => {
        return fields.some(f => form.formState.errors[f]);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

            {/* Header Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2
            ${activeTab === 'general' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}
            ${hasErrors(['title', 'reference']) ? 'text-red-500' : ''}
          `}
                >
                    <BookOpen className="w-4 h-4" />
                    Informations Générales
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('pedago')}
                    className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2
            ${activeTab === 'pedago' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}
            ${hasErrors(['prerequis', 'objectifs']) ? 'text-red-500' : ''}
          `}
                >
                    <GraduationCap className="w-4 h-4" />
                    Pédagogie (Qualiopi)
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('tarifs')}
                    className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2
            ${activeTab === 'tarifs' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}
            ${hasErrors(['dureeHeures', 'tarifInter']) ? 'text-red-500' : ''}
          `}
                >
                    <Euro className="w-4 h-4" />
                    Tarifs & Modalités
                </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">

                {/* TAB 1: GENERAL */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                    <span>Intitulé de la formation <span className="text-red-500">*</span></span>
                                    <button
                                        type="button"
                                        onClick={handleGenerateAI}
                                        disabled={isGenerating}
                                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:shadow-lg transition-all disabled:opacity-50"
                                    >
                                        {isGenerating ? (
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                        {isGenerating ? 'Rédaction...' : 'Rédiger avec IA'}
                                    </button>
                                </label>
                                <input
                                    {...form.register('title')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: Titre Pro - Développeur Web"
                                />
                                {form.formState.errors.title && <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Référence interne <span className="text-red-500">*</span></label>
                                <input
                                    {...form.register('reference')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: TP-DW-2024"
                                />
                                {form.formState.errors.reference && <p className="text-sm text-red-500">{form.formState.errors.reference.message}</p>}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isTemplate"
                                    {...form.register('isTemplate')}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                <label htmlFor="isTemplate" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                    Définir comme Modèle Réseau (Master Catalog)
                                </label>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 ml-7">
                                Si coché, ce programme sera automatiquement dupliqué dans les catalogues de vos franchises lors de la publication.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 bg-green-50 p-4 rounded-lg border border-green-200">
                            <input
                                type="checkbox"
                                id="isPublished"
                                {...form.register('isPublished')}
                                className="w-4 h-4 text-green-600 rounded border-green-300 focus:ring-green-500"
                            />
                            <label htmlFor="isPublished" className="text-sm font-medium text-green-800 cursor-pointer select-none">
                                Publier immédiatement au catalogue
                            </label>
                        </div>
                    </div>
                )}

                {/* TAB 2: PEDAGOGIE (QUALIOPI) */}
                {activeTab === 'pedago' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                <span>Objectifs Pédagogiques (Compétences visées) <span className="text-red-500">*</span></span>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Critère Qualiopi</span>
                            </label>

                            <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2">
                                        <div className="flex items-center justify-center w-8 h-10 bg-slate-100 rounded-lg text-slate-500 text-sm font-medium">
                                            {index + 1}
                                        </div>
                                        <input
                                            {...form.register(`objectifs.${index}` as const)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Ex: Être capable de déployer une application..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Supprimer l'objectif"
                                        >
                                            <Trash className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => append('')}
                                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-200 w-full justify-center"
                            >
                                <Plus className="w-4 h-4" />
                                Ajouter un objectif opérationnel
                            </button>
                            {form.formState.errors.objectifs && <p className="text-sm text-red-500">{form.formState.errors.objectifs.root?.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Prérequis <span className="text-red-500">*</span></label>
                                <textarea
                                    {...form.register('prerequis')}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    placeholder="Ex: Baccalauréat ou expérience équivalente..."
                                />
                                {form.formState.errors.prerequis && <p className="text-sm text-red-500">{form.formState.errors.prerequis.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Public Cible</label>
                                <textarea
                                    {...form.register('publicCible')}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    placeholder="Ex: Personnes en reconversion professionnelle..."
                                />
                            </div>
                        </div>

                        {/* Contenu Pédagogique (Syllabus) */}
                        <div className="space-y-2 border-t border-slate-200 pt-6">
                            <label className="text-sm font-medium text-slate-700">
                                Contenu Pédagogique (Syllabus) <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Détaillez le programme jour par jour. Ce contenu générera le PDF.
                            </p>
                            <textarea
                                {...form.register('contenu.text')}
                                rows={10}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder={`JOUR 1 :\n- Introduction\n- Module 1\n\nJOUR 2 :\n- Pratique...`}
                            />
                        </div>
                    </div>
                )}

                {/* TAB 3: TARIFS & MODALITES */}
                {activeTab === 'tarifs' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Modalité</label>
                                <select
                                    {...form.register('modalite')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="PRESENTIEL">Présentiel</option>
                                    <option value="DISTANCIEL">Distanciel (FOAD)</option>
                                    <option value="BLENDED">Blended Learning (Mixte)</option>
                                    <option value="AFEST">AFEST</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Durée (Heures) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        {...form.register('dureeHeures')}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                {form.formState.errors.dureeHeures && <p className="text-sm text-red-500">{form.formState.errors.dureeHeures.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Durée (Jours)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    {...form.register('dureeJours')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="border-t border-slate-200 my-4"></div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Tarif Inter-Entreprises (€ HT)</label>
                                <div className="relative">
                                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        {...form.register('tarifInter')}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Tarif Intra-Entreprise (€ HT)</label>
                                <div className="relative">
                                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        {...form.register('tarifIntra')}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 mt-8">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors settings-btn"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`
                    px-6 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all
                    flex items-center gap-2
                    ${isSubmitting
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20 shadow-lg hover:shadow-xl'
                            }
                `}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Enregistrement...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Créer le Programme
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

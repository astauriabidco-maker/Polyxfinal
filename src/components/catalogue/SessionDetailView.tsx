'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { User, MapPin, Calendar, Users, Plus, CheckCircle, X } from 'lucide-react';
import { registerStagiaire } from '@/app/actions/sessions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StagiaireSchema, StagiaireInput } from '@/lib/catalogue/dossier-schema';
import { toast } from 'sonner';

export default function SessionDetailView({ session }: { session: any }) {
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<StagiaireInput>({
        resolver: zodResolver(StagiaireSchema),
        defaultValues: { nom: '', prenom: '', email: '', telephone: '' }
    });

    const onSubmit = async (data: StagiaireInput) => {
        setIsSubmitting(true);
        try {
            await registerStagiaire(session.id, data);
            toast.success('Stagiaire inscrit avec succès');
            setShowRegisterForm(false);
            form.reset();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Info */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{session.programme.title}</h1>
                        <p className="text-slate-500 mt-1 flex items-center gap-2">
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{session.reference}</span>
                            <span>•</span>
                            <span>{session.programme.modalite}</span>
                        </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${session.status === 'CONFIRME' ? 'bg-green-50 text-green-700 border-green-200' :
                            session.status === 'PLANIFIE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                        {session.status}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-semibold">Dates</p>
                            <p className="text-sm font-medium">
                                {format(new Date(session.dateDebut), 'dd MMM yyyy', { locale: fr })}
                            </p>
                            <p className="text-xs text-slate-500">
                                au {format(new Date(session.dateFin), 'dd MMM yyyy', { locale: fr })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-semibold">Lieu</p>
                            <p className="text-sm font-medium truncate max-w-[200px]">{session.site.nom}</p>
                            <p className="text-xs text-slate-500">{session.site.ville}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-semibold">Formateur</p>
                            <p className="text-sm font-medium">
                                {session.formateur ? `${session.formateur.prenom} ${session.formateur.nom}` : 'Non assigné'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inscriptions Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50">
                    <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            Stagiaires Inscrits
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            {session._count.dossiers} / {session.placesMax} places occupées
                        </p>
                        {/* Progress Bar */}
                        <div className="w-32 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${session._count.dossiers >= session.placesMax ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, (session._count.dossiers / session.placesMax) * 100)}%` }}
                            />
                        </div>
                    </div>
                    {!showRegisterForm && (
                        <button
                            onClick={() => setShowRegisterForm(true)}
                            disabled={session._count.dossiers >= session.placesMax}
                            className={`text-sm px-4 py-2 rounded-lg transition flex items-center gap-2 font-medium shadow-sm
                                ${session._count.dossiers >= session.placesMax
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow'
                                }
                            `}
                        >
                            <Plus className="w-4 h-4" />
                            Inscrire un stagiaire
                        </button>
                    )}
                </div>

                {showRegisterForm && (
                    <div className="p-6 bg-blue-50/50 border-b border-blue-100 animate-in slide-in-from-top-2">
                        <h4 className="text-sm font-semibold text-blue-900 mb-4">Nouvelle Inscription</h4>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700">Nom <span className="text-red-500">*</span></label>
                                <input {...form.register('nom')} className="block w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700">Prénom <span className="text-red-500">*</span></label>
                                <input {...form.register('prenom')} className="block w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Prénom" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                                <input {...form.register('email')} className="block w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Email" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700">Téléphone</label>
                                <input {...form.register('telephone')} className="block w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Tél (optionnel)" />
                            </div>
                            <div className="flex items-center gap-2">
                                <button disabled={isSubmitting} type="submit" className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition shadow-sm flex justify-center items-center h-[38px]">
                                    {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Valider'}
                                </button>
                                <button type="button" onClick={() => setShowRegisterForm(false)} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition h-[38px]">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </form>
                        {Object.keys(form.formState.errors).length > 0 && (
                            <div className="text-xs text-red-500 mt-3 p-2 bg-red-50 border border-red-100 rounded">
                                {Object.values(form.formState.errors).map(e => e.message).join(', ')}
                            </div>
                        )}
                    </div>
                )}

                {/* List */}
                <div className="divide-y divide-slate-100">
                    {session.dossiers.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                            <Users className="w-8 h-8 text-slate-200" />
                            <p>Aucun stagiaire inscrit pour le moment.</p>
                        </div>
                    ) : (
                        session.dossiers.map((dossier: any) => (
                            <div key={dossier.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold shadow-sm border border-slate-200">
                                        {dossier.stagiairePrenom[0]}{dossier.stagiaireNom[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{dossier.stagiairePrenom} {dossier.stagiaireNom}</p>
                                        <p className="text-xs text-slate-500">{dossier.stagiaireEmail}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {dossier.company?.raisonSociale && (
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                            {dossier.company.raisonSociale}
                                        </span>
                                    )}
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${dossier.status === 'ADMIS' || dossier.status === 'ACTIF' ? 'bg-green-50 text-green-700 border-green-200' :
                                            dossier.status === 'BROUILLON' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                                                'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                        {dossier.status}
                                    </span>
                                    <p className="text-xs text-slate-400">
                                        Inscrit le {format(new Date(dossier.dateInscription), 'dd/MM/yy')}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

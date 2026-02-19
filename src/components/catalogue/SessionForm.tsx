
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SessionInput, SessionSchema } from '@/lib/catalogue/session-schema';
import { createSession } from '@/app/actions/sessions';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, MapPin, User, CheckCircle, Users } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface SessionFormProps {
    programmeId: string;
    sites: any[];
    trainers: any[];
    defaultDurationDays: number;
}

export function SessionForm({ programmeId, sites, trainers, defaultDurationDays }: SessionFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Default dates: start next Monday
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7 || 7); // simplistic next Monday

    const form = useForm<SessionInput>({
        resolver: zodResolver(SessionSchema),
        defaultValues: {
            programmeId,
            siteId: sites.length > 0 ? sites[0].id : '',
            formateurId: '',
            dateDebut: format(nextMonday, 'yyyy-MM-dd'),
            dateFin: format(addDays(nextMonday, Math.max(0, Math.ceil(defaultDurationDays) - 1)), 'yyyy-MM-dd'),
            placesMin: 4,
            placesMax: 12, // Standard pedagogical group size
            status: 'PLANIFIE',
        }
    });

    const onSubmit = async (data: SessionInput) => {
        setIsSubmitting(true);
        try {
            await createSession(data);
            toast.success('Session planifiée avec succès !');
            router.push(`/catalogue/${programmeId}`);
            router.refresh();
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Date de début <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        {...form.register('dateDebut')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {form.formState.errors.dateDebut && <p className="text-sm text-red-500">{form.formState.errors.dateDebut.message}</p>}
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Date de fin <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        {...form.register('dateFin')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {form.formState.errors.dateFin && <p className="text-sm text-red-500">{form.formState.errors.dateFin.message}</p>}
                </div>
            </div>

            {/* Resources */}
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        Lieu de Formation <span className="text-red-500">*</span>
                    </label>
                    <select
                        {...form.register('siteId')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">Sélectionner un lieu...</option>
                        {sites.map(site => (
                            <option key={site.id} value={site.id}>{site.name} ({site.city})</option>
                        ))}
                    </select>
                    {form.formState.errors.siteId && <p className="text-sm text-red-500">{form.formState.errors.siteId.message}</p>}
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        Formateur Assigné
                    </label>
                    <select
                        {...form.register('formateurId')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">-- À définir plus tard --</option>
                        {trainers.map(trainer => (
                            <option key={trainer.id} value={trainer.id}>{trainer.nom} {trainer.prenom}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Capacity */}
            <div className="grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        Places Minimum (Seuil rentabilité)
                    </label>
                    <input
                        type="number"
                        {...form.register('placesMin')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        Capacité Maximum (Pédagogique)
                    </label>
                    <input
                        type="number"
                        {...form.register('placesMax')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
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
                        ${isSubmitting ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}
                    `}
                >
                    {isSubmitting ? 'Planification...' : (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Confirmer la Session
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

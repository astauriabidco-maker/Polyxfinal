
'use client';

import { Session } from '@prisma/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Calendar, MapPin, User, Users, ChevronRight } from 'lucide-react';

// Extend Session type to include relations
type SessionWithDetails = Session & {
    site: { name: string };
    formateur: { nom: string; prenom: string } | null;
    _count: { dossiers: number };
};

export default function SessionList({ sessions, programmeId }: { sessions: any[], programmeId: string }) {
    // using any[] because literal types from prisma include are complex to match exactly with client side type definition sometimes
    // but the structure is guaranteed by the server action

    if (sessions.length === 0) {
        return (
            <div className="mt-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Sessions Planifiées</h2>
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <div className="bg-white p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-sm border border-slate-100 mb-3">
                        <Calendar className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">Aucune session planifiée</h3>
                    <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                        Planifiez des dates pour permettre les inscriptions et générer les documents administratifs (conventions, émargements).
                    </p>
                    <Link
                        href={`/catalogue/${programmeId}/sessions/new`}
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors"
                    >
                        <Calendar className="w-4 h-4" />
                        Planifier une première session
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-10 space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Sessions Planifiées</h2>
                    <p className="text-sm text-slate-500 mt-1">Gérez le calendrier et les inscriptions.</p>
                </div>
                <Link
                    href={`/catalogue/${programmeId}/sessions/new`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:border-blue-200 transition-all"
                >
                    <Calendar className="w-4 h-4" />
                    Nouvelle Session
                </Link>
            </div>

            <div className="grid gap-4">
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                        {/* Left: Date & Info */}
                        <div className="flex items-start gap-4 w-full md:w-auto">
                            <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg p-2 min-w-[70px] text-slate-700">
                                <span className="text-2xl font-bold leading-none">{format(new Date(session.dateDebut), 'dd')}</span>
                                <span className="text-xs font-medium uppercase mt-1">{format(new Date(session.dateDebut), 'MMM', { locale: fr })}</span>
                                <span className="text-[10px] text-slate-400 mt-1">{format(new Date(session.dateDebut), 'yyyy')}</span>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors cursor-pointer">
                                        Session {session.reference}
                                    </h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${session.status === 'PLANIFIE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            session.status === 'CONFIRME' ? 'bg-green-50 text-green-700 border-green-200' :
                                                session.status === 'ANNULE' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-slate-50 text-slate-700 border-slate-200'
                                        }`}>
                                        {session.status}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {session.site?.name || 'Lieu non défini'}
                                    </span>
                                    {session.formateur && (
                                        <span className="flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                            {session.formateur.prenom} {session.formateur.nom}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Stats & Action */}
                        <div className="flex items-center justify-between w-full md:w-auto gap-8 pl-20 md:pl-0">
                            <div className="flex flex-col items-end min-w-[100px]">
                                <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    <span>{session._count?.dossiers || 0}</span>
                                    <span className="text-slate-400">/ {session.placesMax} inscrits</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${(session._count?.dossiers || 0) >= session.placesMax ? 'bg-red-500' : 'bg-blue-500'
                                            }`}
                                        style={{ width: `${Math.min(100, ((session._count?.dossiers || 0) / session.placesMax) * 100)}%` }}
                                    />
                                </div>
                            </div>

                            <Link
                                href={`/catalogue/${programmeId}/sessions/${session.id}`}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                title="Gérer la session"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

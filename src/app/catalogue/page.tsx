
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getPrograms } from '@/app/actions/programs';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Crown, ExternalLink, GraduationCap, MapPin, MoreHorizontal, Plus } from 'lucide-react';
import ProgramPdfButton from '@/components/catalogue/ProgramPdfButton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

export default async function CataloguePage() {
    console.log("=== CATALOGUE PAGE RENDER START ===");
    const session = await auth();
    if (!session?.user) redirect('/signin');

    const programs = await getPrograms();
    console.log("=== CATALOGUE PAGE PROGRAMS FETCHED:", programs.length);

    // DEBUG UI if empty
    if (programs.length === 0) {
        console.log("DEBUG: Programs list is empty. User:", session.user.email, "OrgId:", session.user.organizationId);
    }

    return (
        <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catalogue de Formation (V2)</h1>
                    <p className="text-slate-500 mt-2">
                        Gérez vos programmes internes et ceux hérités du réseau. (Mode Diagnostic)
                    </p>
                </div>
                <Link
                    href="/catalogue/new"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:scale-[1.02]"
                >
                    <Plus className="h-4 w-4" />
                    Nouveau Programme
                </Link>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {programs.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">Aucun programme</h3>
                        <p className="mt-1 text-sm text-slate-500">Commencez par créer votre premier programme de formation.</p>
                        <div className="mt-6">
                            <Link
                                href="/catalogue/new"
                                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            >
                                <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                                Créer un programme
                            </Link>
                        </div>
                    </div>
                ) : (
                    programs.map((program) => (
                        <div
                            key={program.id}
                            className={`
                group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-1
                ${program.originalTemplateId ? 'border-purple-200 bg-purple-50/10' : 'border-slate-200'}
              `}
                        >
                            {/* Badge Type */}
                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                                {program.originalTemplateId ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 border border-purple-200 shadow-sm">
                                        <Crown className="w-3 h-3 text-purple-600" />
                                        Master Catalog
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                                        Interne
                                    </span>
                                )}
                                {program.isTemplate && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 border border-yellow-200 shadow-sm">
                                        Modèle Réseau
                                    </span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{program.reference}</span>
                                    <span>•</span>
                                    <span>{program.dureeHeures}h</span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                                    <Link href={`/catalogue/${program.id}`}>
                                        <span className="absolute inset-0" />
                                        {program.title}
                                    </Link>
                                </h3>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    <div className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                        <GraduationCap className="w-3 h-3" />
                                        {program.modalite}
                                    </div>
                                    {program.dureeJours > 0 && (
                                        <div className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                            {program.dureeJours} jours
                                        </div>
                                    )}
                                </div>

                                {program.originalTemplateId && program.originalTemplate && (
                                    <p className="text-xs text-purple-600 mt-2 flex items-center gap-1.5 bg-purple-50 p-2 rounded-lg border border-purple-100">
                                        <ExternalLink className="w-3 h-3" />
                                        Hérité de: <span className="font-semibold text-purple-700">Siège National</span>
                                    </p>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <div className="text-xs text-slate-500">
                                    Mis à jour le {format(new Date(program.updatedAt), 'd MMM yyyy', { locale: fr })}
                                </div>

                                <div className="flex items-center gap-2 relative z-20">
                                    <ProgramPdfButton programId={program.id} />
                                    <div className="w-px h-3 bg-slate-200 mx-1" />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${program.status === 'ACTIF' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`} />
                                        <span className="text-xs font-medium text-slate-600">{program.status}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

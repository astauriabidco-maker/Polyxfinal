
import { getSessionsForProgram } from '@/app/actions/sessions';
import { prisma } from '@/lib/prisma';
import SessionList from '@/components/catalogue/SessionList';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ArrowLeft, Edit, FileText, CheckCircle } from 'lucide-react';
import ComplianceAudit from '@/components/catalogue/ComplianceAudit';

export default async function ProgramDetailPage({ params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) redirect('/signin');

    const program: any = await prisma.programme.findUnique({
        where: { id: params.id },
        include: { organization: true } // Removed originalTemplate if it causes issues
    });

    if (!program) return notFound();

    // Fetch sessions
    const sessions = await getSessionsForProgram(program.id);

    return (
        <div className="container mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/catalogue" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{program.title}</h1>
                        <p className="text-slate-500 flex items-center gap-2 text-sm mt-1">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{program.reference}</span>
                            <span>•</span>
                            <span>{program.dureeHeures}h ({program.dureeJours}j)</span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${program.status === 'ACTIF' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {program.status}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link
                        href={`/catalogue/${program.id}/pdf`}
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <FileText className="w-4 h-4" />
                        Fiche PDF
                    </Link>
                    <Link
                        href={`/catalogue/${program.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                        Modifier
                    </Link>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Pédagogie Preview */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Pédagogie & Compétences</h2>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Objectifs Opérationnels</h3>
                            <ul className="grid gap-2">
                                {program.objectifs.map((obj, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        <span>{obj}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 pt-2">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Public Cible</h3>
                                <p className="text-sm text-slate-700">{program.publicCible || 'Non spécifié'}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Prérequis</h3>
                                <p className="text-sm text-slate-700">{program.prerequis}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sessions List Component */}
                    <SessionList sessions={sessions} programmeId={program.id} />
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <ComplianceAudit program={program} />

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">Informations Clés</h2>

                        <div className="space-y-4">
                            <div>
                                <span className="text-xs text-slate-500 block mb-1">Modalité d'enseignement</span>
                                <span className="font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm inline-block">
                                    {program.modalite}
                                </span>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <span className="text-xs text-slate-500 block mb-1">Tarif Inter-Entreprises</span>
                                <span className="text-lg font-bold text-slate-900">
                                    {program.tarifInter ? `${program.tarifInter} € HT` : 'Sur devis'}
                                </span>
                                <span className="text-xs text-slate-400 ml-1">/ stagiaire</span>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <span className="text-xs text-slate-500 block mb-1">Tarif Intra-Entreprise</span>
                                <span className="text-lg font-bold text-slate-900">
                                    {program.tarifIntra ? `${program.tarifIntra} € HT` : 'Sur devis'}
                                </span>
                                <span className="text-xs text-slate-400 ml-1">/ groupe</span>
                            </div>


                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

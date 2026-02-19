
import { SessionForm } from '@/components/catalogue/SessionForm';
import { getSites, getTrainers } from '@/app/actions/sessions';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export default async function NewSessionPage({ params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) redirect('/signin');
    if (!session.user.organizationId) redirect('/dashboard');

    const programmeId = params.id;
    const sites = await getSites();
    const trainers = await getTrainers();

    const programme = await prisma.programme.findUnique({
        where: {
            id: programmeId,
            organizationId: session.user.organizationId
        }
    });

    if (!programme) return notFound();

    return (
        <div className="container mx-auto py-12 px-4 max-w-3xl animate-in slide-in-from-right-8 duration-500">
            <div className="mb-8 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Planifier une Session</h1>
                <p className="text-slate-500 mt-2">
                    Définissez les dates et ressources pour le programme :
                    <span className="font-semibold text-blue-600 ml-1">{programme.title}</span>
                </p>
                <div className="mt-2 flex gap-4 text-xs text-slate-400">
                    <span>Durée recommandée : {programme.dureeHeures}h ({programme.dureeJours} jours)</span>
                    <span>•</span>
                    <span>Modalité : {programme.modalite}</span>
                </div>
            </div>

            <SessionForm
                programmeId={programmeId}
                sites={sites} // Assume sites[] is passed correctly
                trainers={trainers} // Assume users[] is passed
                defaultDurationDays={programme.dureeJours > 0 ? programme.dureeJours : 1}
            />
        </div>
    );
}

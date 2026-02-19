
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getSessionDetails } from '@/app/actions/sessions';
import SessionDetailView from '@/components/catalogue/SessionDetailView';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function SessionPage({ params }: { params: { id: string, sessionId: string } }) {
    const session = await auth();
    if (!session?.user) redirect('/api/auth/signin');

    const sessionData = await getSessionDetails(params.sessionId);

    if (!sessionData) return notFound();

    // Verify program ID match
    if (sessionData.programmeId !== params.id) return notFound();

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <Link
                    href={`/catalogue/${params.id}`}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au programme
                </Link>
            </div>

            <SessionDetailView session={sessionData} />
        </div>
    );
}

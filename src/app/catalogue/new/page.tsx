
import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ProgramForm from '@/components/catalogue/ProgramForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Nouveau Programme | Polyx ERP',
    description: 'Créer un nouveau programme de formation',
};

export default async function NewProgramPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/api/auth/signin');
    }

    return (
        <div className="container mx-auto max-w-5xl py-8 px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-1">
                    <Link
                        href="/catalogue"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour au catalogue
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Nouveau Programme
                    </h1>
                    <p className="text-slate-500 max-w-2xl">
                        Créez une nouvelle fiche programme conforme Qualiopi. Les champs marqués d'un astérisque sont obligatoires.
                    </p>
                </div>
            </div>

            {/* Form */}
            <ProgramForm />
        </div>
    );
}

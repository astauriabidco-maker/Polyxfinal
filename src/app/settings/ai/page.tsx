
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAISettings } from '@/app/actions/settings';
import AISettingsForm from '@/components/settings/AISettingsForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function AISettingsPage() {
    const session = await auth();
    if (!session?.user) redirect('/signin');

    const settings = await getAISettings();

    return (
        <div className="container mx-auto py-8 px-4 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-900">Paramètres IA & Automatisation</h1>
            </div>

            <div className="grid gap-8">
                <AISettingsForm initialData={settings} />
            </div>
        </div>
    );
}

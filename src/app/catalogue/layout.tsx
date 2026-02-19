
import Sidebar from '@/components/layout/Sidebar';
import UserHeader from '@/components/auth/UserHeader';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function CatalogueLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    if (!session?.user) redirect('/login');

    return (
        <div className="min-h-screen bg-slate-950 flex">
            <Sidebar />
            <main className="flex-1 ml-64 transition-all duration-300 bg-slate-50 min-h-screen flex flex-col">
                <UserHeader />
                <div className="flex-1 p-6 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

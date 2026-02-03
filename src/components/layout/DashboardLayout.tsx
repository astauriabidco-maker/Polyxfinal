/**
 * DASHBOARD LAYOUT - Layout avec Sidebar
 * =======================================
 * Layout commun pour les pages avec navigation latérale.
 */

import Sidebar from '@/components/layout/Sidebar';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-950">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content - with margin for sidebar */}
            <main className="ml-64 min-h-screen transition-all duration-300">
                {children}
            </main>
        </div>
    );
}

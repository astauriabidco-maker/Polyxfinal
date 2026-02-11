/**
 * PAGE REGISTRE RGPD — Article 30
 * ===================================
 * Dashboard de conformité RGPD & registre des traitements.
 * Affiche les traitements, les statistiques de conformité,
 * et permet l'export du registre formel.
 * 
 * @Compliance: RGPD Art. 30, Qualiopi Ind. 17
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RGPDRegisterDashboard from '@/components/rgpd/RGPDRegisterDashboard';

export const metadata = {
    title: 'Registre RGPD Art. 30 | Polyx ERP',
    description: 'Registre des activités de traitement conforme à l\'Article 30 du RGPD',
};

export default async function RGPDRegisterPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');

    // RBAC : ADMIN et RESP_ADMIN uniquement
    const allowedRoles = ['ADMIN', 'RESP_ADMIN'];
    if (!allowedRoles.includes(session.user.role)) {
        redirect('/');
    }

    return (
        <DashboardLayout>
            <RGPDRegisterDashboard />
        </DashboardLayout>
    );
}

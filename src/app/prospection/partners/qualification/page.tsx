/**
 * PAGE QUALIFICATION PARTENAIRES — Qualiopi Ind. 17 & 26
 * Accessible uniquement aux ADMIN et RESP_ADMIN.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PartnerQualificationDashboard from '@/components/partners/PartnerQualificationDashboard';

export const metadata = {
    title: 'Qualification Partenaires | Polyx ERP',
    description: 'Contrôle qualité Qualiopi Ind. 17 (Sous-traitance) & Ind. 26 (Intervenants externes)',
};

export default async function QualificationPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    const { role } = session.user;
    if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
        redirect('/prospection');
    }

    return (
        <DashboardLayout>
            <PartnerQualificationDashboard />
        </DashboardLayout>
    );
}

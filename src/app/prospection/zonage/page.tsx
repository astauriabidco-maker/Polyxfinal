import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ZonageManager from '@/components/prospection/ZonageManager';

export const metadata = {
    title: 'Zonage — Configuration du dispatch automatique | Polyx ERP',
    description: 'Mapping des codes postaux vers les agences pour le dispatch automatique des leads',
};

export default async function ZonagePage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect('/login');
    const organizationId = session.user.organizationId;

    // Charger les zones et les sites
    const [zones, sites] = await Promise.all([
        prisma.zoneMapping.findMany({
            where: { organizationId },
            include: {
                site: { select: { id: true, name: true, city: true, zipCode: true } },
            },
            orderBy: { prefix: 'asc' },
        }),
        prisma.site.findMany({
            where: { organizationId, isActive: true },
            select: { id: true, name: true, city: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    // Stats
    const totalLeads = await prisma.lead.count({ where: { organizationId } });
    const dispatchedLeads = await prisma.lead.count({ where: { organizationId, status: 'DISPATCHED' } });

    // Sérialiser pour le client
    const serializedZones = zones.map(z => ({
        id: z.id,
        prefix: z.prefix,
        label: z.label,
        isActive: z.isActive,
        siteId: z.siteId,
        siteName: z.site.name,
        siteCity: z.site.city,
        siteZipCode: z.site.zipCode,
        createdAt: z.createdAt.toISOString(),
    }));

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span>🗺️</span> Zonage — Dispatch Automatique
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Configurez le mapping code postal → agence pour le dispatch automatique des leads.
                    </p>
                </div>

                <ZonageManager
                    zones={serializedZones}
                    sites={sites}
                    stats={{ totalLeads, dispatchedLeads, totalZones: zones.length }}
                />
            </div>
        </DashboardLayout>
    );
}

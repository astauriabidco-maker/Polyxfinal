/**
 * AUDIT API ROUTE
 * ================
 * Récupère les entrées AuditLog pour un dossier donné.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: { dossierId: string } }
) {
    const { dossierId } = params;

    if (!dossierId) {
        return NextResponse.json({ error: 'dossierId requis' }, { status: 400 });
    }

    try {
        // Récupérer tous les AuditLogs liés à ce dossier
        const entries = await prisma.auditLog.findMany({
            where: {
                entityId: dossierId,
            },
            orderBy: {
                timestamp: 'desc',
            },
            select: {
                id: true,
                timestamp: true,
                action: true,
                niveauAction: true,
                entityType: true,
                entityId: true,
                newState: true,
                previousState: true,
                userId: true,
                userRole: true,
            },
            take: 50, // Limite pour la performance
        });

        // Également récupérer les logs liés aux Preuves de ce dossier
        const preuves = await prisma.preuve.findMany({
            where: { dossierId },
            select: { id: true },
        });

        const preuveIds = preuves.map(p => p.id);

        let preuveEntries: typeof entries = [];
        if (preuveIds.length > 0) {
            preuveEntries = await prisma.auditLog.findMany({
                where: {
                    entityId: { in: preuveIds },
                    entityType: 'Preuve',
                },
                orderBy: {
                    timestamp: 'desc',
                },
                select: {
                    id: true,
                    timestamp: true,
                    action: true,
                    niveauAction: true,
                    entityType: true,
                    entityId: true,
                    newState: true,
                    previousState: true,
                    userId: true,
                    userRole: true,
                },
            });
        }

        // Fusionner et trier
        const allEntries = [...entries, ...preuveEntries]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({ entries: allEntries });
    } catch (error) {
        console.error('[Audit API] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

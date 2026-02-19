import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const leadId = params.id;

        const [auditLogs, callLogs] = await Promise.all([
            prisma.auditLog.findMany({
                where: {
                    entityType: 'Lead',
                    entityId: leadId,
                },
                orderBy: { timestamp: 'desc' },
                include: {
                    user: { select: { nom: true, prenom: true } }
                }
            }),
            prisma.callLog.findMany({
                where: { leadId },
                orderBy: { createdAt: 'desc' },
                include: {
                    caller: { select: { nom: true, prenom: true } }
                }
            })
        ]);

        const timeline = [
            ...auditLogs.map(a => ({
                id: a.id,
                type: 'AUDIT',
                action: a.action,
                date: a.timestamp,
                user: a.user ? `${a.user.prenom} ${a.user.nom}` : 'Système',
                details: a.justification,
                metadata: a.newState
            })),
            ...callLogs.map(c => ({
                id: c.id,
                type: 'CALL',
                action: 'CALL',
                outcome: c.outcome,
                date: c.createdAt,
                user: c.caller ? `${c.caller.prenom} ${c.caller.nom}` : 'Inconnu',
                details: c.notes,
                duration: c.duration
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(timeline);

    } catch (error) {
        console.error('Timeline Error:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

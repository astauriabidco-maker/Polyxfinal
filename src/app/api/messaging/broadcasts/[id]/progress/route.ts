/**
 * BROADCAST PROGRESS — Real-time Polling
 * ==========================================
 * GET — Returns current send progress and status counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBroadcastProgress } from '@/lib/messaging/broadcast.service';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { id } = await params;
        const progress = await getBroadcastProgress(id);

        if (!progress) {
            return NextResponse.json({ error: 'Broadcast introuvable' }, { status: 404 });
        }

        return NextResponse.json({ progress });
    } catch (error) {
        console.error('Erreur GET /api/messaging/broadcasts/[id]/progress:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

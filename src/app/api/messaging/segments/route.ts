/**
 * SEGMENTS — Dynamic Segment Resolution
 * ========================================
 * GET — Returns pre-built segments (sessions, sites, tags) with counts
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDynamicSegments } from '@/lib/messaging/broadcast.service';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const segments = await getDynamicSegments(session.user.organizationId);

        return NextResponse.json({ segments });
    } catch (error) {
        console.error('Erreur GET /api/messaging/segments:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

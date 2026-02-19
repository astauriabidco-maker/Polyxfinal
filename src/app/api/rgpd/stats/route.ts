import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getRegisterStats } from '@/lib/prospection/rgpd-register';
import { getRetentionStats } from '@/lib/prospection/data-retention';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [registerStats, retentionStats] = await Promise.all([
            getRegisterStats(session.user.organizationId),
            getRetentionStats(session.user.organizationId),
        ]);

        return NextResponse.json({
            register: registerStats,
            retention: retentionStats,
        });
    } catch (error) {
        console.error('[RGPD Stats] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
